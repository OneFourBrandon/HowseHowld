import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
}

export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    if (!["POST", "DELETE"].includes(req.method)) return json({ error: "Method not allowed" }, 405)

    try {
      const auth = req.headers.get("Authorization")
      if (!auth) return json({ error: "Authentication required" }, 401)

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: auth } } },
      )
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) return json({ error: "Invalid session" }, 401)

      const body = await req.json()
      if (req.method === "DELETE") {
        if (typeof body.endpoint !== "string") return json({ error: "Endpoint required" }, 400)
        const { error } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", body.endpoint)
        if (error) throw error
        return json({ subscribed: false })
      }
      if (
        typeof body.endpoint !== "string" ||
        typeof body.keys?.p256dh !== "string" ||
        typeof body.keys?.auth !== "string"
      ) return json({ error: "Invalid PushSubscription" }, 400)

      const { data: membership, error: memberError } = await supabase
        .from("household_members")
        .select("id, household_id")
        .eq("profile_id", userData.user.id)
        .eq("active", true)
        .limit(1)
        .single()
      if (memberError || !membership) return json({ error: "No active household" }, 403)

      const { error } = await supabase.from("push_subscriptions").upsert({
        household_id: membership.household_id,
        member_id: membership.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: req.headers.get("user-agent"),
        active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" })
      if (error) throw error

      return json({ subscribed: true })
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Subscription failed" }, 500)
    }
  },
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: corsHeaders })
}
