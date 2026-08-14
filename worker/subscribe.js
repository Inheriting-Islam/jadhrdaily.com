/**
 * jadhrdaily.com/api/subscribe — the waitlist endpoint.
 *
 * First-party capture, no email provider in the loop. The page claims it makes
 * no third-party requests and that no third party ever sees a visitor; this
 * Worker keeps both claims literally true — the address goes into Cloudflare
 * KV on our own account and nowhere else. (The earlier draft posted to
 * Buttondown's API, which it turns out requires their $29/mo tier. Capture and
 * sending are now decoupled: store here for $0, send the Friday email through
 * anything, chosen later, from an export.)
 *
 * Deploy:
 *   cd worker
 *   npx wrangler kv namespace create LIST     # paste id into wrangler.toml
 *   npx wrangler kv namespace create RATE     # paste id into wrangler.toml
 *   npx wrangler secret put EXPORT_KEY        # any long random string
 *   npx wrangler deploy
 * Then set data-endpoint="/api/subscribe" on both forms in index.html.
 *
 * Export the list (for the Friday email):
 *   curl -H "Authorization: Bearer $EXPORT_KEY" https://jadhrdaily.com/api/subscribers
 *
 * Requires the domain to be proxied through Cloudflare (orange cloud), which is
 * only safe AFTER GitHub has issued the Pages certificate. See the README.
 */

const ALLOW = 'https://jadhrdaily.com';
const VALID = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* ---- export, for the person sending the Friday email ---- */
    if (request.method === 'GET' && url.pathname === '/api/subscribers') {
      const auth = request.headers.get('Authorization') || '';
      if (!env.EXPORT_KEY || auth !== `Bearer ${env.EXPORT_KEY}`) {
        return json({ error: 'auth' }, 401);
      }
      const rows = [];
      let cursor;
      do {
        const page = await env.LIST.list({ prefix: 'sub:', cursor });
        for (const k of page.keys) {
          const v = await env.LIST.get(k.name);
          if (v) rows.push(JSON.parse(v));
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return json({ count: rows.length, subscribers: rows }, 200);
    }

    /* ---- capture ---- */
    if (request.method !== 'POST' || url.pathname !== '/api/subscribe') {
      return json({ error: 'method' }, 405);
    }

    // Same-origin only. A waitlist endpoint that anyone can post to from
    // anywhere is a spam list waiting to happen.
    const origin = request.headers.get('Origin');
    if (origin && origin !== ALLOW) return json({ error: 'origin' }, 403);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'body' }, 400);
    }

    const email = String(body?.email || '').trim().toLowerCase();
    if (!VALID.test(email) || email.length > 254) return json({ error: 'email' }, 400);

    // One address per IP per minute. Enough to stop a bored script without
    // keeping anything about anybody: the key is a hash, and it self-deletes.
    const ip = request.headers.get('CF-Connecting-IP') || '';
    if (ip && env.RATE) {
      const key = 'rl:' + (await sha256(ip));
      if (await env.RATE.get(key)) return json({ error: 'slow down' }, 429);
      await env.RATE.put(key, '1', { expirationTtl: 60 });
    }

    // Idempotent: already subscribed is subscribed. Stored value is the email,
    // when, and where from — nothing else, because nothing else is needed to
    // send someone a root a week.
    const key = 'sub:' + email;
    if (!(await env.LIST.get(key))) {
      await env.LIST.put(key, JSON.stringify({
        email,
        at: new Date().toISOString(),
        source: String(body?.source || 'jadhrdaily.com').slice(0, 64),
      }));
    }
    return json({ ok: true }, 200);
  },
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
