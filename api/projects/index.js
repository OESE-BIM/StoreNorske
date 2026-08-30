const { client, ensure } = require('../shared/table');

module.exports = async function (context, req) {
  const c = client();
  await ensure(c);
  const seen = {};
  const it = c.listEntities({ queryOptions: { select: ['PartitionKey', 'RowKey', 'savedAt', 'by'] } });
  for await (const e of it) {
    if (!seen[e.partitionKey]) seen[e.partitionKey] = { project: e.partitionKey, sisteVersjon: e.rowKey, savedAt: e.savedAt, by: e.by, versjoner: 0 };
    seen[e.partitionKey].versjoner++;
  }
  context.res = { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: { prosjekter: Object.values(seen) } };
};
