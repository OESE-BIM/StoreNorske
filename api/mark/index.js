const wrap = require('../shared/wrap');
const { client, ensure, projectOf } = require('../shared/table');

/* Markerer en versjon som slettet. Raden blir liggende — ingenting fjernes fysisk. */
module.exports = wrap(async function (context, req) {
  const project = projectOf(req);
  const body = req.body || {};
  if (!body.version) {
    context.res = { status: 400, body: { error: 'Mangler version' } };
    return;
  }
  const c = client();
  await ensure(c);
  try {
    await c.updateEntity({
      partitionKey: project,
      rowKey: String(body.version),
      deleted: body.deleted === false ? false : true,
      deletedBy: String(body.by || '').slice(0, 120),
      deletedAt: new Date().toISOString()
    }, 'Merge');
    context.res = { status: 200, body: { project, version: body.version, deleted: body.deleted !== false } };
  } catch (e) {
    context.res = { status: 404, body: { error: 'Versjonen finnes ikke' } };
  }
});
