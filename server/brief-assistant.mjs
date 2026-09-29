// Reference implementation of Nested's Brief assistant service.
//
// NOT part of the desktop application (it is outside the packaged `files`). It
// holds the provider key, which must never ship in the app. Run it where you
// host Nested services:
//
//   ANTHROPIC_API_KEY=... PORT=8787 node server/brief-assistant.mjs
//
// and point the app at it with NESTED_AI_URL (https in production).
//
// Before real use it still needs: sign-in for designers (this reference accepts
// any caller), rate limiting, request logging policy, and a data-processing
// agreement covering what designers send. It returns proposals only; the app
// validates them against an allowlist and the designer applies each one.
import { createServer } from 'node:http'
import { ALLOWED_FIELDS } from '../shared/briefAi.mjs'

const MODEL = process.env.NESTED_AI_MODEL || 'claude-sonnet-5-5'
const key = process.env.ANTHROPIC_API_KEY
if (!key) { console.error('Set ANTHROPIC_API_KEY'); process.exit(1) }

const system = `You help an interior designer fill out a client Design Brief inside the Nested app.
You receive the Brief so far (rooms, finishes, notes) and the designer's message.
- Answer briefly and concretely in "reply". Ask a question if something important is missing.
- Propose concrete edits only through "proposals", using exactly these fields: ${ALLOWED_FIELDS.join(', ')}.
- Never propose measurements, openings, verification, review, or furniture, and never invent facts about the client, the room's dimensions, or products. Notes should reflect what the designer said or clearly implied.
- Colours are six-digit hex. Materials and finishes must use the app's supported values.`

const tool = {
  name: 'respond',
  description: 'Reply to the designer and propose Brief edits.',
  input_schema: {
    type: 'object',
    properties: {
      reply: { type: 'string' },
      proposals: { type: 'array', maxItems: 12, items: { type: 'object', properties: { roomId: { type: 'string' }, field: { type: 'string', enum: ALLOWED_FIELDS }, value: {}, reason: { type: 'string' } }, required: ['roomId', 'field', 'value'] } },
    },
    required: ['reply', 'proposals'],
  },
}

createServer(async (req, res) => {
  const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
  if (req.method !== 'POST') return send(405, { error: 'POST only' })
  let body = ''
  for await (const chunk of req) { body += chunk; if (body.length > 300000) return send(413, { error: 'Too large' }) }
  try {
    const { message, brief } = JSON.parse(body)
    if (typeof message !== 'string' || typeof brief !== 'object') return send(400, { error: 'Bad request' })
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, system, tools: [tool], tool_choice: { type: 'tool', name: 'respond' }, messages: [{ role: 'user', content: `Brief so far:\n${JSON.stringify(brief)}\n\nDesigner: ${message}` }] }),
      signal: AbortSignal.timeout(40000),
    })
    if (!upstream.ok) return send(502, { error: 'Provider error' })
    const data = await upstream.json()
    const out = data.content?.find((c) => c.type === 'tool_use')?.input
    send(200, out ?? { reply: '', proposals: [] })
  } catch { send(500, { error: 'Failed' }) }
}).listen(Number(process.env.PORT) || 8787, '127.0.0.1', () => console.log('Nested Brief assistant listening'))
