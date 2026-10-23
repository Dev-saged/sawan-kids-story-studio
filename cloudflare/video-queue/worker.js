// طابور فيديو ساجد على Cloudflare Workers: التطبيق يضع مهمة، ودفتر Colab يسحبها ويرفع المقطع، ثم يستلمه التطبيق.
// الارتباطات: DB (D1) لحالة المهام، BLOBS (KV) للصور والمقاطع (تُحذف تلقائياً بعد 24 ساعة).
// الأسرار: APP_TOKEN (للتطبيق) و WORKER_TOKEN (لدفتر Colab، اختياري ويساوي APP_TOKEN عند غيابه).
const VERSION = 1;
const TTL = 86400;
const STALE_MS = 25 * 60 * 1000;
const KEEP_MS = 2 * 86400 * 1000;
const MAX_QUEUED = 40;
const MAX_IMAGE = 6_000_000;
const MAX_VIDEO = 24_000_000;
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ASPECTS = new Set(['16:9', '9:16']);

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,x-sawan-key',
  'access-control-max-age': '86400',
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const fail = (status, error) => json({ ok: false, error }, status);

const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const roleOf = (request, env) => {
  if (!env.APP_TOKEN || env.APP_TOKEN.length < 16) return 'unconfigured';
  const key = request.headers.get('x-sawan-key') || '';
  if (safeEqual(key, env.APP_TOKEN)) return 'app';
  if (safeEqual(key, env.WORKER_TOKEN || env.APP_TOKEN)) return 'worker';
  return null;
};

let ready = false;
const ensure = async (env) => {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, ckey TEXT UNIQUE, status TEXT NOT NULL, prompt TEXT NOT NULL, aspect TEXT NOT NULL, seconds INTEGER NOT NULL, mime TEXT, vmime TEXT, error TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL, claimed INTEGER)'
    ),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS jobs_status ON jobs (status, created)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL)'),
  ]);
  ready = true;
};

let lastTouch = 0;
const touchWorker = async (env) => {
  const now = Date.now();
  if (now - lastTouch < 30_000) return;
  lastTouch = now;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind('worker_seen', now),
    env.DB.prepare('DELETE FROM jobs WHERE created < ?').bind(now - KEEP_MS),
  ]);
};

const view = (row) => ({ id: row.id, status: row.status, error: row.error || undefined, created: row.created, updated: row.updated });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/health' || path === '/') return json({ ok: true, service: 'sawan-video-queue', v: VERSION });
    if (!env.DB || !env.BLOBS) return fail(500, 'Bindings DB and BLOBS are missing.');

    const role = roleOf(request, env);
    if (role === 'unconfigured') return fail(500, 'APP_TOKEN secret is missing or shorter than 16 characters.');
    if (!role) return fail(401, 'Unauthorized.');

    try {
      await ensure(env);
      const now = Date.now();
      const parts = path.split('/').filter(Boolean);

      if (path === '/status' && request.method === 'GET') {
        const counts = await env.DB.prepare("SELECT status, COUNT(*) AS n FROM jobs WHERE status IN ('queued','running') GROUP BY status").all();
        const seen = await env.DB.prepare("SELECT v FROM meta WHERE k = 'worker_seen'").first();
        const by = Object.fromEntries((counts.results || []).map((r) => [r.status, r.n]));
        return json({ ok: true, queued: by.queued || 0, running: by.running || 0, workerSeenSeconds: seen ? Math.max(0, Math.round((now - seen.v) / 1000)) : null });
      }

      if (path === '/jobs' && request.method === 'POST') {
        if (role !== 'app') return fail(403, 'Forbidden.');
        let body;
        try {
          body = await request.json();
        } catch {
          return fail(400, 'Invalid JSON.');
        }
        const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, 1500) : '';
        const aspect = ASPECTS.has(body?.aspect) ? body.aspect : '';
        const seconds = Math.min(12, Math.max(2, Math.round(Number(body?.seconds) || 5)));
        const mime = IMAGE_MIMES.has(body?.mime) ? body.mime : '';
        const ckey = typeof body?.key === 'string' && /^[\w:.\-]{1,120}$/.test(body.key) ? body.key : null;
        if (!prompt || !aspect || !mime) return fail(400, 'prompt, aspect and mime are required.');
        if (ckey) {
          const old = await env.DB.prepare('SELECT * FROM jobs WHERE ckey = ?').bind(ckey).first();
          if (old && old.status !== 'error') return json({ ok: true, ...view(old), reused: true });
          if (old) await env.DB.prepare('DELETE FROM jobs WHERE id = ?').bind(old.id).run();
        }
        const pending = await env.DB.prepare("SELECT COUNT(*) AS n FROM jobs WHERE status IN ('queued','awaiting')").first();
        if ((pending?.n || 0) >= MAX_QUEUED) return fail(429, 'Queue is full.');
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO jobs (id, ckey, status, prompt, aspect, seconds, mime, created, updated) VALUES (?, ?, 'awaiting', ?, ?, ?, ?, ?, ?)").bind(id, ckey, prompt, aspect, seconds, mime, now, now).run();
        return json({ ok: true, id, status: 'awaiting', created: now, updated: now }, 201);
      }

      if (parts[0] === 'jobs' && parts[1]) {
        const id = parts[1];
        if (!/^[\w\-]{8,64}$/.test(id)) return fail(400, 'Bad id.');
        const row = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first();
        if (!row) return fail(404, 'Not found.');
        const sub = parts[2];

        if (!sub && request.method === 'GET') return json({ ok: true, ...view(row) });

        if (!sub && request.method === 'DELETE') {
          if (role !== 'app') return fail(403, 'Forbidden.');
          await env.DB.prepare('DELETE FROM jobs WHERE id = ?').bind(id).run();
          await Promise.all([env.BLOBS.delete(`img:${id}`), env.BLOBS.delete(`vid:${id}`)]);
          return json({ ok: true });
        }

        if (sub === 'image' && request.method === 'PUT') {
          if (role !== 'app') return fail(403, 'Forbidden.');
          if (row.status !== 'awaiting') return fail(409, 'Image already uploaded.');
          const bytes = await request.arrayBuffer();
          if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE) return fail(413, 'Image size is invalid.');
          await env.BLOBS.put(`img:${id}`, bytes, { expirationTtl: TTL });
          await env.DB.prepare("UPDATE jobs SET status = 'queued', updated = ? WHERE id = ?").bind(now, id).run();
          return json({ ok: true, id, status: 'queued' });
        }

        if (sub === 'image' && request.method === 'GET') {
          if (role !== 'worker') return fail(403, 'Forbidden.');
          const data = await env.BLOBS.get(`img:${id}`, 'arrayBuffer');
          if (!data) return fail(404, 'Image expired.');
          return new Response(data, { headers: { ...CORS, 'content-type': row.mime || 'image/png', 'cache-control': 'no-store' } });
        }

        if (sub === 'video' && request.method === 'PUT') {
          if (role !== 'worker') return fail(403, 'Forbidden.');
          if (row.status !== 'running') return fail(409, 'Job is not running.');
          const bytes = await request.arrayBuffer();
          if (!bytes.byteLength || bytes.byteLength > MAX_VIDEO) return fail(413, 'Video size is invalid.');
          const vmime = (request.headers.get('content-type') || 'video/mp4').split(';')[0].trim();
          await env.BLOBS.put(`vid:${id}`, bytes, { expirationTtl: TTL });
          await env.DB.prepare("UPDATE jobs SET status = 'done', vmime = ?, error = NULL, updated = ? WHERE id = ?").bind(/^video\//.test(vmime) ? vmime : 'video/mp4', now, id).run();
          return json({ ok: true, id, status: 'done' });
        }

        if (sub === 'video' && request.method === 'GET') {
          if (role !== 'app') return fail(403, 'Forbidden.');
          if (row.status !== 'done') return fail(409, 'Video is not ready.');
          const data = await env.BLOBS.get(`vid:${id}`, 'arrayBuffer');
          if (!data) return fail(404, 'Video expired.');
          return new Response(data, { headers: { ...CORS, 'content-type': row.vmime || 'video/mp4', 'cache-control': 'no-store' } });
        }

        if (sub === 'fail' && request.method === 'POST') {
          if (role !== 'worker') return fail(403, 'Forbidden.');
          let body = {};
          try {
            body = await request.json();
          } catch {
            // ignore
          }
          const error = typeof body?.error === 'string' ? body.error.slice(0, 500) : 'Generation failed.';
          await env.DB.prepare("UPDATE jobs SET status = 'error', error = ?, updated = ? WHERE id = ?").bind(error, now, id).run();
          return json({ ok: true, id, status: 'error' });
        }
      }

      if (path === '/claim' && request.method === 'POST') {
        if (role !== 'worker') return fail(403, 'Forbidden.');
        await touchWorker(env);
        const job = await env.DB.prepare(
          "UPDATE jobs SET status = 'running', claimed = ?1, updated = ?1 WHERE id = (SELECT id FROM jobs WHERE status = 'queued' OR (status = 'running' AND claimed < ?2) ORDER BY created LIMIT 1) RETURNING id, prompt, aspect, seconds, mime"
        )
          .bind(now, now - STALE_MS)
          .first();
        if (!job) return new Response(null, { status: 204, headers: CORS });
        return json({ ok: true, job });
      }

      return fail(404, 'Unknown route.');
    } catch (err) {
      return fail(500, String(err?.message || err).slice(0, 200));
    }
  },
};
