// اختبار تكاملي للطابور: node test-queue.mjs <url> <appToken> <workerToken>
const [base = 'http://localhost:8788', APP = 'aaaaaaaaaaaaaaaaaaaa', WRK = 'bbbbbbbbbbbbbbbbbbbb'] = process.argv.slice(2);
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' ' + extra}`);
};
const call = async (method, path, key, body, headers = {}) => {
  const res = await fetch(base + path, { method, headers: { ...(key ? { 'x-sawan-key': key } : {}), ...headers }, body });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : res.status === 204 ? null : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data, type };
};
const j = (o) => JSON.stringify(o);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(200000, 7)]);

ok('health open', (await call('GET', '/health')).data?.ok === true);
ok('no key → 401', (await call('GET', '/status')).status === 401);
ok('bad key → 401', (await call('GET', '/status', 'x'.repeat(20))).status === 401);

const created = await call('POST', '/jobs', APP, j({ key: 'story1:3:1', prompt: 'A cat waves', aspect: '16:9', seconds: 5, mime: 'image/png' }), { 'content-type': 'application/json' });
ok('create job 201', created.status === 201 && created.data.status === 'awaiting', JSON.stringify(created.data));
const id = created.data.id;
ok('worker cannot create', (await call('POST', '/jobs', WRK, j({ prompt: 'x', aspect: '16:9', mime: 'image/png' }), { 'content-type': 'application/json' })).status === 403);
ok('invalid aspect → 400', (await call('POST', '/jobs', APP, j({ prompt: 'x', aspect: '1:1', mime: 'image/png' }))).status === 400);

ok('claim before image → none', (await call('POST', '/claim', WRK)).status === 204);
ok('idempotent key', (await call('POST', '/jobs', APP, j({ key: 'story1:3:1', prompt: 'A cat waves', aspect: '16:9', mime: 'image/png' }))).data.id === id);
ok('upload image', (await call('PUT', `/jobs/${id}/image`, APP, png, { 'content-type': 'image/png' })).data?.status === 'queued');
ok('second image upload → 409', (await call('PUT', `/jobs/${id}/image`, APP, png)).status === 409);
ok('status counts queued', (await call('GET', '/status', APP)).data.queued === 1);
ok('app cannot claim', (await call('POST', '/claim', APP)).status === 403);

const claim = await call('POST', '/claim', WRK);
ok('claim returns job', claim.status === 200 && claim.data.job.id === id && claim.data.job.prompt === 'A cat waves' && claim.data.job.seconds === 5, JSON.stringify(claim.data));
ok('claim twice → none', (await call('POST', '/claim', WRK)).status === 204);
ok('status running + worker seen', (await call('GET', '/status', APP)).data.running === 1 && (await call('GET', '/status', APP)).data.workerSeenSeconds !== null);
const img = await call('GET', `/jobs/${id}/image`, WRK);
ok('worker downloads image', img.status === 200 && img.type.includes('image/png') && img.data.equals(png));
ok('app cannot read image', (await call('GET', `/jobs/${id}/image`, APP)).status === 403);
ok('video not ready → 409', (await call('GET', `/jobs/${id}/video`, APP)).status === 409);
ok('upload video', (await call('PUT', `/jobs/${id}/video`, WRK, mp4, { 'content-type': 'video/mp4' })).data?.status === 'done');
ok('status done', (await call('GET', `/jobs/${id}`, APP)).data.status === 'done');
const vid = await call('GET', `/jobs/${id}/video`, APP);
ok('app downloads video intact', vid.status === 200 && vid.type.includes('video/mp4') && vid.data.equals(mp4));

const j2 = (await call('POST', '/jobs', APP, j({ key: 'story1:4:1', prompt: 'A dog runs', aspect: '9:16', mime: 'image/webp' }))).data;
await call('PUT', `/jobs/${j2.id}/image`, APP, png);
const c2 = await call('POST', '/claim', WRK);
ok('second job claimed', c2.data?.job?.id === j2.id && c2.data.job.aspect === '9:16');
await call('POST', `/jobs/${j2.id}/fail`, WRK, j({ error: 'CUDA out of memory' }));
const s2 = await call('GET', `/jobs/${j2.id}`, APP);
ok('failure recorded', s2.data.status === 'error' && s2.data.error === 'CUDA out of memory');
const retry = await call('POST', '/jobs', APP, j({ key: 'story1:4:1', prompt: 'A dog runs', aspect: '9:16', mime: 'image/webp' }));
ok('failed key can be re-queued as new job', retry.status === 201 && retry.data.id !== j2.id);

ok('delete job', (await call('DELETE', `/jobs/${id}`, APP)).data?.ok === true && (await call('GET', `/jobs/${id}`, APP)).status === 404);
ok('CORS preflight', (await fetch(base + '/jobs', { method: 'OPTIONS' })).headers.get('access-control-allow-headers')?.includes('x-sawan-key'));
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
