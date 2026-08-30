/* GitHub som lager: hver lagring er en commit, og historikken er git-historikken. */

const API = 'https://api.github.com';

function cfg() {
  const token = process.env.MMI_GITHUB_TOKEN;
  if (!token) throw new Error('MMI_GITHUB_TOKEN mangler i appens miljøvariabler');
  return {
    token,
    repo: process.env.MMI_REPO || 'OESE-BIM/StoreNorske',
    branch: process.env.MMI_BRANCH || 'main',
    prefix: (process.env.MMI_PATH_PREFIX || 'data/mmi').replace(/^\/+|\/+$/g, '')
  };
}

async function gh(path, opts) {
  const c = cfg();
  const o = opts || {};
  const r = await fetch(API + path, {
    method: o.method || 'GET',
    body: o.body,
    headers: {
      Authorization: 'Bearer ' + c.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'mmi-konsoll',
      'Content-Type': 'application/json'
    }
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = { raw: text }; }
  if (!r.ok) {
    const err = new Error((body && body.message) || ('GitHub svarte ' + r.status));
    err.status = r.status;
    throw err;
  }
  return body;
}

function projectOf(req) {
  const p = (req.query && req.query.project) || (req.body && req.body.project) || 'default';
  /* filnavn — bare trygge tegn */
  return String(p).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '').slice(0, 100) || 'default';
}

function fileFor(project) { return cfg().prefix + '/' + project + '.json'; }

/* Forfatter, notat og innholdstall legges i commit-meldingens andre avsnitt,
   slik at historikklista kan bygges fra commit-lista alene — uten å hente hver fil. */
function buildMessage(project, by, note, n) {
  const head = 'MMI ' + project + ': ' + (note || 'automatisk lagring');
  return head + '\n\n' + JSON.stringify({ by: by || '', note: note || '', n: n || {} });
}

function parseMessage(msg) {
  const s = String(msg || '');
  const i = s.indexOf('\n\n');
  if (i >= 0) {
    try {
      const o = JSON.parse(s.slice(i + 2));
      return { by: o.by || '', note: o.note || '', n: o.n || {} };
    } catch (e) { /* eldre commit uten metadata */ }
  }
  return { by: '', note: '', n: {} };
}

function counts(data) {
  const d = data || {};
  return {
    objekter: (d.extra || []).length,
    avhengigheter: (d.links || []).length,
    mmiVerdier: Object.keys(d.cpEdits || {}).length,
    delprosjekter: (d.extraSp || []).length
  };
}

/* Siste commit som rørte prosjektfila. null når fila ikke finnes ennå. */
async function head(project) {
  const c = cfg();
  const q = '/repos/' + c.repo + '/commits?path=' + encodeURIComponent(fileFor(project)) +
    '&sha=' + encodeURIComponent(c.branch) + '&per_page=1';
  const list = await gh(q);
  if (!list || !list.length) return null;
  const k = list[0];
  const m = parseMessage(k.commit && k.commit.message);
  return { version: k.sha, savedAt: (k.commit && k.commit.committer && k.commit.committer.date) || null, by: m.by, note: m.note, n: m.n };
}

async function readAt(project, ref) {
  const c = cfg();
  const q = '/repos/' + c.repo + '/contents/' + encodeURIComponent(fileFor(project)).replace(/%2F/g, '/') +
    '?ref=' + encodeURIComponent(ref || c.branch);
  const f = await gh(q);
  const raw = Buffer.from(f.content || '', f.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
  const wrapped = JSON.parse(raw);
  return { blobSha: f.sha, wrapped };
}

async function write(project, data, by, note) {
  const c = cfg();
  let sha = null;
  try { sha = (await readAt(project, c.branch)).blobSha; } catch (e) { if (e.status !== 404) throw e; }
  const savedAt = new Date().toISOString();
  const payload = JSON.stringify({ savedAt, by: by || '', note: note || '', data }, null, 1);
  const q = '/repos/' + c.repo + '/contents/' + encodeURIComponent(fileFor(project)).replace(/%2F/g, '/');
  const res = await gh(q, {
    method: 'PUT',
    body: JSON.stringify({
      message: buildMessage(project, by, note, counts(data)),
      content: Buffer.from(payload, 'utf8').toString('base64'),
      branch: c.branch,
      sha: sha || undefined
    })
  });
  return { version: (res.commit && res.commit.sha) || null, savedAt, by: by || '', note: note || '' };
}

async function historyOf(project, limit) {
  const c = cfg();
  const q = '/repos/' + c.repo + '/commits?path=' + encodeURIComponent(fileFor(project)) +
    '&sha=' + encodeURIComponent(c.branch) + '&per_page=' + Math.min(Math.max(limit, 1), 100);
  const list = await gh(q);
  return (list || []).map(k => {
    const m = parseMessage(k.commit && k.commit.message);
    return {
      version: k.sha,
      savedAt: (k.commit && k.commit.committer && k.commit.committer.date) || null,
      by: m.by,
      note: m.note,
      deleted: false,
      innhold: m.n
    };
  });
}

async function listProjects() {
  const c = cfg();
  try {
    const dir = await gh('/repos/' + c.repo + '/contents/' + c.prefix + '?ref=' + encodeURIComponent(c.branch));
    return (dir || []).filter(f => f.type === 'file' && /\.json$/.test(f.name))
      .map(f => ({ project: f.name.replace(/\.json$/, ''), bytes: f.size }));
  } catch (e) {
    if (e.status === 404) return [];
    throw e;
  }
}

module.exports = { cfg, projectOf, fileFor, head, readAt, write, historyOf, listProjects, counts };
