const { TableClient } = require('@azure/data-tables');
const { projectOf } = require('../shared/table');

const TABLE = 'MmiPresence';
const WINDOW_MS = 90000; /* hvor lenge en person regnes som inne etter siste livstegn */

function client() {
  const cs = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!cs) throw new Error('AZURE_STORAGE_CONNECTION_STRING mangler');
  return TableClient.fromConnectionString(cs, TABLE);
}

module.exports = async function (context, req) {
  const project = projectOf(req);
  const c = client();
  try { await c.createTable(); } catch (e) { /* finnes allerede */ }

  if (req.method === 'POST') {
    const body = req.body || {};
    const id = String(body.id || '').replace(/[\\/#?\t\n\r]/g, '-').slice(0, 80);
    if (!id) { context.res = { status: 400, body: { error: 'Mangler id' } }; return; }
    await c.upsertEntity({
      partitionKey: project,
      rowKey: id,
      who: String(body.who || '').slice(0, 120),
      seenAt: new Date().toISOString()
    }, 'Replace');
  }

  const cutoff = Date.now() - WINDOW_MS;
  const here = [];
  const stale = [];
  const it = c.listEntities({ queryOptions: { filter: `PartitionKey eq '${project}'` } });
  for await (const e of it) {
    if (new Date(e.seenAt).getTime() >= cutoff) here.push({ id: e.rowKey, who: e.who || '', seenAt: e.seenAt });
    else stale.push(e.rowKey);
  }
  /* rydder gamle rader så tabellen ikke vokser i det uendelige */
  for (const k of stale.slice(0, 20)) {
    try { await c.deleteEntity(project, k); } catch (e) { /* allerede borte */ }
  }

  here.sort((a, b) => (a.who || '').localeCompare(b.who || ''));
  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: { project, here }
  };
};
