// line-webhook — receives webhook events from the PILLo LINE Official Account.
//
// Purpose:
//   1. Verify the request actually came from LINE (HMAC-SHA256 signature).
//   2. For each "message" event whose text matches a pending link code in
//      family_contacts, write back the sender's userId and clear the code.
//   3. Reply to the sender so they see immediate confirmation in the chat.
//
// Set in the LINE Developers Console:
//   Messaging API → Webhook URL = https://<project>.functions.supabase.co/line-webhook
//   Use webhook = ON
//
// Required Supabase function secrets:
//   LINE_CHANNEL_SECRET         (used to verify x-line-signature)
//   LINE_CHANNEL_ACCESS_TOKEN   (used to send the reply)
//
// IMPORTANT: deploy with `--no-verify-jwt` so LINE can hit it without an
// Authorization header:
//   supabase functions deploy line-webhook --no-verify-jwt

import { createServiceClient } from '../_shared/auth.ts'

interface LineMessageEvent {
  type: 'message'
  replyToken: string
  source: { type: 'user' | 'group' | 'room'; userId?: string }
  message: { type: 'text' | string; text?: string }
}

interface LineFollowEvent {
  type: 'follow'
  replyToken: string
  source: { type: 'user'; userId: string }
}

type LineEvent = LineMessageEvent | LineFollowEvent | { type: string; [k: string]: unknown }

interface LineWebhookBody {
  destination: string
  events: LineEvent[]
}

// ─── Signature verification ──────────────────────────────────────────────────

async function verifyLineSignature(
  rawBody: string,
  signatureHeader: string | null,
  channelSecret: string,
): Promise<boolean> {
  if (!signatureHeader) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return expected === signatureHeader
}

// ─── LINE reply ──────────────────────────────────────────────────────────────

async function lineReply(replyToken: string, text: string, accessToken: string): Promise<void> {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  })
}

// ─── Token matching ──────────────────────────────────────────────────────────

// QR / deep-link payload looks like:  LINK:<uuid>
// We accept any 8–80 char run of url-safe chars after "LINK:" so the format
// can evolve without redeploying the webhook.
const TOKEN_PATTERN = /LINK:([A-Za-z0-9_-]{8,80})/

function extractToken(text: string | undefined): string | null {
  if (!text) return null
  const m = text.match(TOKEN_PATTERN)
  return m ? m[1] : null
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const channelSecret = Deno.env.get('LINE_CHANNEL_SECRET')
  const accessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
  if (!channelSecret || !accessToken) {
    console.error('[line-webhook] LINE_CHANNEL_SECRET or LINE_CHANNEL_ACCESS_TOKEN not configured')
    return new Response('Not configured', { status: 500 })
  }

  const rawBody = await req.text()
  const ok = await verifyLineSignature(rawBody, req.headers.get('x-line-signature'), channelSecret)
  if (!ok) {
    console.warn('[line-webhook] Invalid signature')
    return new Response('Invalid signature', { status: 401 })
  }

  let body: LineWebhookBody
  try {
    body = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const supabase = createServiceClient()

  for (const ev of body.events ?? []) {
    try {
      if (ev.type === 'follow') {
        const followEv = ev as LineFollowEvent
        await lineReply(
          followEv.replyToken,
          'ยินดีต้อนรับสู่ PILLo 🤍\n\nกรุณาสแกน QR เชิญที่ผู้ดูแลให้กับคุณ เพื่อเริ่มรับการแจ้งเตือนเรื่องยา\n\n(Welcome to PILLo. Scan the invite QR your caregiver shared with you to start receiving medication alerts.)',
          accessToken,
        )
        continue
      }

      if (ev.type !== 'message') continue
      const msgEv = ev as LineMessageEvent
      if (msgEv.message?.type !== 'text') continue

      const userId = msgEv.source?.userId
      const token = extractToken(msgEv.message.text)

      if (!userId) continue

      if (!token) {
        await lineReply(
          msgEv.replyToken,
          'กรุณาสแกน QR เชิญที่ผู้ดูแลให้กับคุณ ระบบจะใส่ข้อความให้อัตโนมัติ\n\n(Please scan the invite QR your caregiver shared. The chat message is filled in for you automatically.)',
          accessToken,
        )
        continue
      }

      // Look up an un-burned token. linked_at IS NULL means the token has not
      // already been used by someone else.
      const { data: matched, error: matchErr } = await supabase
        .from('family_contacts')
        .select('id, name, linked_at')
        .eq('link_token', token)
        .is('linked_at', null)
        .limit(1)
        .maybeSingle()

      if (matchErr) {
        console.error('[line-webhook] match query failed', matchErr.message)
        continue
      }

      if (!matched) {
        await lineReply(
          msgEv.replyToken,
          'ลิงก์เชิญนี้ใช้งานไม่ได้แล้ว กรุณาขอ QR ใหม่จากผู้ดูแล\n\n(This invite is no longer valid. Please ask your caregiver for a new QR.)',
          accessToken,
        )
        continue
      }

      const { error: updateErr } = await supabase
        .from('family_contacts')
        .update({
          line_user_id: userId,
          linked_at: new Date().toISOString(),
        })
        .eq('id', matched.id)
        .is('linked_at', null)

      if (updateErr) {
        console.error('[line-webhook] update failed', updateErr.message)
        await lineReply(msgEv.replyToken, 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง (Something went wrong. Please try again.)', accessToken)
        continue
      }

      await lineReply(
        msgEv.replyToken,
        `เชื่อมต่อสำเร็จ ✅\nคุณ ${matched.name ?? ''} จะได้รับการแจ้งเตือนจากระบบ PILLo ผ่านทาง LINE\n\n(Linked successfully. You will now receive PILLo notifications here.)`,
        accessToken,
      )
    } catch (err) {
      console.error('[line-webhook] event handler error', err)
    }
  }

  // Always 200 to LINE; otherwise it will retry and we'll process duplicates.
  return new Response('ok', { status: 200 })
})
