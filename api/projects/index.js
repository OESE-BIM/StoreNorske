const wrap = require('../shared/wrap');
const { listProjects, cfg } = require('../shared/gh');

module.exports = wrap(async function (context, req) {
  const c = cfg();
  const prosjekter = await listProjects();
  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: { lager: c.repo + '/' + c.prefix + ' (' + c.branch + ')', prosjekter }
  };
});
