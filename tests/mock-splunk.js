// A small stand-in for Splunk Web, for fast, repeatable browser tests of the app.
//
//   node tests/mock-splunk.js <extracted app folder> [port]
//
// It serves the app's static files at Splunk's paths (adding the i18n_register call Splunk Web adds
// to every app script), a host dashboard that loads inventory_host.js, and REST answers for the calls
// the page makes. Every response carries a strict Content-Security-Policy, like Splunk Cloud.
// Deliberate differences from a happy path: /admin/ paths return 404 (Splunk Web blocks them), the
// data model list returns 403, and one lookup the sample dashboard reads does not exist.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const ROOT = path.join(__dirname, '..');
const APPDIR = path.resolve(process.argv[2] || ''), PORT = +process.argv[3] || 8765, APP = 'licoryx_dashboard_inventory';
if (!fs.existsSync(path.join(APPDIR, 'appserver', 'static'))) { console.error('usage: node tests/mock-splunk.js <extracted app folder> [port]'); process.exit(2); }

const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sample = page.match(/<script id="sample" type="application\/json">([\s\S]*?)<\/script>/)[1].trim();
const sampleConf = page.match(/<script id="sample-conf" type="text\/plain">([\s\S]*?)<\/script>/)[1].trim();
const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const VIEWS = [
  { app: 'search', name: 'web_ops', label: 'Web Operations Overview', version: '2', owner: 'nobody', data: `<dashboard version="2" theme="light"><label>Web Operations Overview</label><definition><![CDATA[${sample}]]></definition></dashboard>` },
  { app: 'search', name: 'web_sla_detail', label: 'Web SLA detail', version: '2', owner: 'admin', data: `<dashboard version="2"><label>Web SLA detail</label><definition><![CDATA[${fixture('web_sla_detail.json')}]]></definition></dashboard>` },
  { app: 'search', name: 'classic_errors', label: 'Classic Web Errors', owner: 'admin', data: fixture('classic_errors.xml') },
  { app: 'ops', name: 'ops_home', label: 'Ops home', version: '2', owner: 'ops_lead', data: `<dashboard version="2"><label>Ops home</label><definition><![CDATA[${fixture('web_sla_detail.json').replace('Web SLA detail', 'Ops home')}]]></definition></dashboard>` },
];
const APPS = [
  { name: 'search', content: { label: 'Search & Reporting', visible: true } },
  { name: 'ops', content: { label: 'Operations', visible: true } },
  { name: APP, content: { label: 'Licoryx Dashboard Inventory', visible: true } },
  { name: 'hidden_ta', content: { label: 'Hidden TA', visible: false } },
];
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'";
const CSRF = 'mock-csrf-token';
const log = [];

const viewEntry = v => ({ name: v.name, author: v.owner, updated: '2026-11-01T09:30:00+00:00', acl: { app: v.app, owner: v.owner, sharing: 'app', perms: { read: ['*'], write: ['admin', 'power'] } }, content: { label: v.label, ...(v.version === '2' ? { version: '2' } : {}), isDashboard: true, rootNode: v.version === '2' ? 'dashboard' : 'form' } });
// [stanza] conf text -> REST-like entries
const confEntries = (text, kind) => {
  const out = []; let cur = null;
  for (const line of text.split('\n')) {
    const st = line.match(/^\[(.+)\]$/); if (st) { cur = { name: st[1], content: {} }; out.push(cur); continue; }
    const kv = line.match(/^(\S+)\s*=\s*(.*)$/); if (kv && cur) cur.content[kv[1]] = kv[2];
  }
  return out.filter(e => kind === 'macros' ? 'definition' in e.content : 'search' in e.content).map(e => ({ ...e, acl: { app: 'search' } }));
};
const send = (res, status, type, body) => { res.writeHead(status, { 'Content-Type': type, 'Content-Security-Policy': CSP }); res.end(body); };
const json = (res, obj, status = 200) => send(res, status, 'application/json', JSON.stringify(obj));

http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  log.push(`${req.method} ${u.pathname}${req.headers['x-requested-with'] ? ' [xhr]' : ''}`);
  if (u.pathname === '/__log') return json(res, log);
  if (u.pathname === '/en-US/app/' + APP + '/inventory')
    return send(res, 200, 'text/html', `<!doctype html><html><head><title>Licoryx Dashboard Inventory | Splunk</title><link rel="stylesheet" href="/en-US/static/app/${APP}/inventory_host.css"></head><body style="margin:0"><header style="height:80px;background:#1a1c20;color:#fff">Splunk app bar</header><div class="dashboard-panel"><div id="sdi-host" class="sdi-host">Loading…</div></div><script src="/en-US/static/js/i18n.js"></script><script src="/en-US/static/app/${APP}/inventory_host.js"></script></body></html>`);
  if (u.pathname === '/en-US/static/js/i18n.js') {
    // Splunk Web sets its CSRF cookie on its pages; the page sends it back as X-Splunk-Form-Key on POSTs.
    res.setHeader('Set-Cookie', `splunkweb_csrf_token_8000=${CSRF}; Path=/`);
    return send(res, 200, 'application/javascript', 'window.i18n_register = function () {};');
  }
  const st = u.pathname.match(new RegExp(`^/en-US/static/app/${APP}/(.+)$`));
  if (st) {
    const base = path.join(APPDIR, 'appserver', 'static'), f = path.join(base, st[1]);
    if (!f.startsWith(base + path.sep) || !fs.existsSync(f)) return send(res, 404, 'text/plain', 'not found');
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.md': 'text/plain', '.txt': 'text/plain' }[path.extname(f)] || 'application/octet-stream';
    // Like Splunk Web, prepend an i18n_register call to every .js file
    const body = path.extname(f) === '.js' ? Buffer.concat([Buffer.from('// Translations for en_US\ni18n_register({"plural": function(n) { return n == 1 ? 0 : 1; }, "catalog": {}});\n\n\n'), fs.readFileSync(f)]) : fs.readFileSync(f);
    return send(res, 200, type, body);
  }

  const api = u.pathname.replace(/^\/en-US\/splunkd\/__raw/, '');
  if (api === u.pathname) return send(res, 404, 'text/plain', 'not found');
  if (/\/admin\//.test(api)) return send(res, 404, 'application/json', '{}'); // Splunk Web does not pass /admin/
  if (req.method === 'POST' && api === '/services/search/jobs') {
    if (req.headers['x-splunk-form-key'] !== CSRF) return json(res, { messages: [{ type: 'ERROR', text: 'CSRF validation failed' }] }, 401);
    let body = ''; req.on('data', c => { body += c; });
    return req.on('end', () => {
      const q = new URLSearchParams(body);
      if (q.get('exec_mode') !== 'oneshot' || !/splunk_web_access/.test(q.get('search') || '')) return json(res, { messages: [{ type: 'ERROR', text: 'unexpected search' }] }, 400);
      json(res, { results: [{ app: 'search', view: 'web_ops', views: '42', users: '7', last: '1795000000' }, { app: 'search', view: 'classic_errors', views: '3', users: '1', last: '1794000000' }] });
    });
  }
  if (req.method !== 'GET') return send(res, 405, 'text/plain', 'method not allowed');
  if (api === '/services/apps/local') return json(res, { entry: APPS });
  if (api === '/services/data/user-prefs/general') return json(res, { entry: [{ name: 'general', content: { theme: process.env.MOCK_THEME || 'dark' } }] });
  if (api === '/services/data/indexes') return json(res, { entry: ['main', '_internal', '_audit', 'web'].map(name => ({ name })) });
  const list = api.match(/^\/servicesNS\/-\/([^/]+)\/data\/ui\/views$/);
  if (list) return json(res, { entry: VIEWS.filter(v => list[1] === '-' || v.app === list[1]).map(viewEntry).concat(list[1] === 'search' ? [{ name: 'other_app_view', acl: { app: 'other' }, content: { label: 'Elsewhere', isDashboard: true } }] : [])
    // an HTML page that Splunk also marks isDashboard: must not be offered
    .concat([{ name: 'html_page', acl: { app: 'search', sharing: 'app' }, content: { label: 'An HTML page', isDashboard: true, rootNode: 'view' } }]) });
  const one = api.match(/^\/servicesNS\/-\/([^/]+)\/data\/ui\/views\/(.+)$/);
  if (one) { const v = VIEWS.find(x => x.app === one[1] && x.name === decodeURIComponent(one[2])); return v ? json(res, { entry: [{ name: v.name, content: { 'eai:data': v.data } }] }) : json(res, {}, 404); }
  const ns = api.match(/^\/servicesNS\/-\/([^/]+)\/(.+)$/);
  if (ns) {
    const [, , rest] = ns;
    if (rest === 'configs/conf-macros') return json(res, { entry: confEntries(sampleConf, 'macros') });
    if (rest === 'saved/searches') return json(res, { entry: confEntries(sampleConf, 'saved') });
    if (rest === 'datamodel/model') return json(res, { messages: [{ type: 'ERROR', text: 'forbidden' }] }, 403);
    if (rest === 'data/transforms/lookups') return json(res, { entry: [{ name: 'http_status' }] });
    if (rest === 'data/lookup-table-files') return json(res, { entry: [{ name: 'http_status.csv' }] }); // uri_owners.csv is missing on purpose
  }
  send(res, 404, 'text/plain', 'not found');
}).listen(PORT, '127.0.0.1', () => console.log('mock Splunk Web on http://127.0.0.1:' + PORT));
