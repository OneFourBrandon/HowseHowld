import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import ICAL from "ical.js"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
}
const maxBytes = 2 * 1024 * 1024

export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

    try {
      const auth = req.headers.get("Authorization")
      if (!auth) return json({ error: "Authentication required" }, 401)
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: auth } } },
      )
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      )
      const { data: userData } = await userClient.auth.getUser()
      if (!userData.user) return json({ error: "Invalid session" }, 401)
      const { data: member } = await userClient
        .from("household_members")
        .select("id, household_id")
        .eq("profile_id", userData.user.id)
        .eq("active", true)
        .limit(1)
        .single()
      if (!member) return json({ error: "No active household" }, 403)

      const form = await req.formData()
      const file = form.get("file")
      const calendarUrl = String(form.get("url") ?? "").trim()
      let sourceText = ""
      let sourceType: "file" | "url"
      let sourceName: string

      if (file instanceof File && file.size > 0) {
        if (file.size > maxBytes) return json({ error: "Calendar file is too large" }, 413)
        sourceText = await file.text()
        sourceType = "file"
        sourceName = file.name
      } else if (calendarUrl) {
        const parsed = new URL(calendarUrl)
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return json({ error: "Calendar URL must use HTTPS" }, 400)
        }
        const response = await fetch(parsed, { redirect: "follow" })
        if (!response.ok) return json({ error: "Could not fetch calendar" }, 400)
        const length = Number(response.headers.get("content-length") ?? 0)
        if (length > maxBytes) return json({ error: "Calendar is too large" }, 413)
        sourceText = await response.text()
        if (sourceText.length > maxBytes) return json({ error: "Calendar is too large" }, 413)
        sourceType = "url"
        sourceName = `${parsed.hostname} calendar`
      } else {
        return json({ error: "Choose an .ics file or URL" }, 400)
      }

      const hashBytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(sourceText),
      )
      const sourceHash = [...new Uint8Array(hashBytes)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")

      const jcal = ICAL.parse(sourceText)
      const calendar = new ICAL.Component(jcal)
      const events = calendar.getAllSubcomponents("vevent")
      const { data: importRow, error: importError } = await admin
        .from("course_imports")
        .insert({
          household_id: member.household_id,
          owner_member_id: member.id,
          source_type: sourceType,
          source_name: sourceName,
          source_hash: sourceHash,
          imported_count: events.length,
        })
        .select("id")
        .single()
      if (importError) throw importError

      const rows = events.flatMap((component: ICAL.Component) => {
        try {
          const event = new ICAL.Event(component)
          return expandEvent(event, component, {
            householdId: member.household_id,
            ownerMemberId: member.id,
            importId: importRow.id,
          })
        } catch {
          return []
        }
      })
      const courseCodes = [...new Set(rows.map((row) => extractCourseCode(row.title)).filter(Boolean))]
      const courseIds = new Map<string, string>()
      for (const code of courseCodes) {
        const { data: course, error } = await admin.from("courses").upsert({
          household_id: member.household_id,
          owner_member_id: member.id,
          code,
          name: code,
        }, { onConflict: "household_id,owner_member_id,code" }).select("id").single()
        if (error) throw error
        courseIds.set(code, course.id)
      }
      for (const row of rows) {
        row.course_id = courseIds.get(extractCourseCode(row.title)) ?? null
      }
      if (rows.length) {
        const { error } = await admin.from("schedule_items").upsert(rows, {
          onConflict: "household_id,owner_member_id,external_uid,recurrence_id",
        })
        if (error) throw error
      }

      return json({ imported: rows.length, skipped: events.length - rows.length })
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Import failed" }, 500)
    }
  },
}

function extractCourseCode(value: string) {
  return value.match(/\b[A-Z]{2,4}\s?\d{3,4}[A-Z]?\b/i)?.[0]?.toUpperCase() ?? ""
}

function expandEvent(
  event: ICAL.Event,
  component: ICAL.Component,
  owner: { householdId: string; ownerMemberId: string; importId: string },
) {
  const code = extractCourseCode(event.summary)
  const recurrenceId = component.getFirstPropertyValue("recurrence-id")
  const rrule = component.getFirstPropertyValue("rrule")
  const common = {
    household_id: owner.householdId,
    owner_member_id: owner.ownerMemberId,
    import_id: owner.importId,
    course_id: null as string | null,
    external_uid: event.uid || crypto.randomUUID(),
    kind: /exam|test|midterm|final/i.test(event.summary) ? "exam" : code ? "class" : "other",
    title: event.summary || "Imported event",
    description: event.description || null,
    location: event.location || null,
    source_url: component.getFirstPropertyValue("url")?.toString() ?? null,
    timezone: event.startDate.zone?.tzid || null,
    rrule: rrule?.toString() ?? null,
  }
  if (!event.isRecurring() || recurrenceId) {
    return [{
      ...common,
      recurrence_id: recurrenceId?.toString() ?? "",
      start_at: event.startDate.toJSDate().toISOString(),
      end_at: event.endDate.toJSDate().toISOString(),
    }]
  }

  const rows = []
  const iterator = event.iterator()
  const horizon = new Date()
  horizon.setFullYear(horizon.getFullYear() + 1)
  for (let count = 0; count < 500; count++) {
    const next = iterator.next()
    if (!next || next.toJSDate() > horizon) break
    const occurrence = event.getOccurrenceDetails(next)
    if (occurrence.endDate.toJSDate() < new Date(Date.now() - 31 * 86400000)) continue
    rows.push({
      ...common,
      recurrence_id: next.toString(),
      start_at: occurrence.startDate.toJSDate().toISOString(),
      end_at: occurrence.endDate.toJSDate().toISOString(),
    })
  }
  return rows
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: corsHeaders })
}
