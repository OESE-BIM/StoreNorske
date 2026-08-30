const wrap = require('../shared/wrap');
const { projectOf, historyOf } = require('../shared/gh');

module.exports = wrap(async function (context, req) {
  const project = projectOf(req);
  const limit = Math.min(Number(req.query && req.query.limit) || 50, 100);
  const versjoner = await historyOf(project, limit);
  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: { project, versjoner }
  };
});
