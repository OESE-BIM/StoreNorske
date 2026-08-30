const wrap = require('../shared/wrap');
const { projectOf, head, readAt, write } = require('../shared/gh');

function ok(payload) {
  return { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: payload };
}

module.exports = wrap(async function (context, req) {
  const project = projectOf(req);

  if (req.method === 'GET') {
    const wanted = req.query && req.query.version;
    if (wanted) {
      try {
        const r = await readAt(project, wanted);
        const w = r.wrapped || {};
        context.res = ok({ project, version: wanted, savedAt: w.savedAt || null, by: w.by || '', note: w.note || '', data: w.data || null });
      } catch (e) {
        context.res = { status: 404, body: { error: 'Versjonen finnes ikke' } };
      }
      return;
    }

    const h = await head(project);
    if (!h) { context.res = ok({ project, version: null, data: null }); return; }

    /* ?head=1 — bare metadata. Konsollen poller med denne, så vi sparer et kall per runde. */
    if (req.query && req.query.head) {
      context.res = ok({ project, version: h.version, savedAt: h.savedAt, by: h.by, note: h.note });
      return;
    }

    const r = await readAt(project, h.version);
    const w = r.wrapped || {};
    context.res = ok({ project, version: h.version, savedAt: w.savedAt || h.savedAt, by: w.by || h.by, note: w.note || h.note, data: w.data || null });
    return;
  }

  const body = req.body || {};
  if (!body.data || typeof body.data !== 'object') {
    context.res = { status: 400, body: { error: 'Mangler data' } };
    return;
  }
  const res = await write(project, body.data, body.by, body.note);
  context.res = ok(Object.assign({ project }, res));
});
