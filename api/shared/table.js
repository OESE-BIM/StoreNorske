const { TableClient } = require('@azure/data-tables');

const TABLE = 'MmiState';
const CHUNK = 30000; // Table Storage tåler 64 KB per felt — vi holder god margin

function client() {
  const cs = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!cs) throw new Error('AZURE_STORAGE_CONNECTION_STRING mangler');
  return TableClient.fromConnectionString(cs, TABLE, { allowInsecureConnection: false });
}

async function ensure(c) {
  try { await c.createTable(); } catch (e) { /* finnes allerede */ }
}

/* Nyeste først: RowKey er synkende, så listen kommer i riktig rekkefølge uten sortering */
function rowKey(now) {
  const inv = 9999999999999 - now.getTime();
  return String(inv).padStart(13, '0');
}

function split(text) {
  const parts = {};
  for (let i = 0, n = 0; i < text.length; i += CHUNK, n++) {
    parts['payload' + n] = text.slice(i, i + CHUNK);
  }
  parts.chunks = Object.keys(parts).length;
  return parts;
}

function join(entity) {
  let out = '';
  for (let i = 0; i < (entity.chunks || 0); i++) out += entity['payload' + i] || '';
  return out;
}

function projectOf(req) {
  const p = (req.query && req.query.project) || (req.body && req.body.project) || 'default';
  return String(p).replace(/[\\/#?\t\n\r]/g, '-').slice(0, 200) || 'default';
}

module.exports = { client, ensure, rowKey, split, join, projectOf, TABLE };
