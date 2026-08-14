/**
 * jadhrapp.com/api/subscribe — the waitlist endpoint.
 *
 * The page claims it makes no third-party requests, and that claim should stay
 * literally true even at the one moment the browser does talk to a server. So
 * the form posts to this Worker on jadhrapp.com's own origin, and the Worker —
 * not the visitor's browser — is what talks to the email provider. The API key
 * stays server-side, no third-party script runs on the page, and no third party
 * ever sees the visitor's IP.
 *
 * Deploy:
 *   cd worker && npx wrangler secret put ESP_KEY && npx wrangler deploy
 * Then set data-endpoint="/api/subscribe" on both forms in index.html.
 *
 * Requires the domain to be proxied through Cloudflare (orange cloud), which is
 * only safe AFTER GitHub has issued the Pages certificate. See the README.
 */

const ALLOW = 'https://jadhrapp.com';
const VALID = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
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

    // Buttondown by default — swap this block for any provider's API. A 409
    // means already subscribed, which the page treats as success, because from
    // the visitor's side it is.
    const res = await fetch('https://api.buttondown.email/v1/subscribers', {
      method: 'POST',
      headers: {
        Authorization: `Token ${env.ESP_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        tags: ['jadhr-waitlist'],
        referrer_url: 'https://jadhrapp.com/',
      }),
    });

    if (res.ok || res.status === 409) return json({ ok: true }, 200);

    console.error('esp', res.status, await res.text().catch(() => ''));
    return json({ error: 'upstream' }, 502);
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
