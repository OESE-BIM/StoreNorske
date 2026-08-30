const wrap = require('../shared/wrap');
const { client, ensure, rowKey, split, join, projectOf } = require('../shared/table');

module.exports = wrap(async function (context, req) {
  const project = projectOf(req);
  const c = client();
  await ensure(c);

  if (req.method === 'GET') {
    const wanted = req.query && req.query.version;
    if (wanted) {
      try {
        const e = await c.getEntity(project, wanted);
        context.res = ok({ project, version: e.rowKey, savedAt: e.savedAt, by: e.by, data: JSON.parse(join(e)) });
      } catch (err) { context.res = { status: 404, body: { error: 'Versjonen finnes ikke' } }; }
      return;
    }
    /* nyeste versjon */
    const it = c.listEntities({ queryOptions: { filter: `PartitionKey eq '${project}'` } });
    for await (const e of it) {
      context.res = ok({ project, version: e.rowKey, savedAt: e.savedAt, by: e.by, data: JSON.parse(join(e)) });
      return;
    }
    context.res = ok({ project, version: null, data: null });
    return;
  }

  /* PUT — legger til en ny versjon, overskriver aldri */
  const body = req.body || {};
  if (!body.data || typeof body.data !== 'object') {
    context.res = { status: 400, body: { error: 'Mangler data' } };
    return;
  }
  const now = new Date();
  const entity = Object.assign({
    partitionKey: project,
    rowKey: rowKey(now),
    savedAt: now.toISOString(),
    by: String(body.by || '').slice(0, 120),
    note: String(body.note || '').slice(0, 400),
    deleted: false
  }, split(JSON.stringify(body.data)));

  await c.createEntity(entity);
  context.res = ok({ project, version: entity.rowKey, savedAt: entity.savedAt, by: entity.by });
});

function ok(payload) {
  return { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: payload };
}
