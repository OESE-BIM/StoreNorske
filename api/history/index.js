const { client, ensure, join, projectOf } = require('../shared/table');

module.exports = async function (context, req) {
  const project = projectOf(req);
  const limit = Math.min(Number(req.query && req.query.limit) || 50, 200);
  const c = client();
  await ensure(c);

  const rows = [];
  const it = c.listEntities({ queryOptions: { filter: `PartitionKey eq '${project}'` } });
  for await (const e of it) {
    const text = join(e);
    let n = {};
    try {
      const d = JSON.parse(text);
      n = {
        objekter: (d.extra || []).length,
        avhengigheter: (d.links || []).length,
        mmiVerdier: Object.keys(d.cpEdits || {}).length,
        delprosjekter: (d.extraSp || []).length
      };
    } catch (err) { /* hopp over */ }
    rows.push({ version: e.rowKey, savedAt: e.savedAt, by: e.by, note: e.note, deleted: !!e.deleted, bytes: text.length, innhold: n });
    if (rows.length >= limit) break;
  }
  context.res = { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: { project, versjoner: rows } };
};
