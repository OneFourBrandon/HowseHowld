import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-dispatch-secret",
}

type Outbox = {
  id: string
  household_id: string
  member_id: string
  title: string
  body: string
  deep_link: string
  urgency: "very-low" | "low" | "normal" | "high"
}

export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

    const url = Deno.env.get("SUPABASE_URL")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    try {
      const body = await req.json().catch(() => ({}))
      let testMember: { id: string; household_id: string } | null = null
      if (body.test === true) {
        const auth = req.headers.get("Authorization")
        if (!auth) return json({ error: "Authentication required" }, 401)
        const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: auth } },
        })
        const { data: userData, error: userError } = await userClient.auth.getUser()
        if (userError || !userData.user) return json({ error: "Invalid session" }, 401)
        const { data: member, error: memberError } = await userClient
          .from("household_members")
          .select("id, household_id")
          .eq("profile_id", userData.user.id)
          .eq("active", true)
          .limit(1)
          .single()
        if (memberError || !member) return json({ error: "No active household" }, 403)
        testMember = member
      } else if (
        req.headers.get("X-Dispatch-Secret") !== Deno.env.get("DISPATCH_SECRET")
      ) {
        return json({ error: "Invalid dispatcher secret" }, 401)
      }

      const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")
      const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")
      const subject = Deno.env.get("VAPID_SUBJECT")
      const missingVapidSecrets = [
        !publicKey && "VAPID_PUBLIC_KEY",
        !privateKey && "VAPID_PRIVATE_KEY",
        !subject && "VAPID_SUBJECT",
      ].filter(Boolean)
      if (missingVapidSecrets.length) {
        return json({
          error: `Web Push is not configured. Missing ${missingVapidSecrets.join(", ")}.`,
        }, 503)
      }
      webpush.setVapidDetails(subject!, publicKey!, privateKey!)

      let testNotificationId: string | null = null
      if (testMember) {
        const { data: testNotification, error: insertError } = await admin
          .from("notification_outbox")
          .insert({
            household_id: testMember.household_id,
            member_id: testMember.id,
            kind: "test",
            entity_type: "push_subscription",
            entity_id: crypto.randomUUID(),
            scheduled_at: new Date().toISOString(),
            title: "HowseHowld is ready",
            body: "This device can receive household reminders.",
            deep_link: "/settings",
            urgency: "high",
          })
          .select("id")
          .single()
        if (insertError) throw insertError
        testNotificationId = testNotification.id
      }

      const { data: claimed, error: claimError } = await admin.rpc(
        "claim_notification_outbox",
        { p_limit: 50 },
      )
      if (claimError) throw claimError

      let delivered = 0
      let failed = 0
      let testDelivered = false
      let testFailure = "No active push subscription accepted the test."
      for (const notification of (claimed ?? []) as Outbox[]) {
        const { data: subscriptions, error: subscriptionsError } = await admin
          .from("push_subscriptions")
          .select("*")
          .eq("member_id", notification.member_id)
          .eq("active", true)
        if (subscriptionsError) throw subscriptionsError

        let sentForNotification = false
        for (const subscription of subscriptions ?? []) {
          try {
            const result = await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              JSON.stringify({
                title: notification.title,
                body: notification.body,
                url: notification.deep_link,
              }),
              {
                urgency: notification.urgency,
                TTL: notification.urgency === "high" ? 900 : 86400,
                topic: notification.id.replaceAll("-", "").slice(0, 32),
              },
            )
            sentForNotification = true
            if (notification.id === testNotificationId) testDelivered = true
            delivered++
            await admin.from("notification_attempts").insert({
              household_id: notification.household_id,
              outbox_id: notification.id,
              subscription_id: subscription.id,
              status_code: result.statusCode,
              success: true,
            })
            await admin.from("push_subscriptions").update({
              last_success_at: new Date().toISOString(),
            }).eq("id", subscription.id)
          } catch (cause) {
            failed++
            const error = cause as { statusCode?: number; message?: string }
            if (notification.id === testNotificationId && error.message) {
              testFailure = error.message
            }
            await admin.from("notification_attempts").insert({
              household_id: notification.household_id,
              outbox_id: notification.id,
              subscription_id: subscription.id,
              status_code: error.statusCode ?? null,
              success: false,
              error: error.message ?? "Push failed",
            })
            if (error.statusCode === 404 || error.statusCode === 410) {
              await admin.from("push_subscriptions").update({
                active: false,
                last_failure_at: new Date().toISOString(),
              }).eq("id", subscription.id)
            }
          }
        }

        await admin.from("notification_outbox").update({
          status: sentForNotification ? "sent" : "failed",
          sent_at: sentForNotification ? new Date().toISOString() : null,
          last_error: sentForNotification ? null : "No active subscription accepted the push",
        }).eq("id", notification.id)
      }

      if (testNotificationId && !testDelivered) {
        return json({ error: testFailure }, 409)
      }

      return json({ claimed: claimed?.length ?? 0, delivered, failed })
    } catch (error) {
      console.error("push-dispatch failed", error)
      return json({ error: error instanceof Error ? error.message : "Dispatch failed" }, 500)
    }
  },
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: corsHeaders })
}
