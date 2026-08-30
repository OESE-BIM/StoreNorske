const wrap = require('../shared/wrap');
const { projectOf } = require('../shared/gh');

/* Nærvær holdes i minnet på funksjonsverten. Det er bevisst: å skrive et livstegn
   hvert 30. sekund til git ville gitt hundrevis av meningsløse commits.
   Konsekvensen er at lista kan bli ufullstendig hvis verten skalerer til flere
   instanser, og at den nullstilles ved kaldstart. Nærvær er pynt — det tåler det. */
const WINDOW_MS = 90000;
const rooms = new Map();

module.exports = wrap(async function (context, req) {
  const project = projectOf(req);
  if (!rooms.has(project)) rooms.set(project, new Map());
  const room = rooms.get(project);

  if (req.method === 'POST') {
    const b = req.body || {};
    const id = String(b.id || '').slice(0, 80);
    if (!id) { context.res = { status: 400, body: { error: 'Mangler id' } }; return; }
    room.set(id, { who: String(b.who || '').slice(0, 120), seenAt: Date.now() });
  }

  const cutoff = Date.now() - WINDOW_MS;
  for (const [k, v] of room) if (v.seenAt < cutoff) room.delete(k);

  const here = [...room.entries()]
    .map(([id, v]) => ({ id, who: v.who, seenAt: new Date(v.seenAt).toISOString() }))
    .sort((a, b) => (a.who || '').localeCompare(b.who || ''));

  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: { project, here }
  };
});
