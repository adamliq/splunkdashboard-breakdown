// Browser test of the Splunk app, against the stand-in (tests/mock-splunk.js) or a real Splunk.
//
//   node tests/e2e.js                                   # stand-in on http://127.0.0.1:8765
//   SPLUNK_URL=http://127.0.0.1:8000 SPLUNK_PASSWORD=… node tests/e2e.js   # real Splunk, seeded by tests/seed-splunk.py
//
// OUT=<folder> keeps screenshots and downloads (default: tests/out). Exits non-zero on the first failure.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const REAL = !!process.env.SPLUNK_URL;
const BASE = (process.env.SPLUNK_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const OUT = process.env.OUT || path.join(__dirname, 'out');
const APP = 'licoryx_dashboard_inventory';
const VERSION = fs.readFileSync(path.join(__dirname, '..', 'splunk-app', 'src', APP, 'default', 'app.conf'), 'utf8').match(/^version = (.+)$/m)[1];
fs.mkdirSync(OUT, { recursive: true });

let step = '';
const ok = (cond, what, detail = '') => { if (!cond) throw new Error(`${what}${detail ? ': ' + detail : ''}`); console.log('  ✓ ' + what + (detail ? ` (${detail})` : '')); };
const section = s => { step = s; console.log(s); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const appRequests = [], external = [], errors = [], csp = [];
  // Only requests made by the app's own frame count: Splunk's pages make their own.
  ctx.on('request', r => {
    let inApp = false;
    try { inApp = /\/static\/app\/licoryx_dashboard_inventory\/inventory\.html/.test(r.frame().url()); } catch { /* worker */ }
    if (!inApp) return;
    const u = r.url();
    if (!u.startsWith(BASE) && !/^(blob|data|about):/.test(u)) external.push(u);
    if (u.includes('/splunkd/__raw')) appRequests.push(`${r.method()} ${u.replace(/^.*__raw/, '').split('?')[0]}`);
  });
  ctx.on('console', m => {
    if (m.type() !== 'error') return;
    if (/Content.Security.Policy/i.test(m.text())) csp.push(m.text());
    // Errors raised by the app's own code (Splunk's pages log their own; failed requests are checked separately)
    else if (/licoryx_dashboard_inventory\/(inventory|lib)/.test(m.location().url || '') && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', e => errors.push('page error: ' + e.message));

  section('Open the app');
  if (REAL) {
    await page.goto(BASE + '/en-US/account/login');
    await page.fill('input[name=username]', process.env.SPLUNK_USER || 'admin');
    await page.fill('input[name=password]', process.env.SPLUNK_PASSWORD || '');
    await page.click('input[type=submit], button[type=submit]');
    await page.waitForURL(/\/app\//, { timeout: 60000 });
  }
  await page.goto(`${BASE}/en-US/app/${APP}/inventory`);
  const frameEl = await page.waitForSelector('iframe.sdi-frame', { timeout: 60000 });
  const f = await frameEl.contentFrame();
  await f.waitForSelector('#splunk-loader:not([hidden]) .sp-item', { timeout: 60000 });
  ok(await f.$eval('.topbar', el => getComputedStyle(el).display === 'none'), 'the page heading is hidden inside Splunk while choosing dashboards');
  ok((await f.$eval('.app-version', e => e.textContent)) === `Licoryx Dashboard Inventory ${VERSION}`, 'the version is shown', VERSION);
  if (!REAL) ok(await f.evaluate(() => document.documentElement.dataset.theme) === 'dark', "the page follows the viewer's Splunk theme (dark)");
  const apps = await f.$$eval('#sp-app option', o => o.map(x => x.value));
  ok(apps[0] === '-' && apps.includes('search') && !apps.includes('hidden_ta'), 'apps listed, with All apps first and hidden apps left out', `${apps.length - 1} apps`);
  ok(await f.$eval('#sp-app', s => s.value) === 'search', 'Search & Reporting is chosen by default');
  const items = await f.$$eval('#splunk-loader [data-spview]', x => x.map(i => i.dataset.spview));
  ok(['search/web_ops', 'search/web_sla_detail', 'search/classic_errors'].every(k => items.includes(k)) && !items.some(k => !k.startsWith('search/')), 'the test dashboards are listed, from this app only');
  ok(!items.includes('search/html_page'), 'HTML and framework pages are not offered as dashboards');
  const classic = await f.$eval('#splunk-loader [data-spview="search/classic_errors"]', i => i.closest('.sp-item').innerText);
  ok(/Classic/.test(classic), 'Classic dashboards are labelled', classic.replace(/\s+/g, ' '));
  await page.screenshot({ path: path.join(OUT, '1-loader.png') });

  section('Load three dashboards with dependency checks');
  for (const k of ['search/web_ops', 'search/web_sla_detail', 'search/classic_errors']) await f.check(`#splunk-loader input[data-spview="${k}"]`);
  ok(await f.$eval('#sp-load', b => b.textContent) === 'Load 3 dashboards', 'the button counts the selection');
  await f.click('#sp-load');
  await f.waitForSelector('#app:not([hidden])', { timeout: 60000 });
  const titles = await f.$$eval('#dash-switch option', o => o.map(x => x.textContent));
  ok(titles.length === 3, 'three dashboards loaded', titles.join(', '));
  const deps = await f.evaluate(() => DASH.map(d => ({ title: d.model.title, deps: d.model.deps })));
  const web = deps.find(d => d.title === 'Web Operations Overview').deps;
  ok(web && web.checked > 0, 'dependencies were checked', `${web?.checked} checked, ${web?.missing.length} not found`);
  ok(!web.missing.some(m => m.kind === 'Macro' || m.kind === 'Saved search'), 'macros and saved searches that exist are found');
  ok(web.missing.some(m => m.kind === 'Lookup' && m.name === 'uri_owners.csv'), 'a lookup that does not exist is reported', 'uri_owners.csv');
  console.log('    not found: ' + web.missing.map(m => `${m.kind} ${m.name}`).join(', '));
  const cfg = await f.evaluate(() => [CONFIG.macros.size, CONFIG.saved.size]);
  ok(cfg[0] >= 3 && cfg[1] >= 1, 'macros and saved searches loaded for expansion', `${cfg[0]} macros, ${cfg[1]} saved searches`);
  ok(await f.$eval('#view', v => /Owner/.test(v.innerText) && /Not found/.test(v.innerText)), 'All dashboards shows owners and missing dependencies');
  await f.click('#sp-usage');
  await f.waitForFunction(() => USAGE !== null || /Couldn't get view counts/.test(document.querySelector('#toast')?.textContent || ''), null, { timeout: 60000 });
  const usage = await f.evaluate(() => USAGE ? [...USAGE.entries()] : null);
  ok(usage !== null, 'view counts ran (one search)', usage ? `${usage.length} dashboards with views` : '');
  if (!REAL) ok(usage.some(([k, v]) => k === 'search/web_ops' && v.views === 42), 'view counts are shown per dashboard');
  await page.screenshot({ path: path.join(OUT, '2-all-dashboards.png') });

  section('One dashboard');
  await f.selectOption('#dash-switch', { label: 'Web Operations Overview' });
  await f.click('#nav [data-view="overview"]');
  const ov = await f.$eval('#view', v => v.innerText);
  ok(/In Splunk/.test(ov) && /owner/.test(ov), 'the overview shows where the dashboard is in Splunk');
  ok(/Dependencies/.test(ov) && /not found in Splunk/.test(ov), 'the overview summarises dependencies');
  await page.screenshot({ path: path.join(OUT, '3-overview.png') });
  await f.click('#nav [data-view="issues"]');
  ok(await f.$eval('#view', v => /Lookup "uri_owners\.csv" wasn't found/.test(v.innerText)), 'the missing lookup is on the Issues page');
  await f.click('#nav [data-view="datasources"]');
  ok(await f.$eval('#view tbody tr:has(.chip[data-id="ds:ds_uri_detail"])', r => r.innerText.includes('web_archive')), 'macros are expanded with the definitions read from Splunk');

  section('Exports, map and share link');
  await f.click('#btn-export');
  const [pdf] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), f.click('#btn-export-pdf')]);
  await pdf.saveAs(path.join(OUT, pdf.suggestedFilename()));
  ok(pdf.suggestedFilename().endsWith('.pdf') && fs.statSync(path.join(OUT, pdf.suggestedFilename())).size > 100000, 'PDF report from the bundled library', pdf.suggestedFilename());
  await f.click('#btn-export');
  const [xlsx] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), f.click('#btn-export-xlsx')]);
  ok(xlsx.suggestedFilename().endsWith('.xlsx'), 'Excel workbook', xlsx.suggestedFilename());
  await f.click('#nav [data-view="graph"]');
  await f.selectOption('#g-layout', 'elk');
  await f.waitForSelector('#g-wrap svg .gnode', { timeout: 60000 });
  ok(await f.$$eval('#g-wrap .gnode', g => g.length) > 3, 'ELK map layout from the bundled library');
  await page.screenshot({ path: path.join(OUT, '4-map.png') });
  await f.click('#btn-share'); // Share… is its own button beside Export
  await f.waitForFunction(() => document.querySelector('#share-link').value.startsWith('http'));
  const link = await f.$eval('#share-link', e => e.value);
  ok(link.startsWith(`${BASE}/en-US/app/${APP}/inventory#d=`), 'share links point at the app page');
  const p2 = await ctx.newPage();
  await p2.goto(link);
  const f2 = await (await p2.waitForSelector('iframe.sdi-frame', { timeout: 60000 })).contentFrame();
  await f2.waitForSelector('#app:not([hidden])', { timeout: 60000 });
  ok(await f2.$eval('#dash-title', e => e.textContent) === 'Web Operations Overview', 'a share link reopens in the app');
  await p2.close();

  section('All apps');
  await f.evaluate(() => document.querySelector('#share-dlg').close());
  await f.click('#btn-new');
  await f.selectOption('#sp-app', '-');
  await f.waitForSelector('#splunk-loader .sp-item', { timeout: 60000 });
  const all = await f.$$eval('#splunk-loader [data-spview]', x => x.map(i => i.dataset.spview));
  ok(new Set(all.map(k => k.split('/')[0])).size > 1, 'All apps lists dashboards from several apps', `${all.length} dashboards`);
  ok(!all.includes(`${APP}/inventory`), "the app's own page is left out");
  const other = all.includes('launcher/ops_home') ? 'launcher/ops_home' : all.includes('ops/ops_home') ? 'ops/ops_home' : all.find(k => !k.startsWith('search/'));
  await f.check(`#splunk-loader input[data-spview="${other}"]`);
  await f.check('#splunk-loader input[data-spview="search/web_ops"]');
  await f.click('#sp-load');
  await f.waitForFunction(() => DASH.length === 2, null, { timeout: 90000 }).catch(async e => {
    const state = await f.evaluate(() => ({ button: document.querySelector('#sp-load')?.textContent, loadError: document.querySelector('#load-error')?.textContent, errors: LOAD_ERRORS, dash: DASH.length }));
    throw new Error(e.message.split('\n')[0] + ' ' + JSON.stringify(state));
  });
  ok(await f.evaluate(() => new Set(DASH.map(d => d.src.splunk.app)).size === 2), 'dashboards from two apps load together', other);

  section('Requests');
  const posts = appRequests.filter(r => !r.startsWith('GET '));
  ok(posts.length === 1 && posts[0] === 'POST /services/search/jobs', 'every Splunk request is a GET, except the one search for view counts', `${appRequests.length} requests`);
  ok(external.length === 0, 'no requests outside Splunk', external.join(', '));
  ok(csp.length === 0, 'no Content-Security-Policy violations', csp.join(' | '));
  ok(errors.length === 0, 'no errors in the app', errors.join(' | '));
  await browser.close();
  console.log('All checks passed.');
})().catch(e => { console.error(`\n✗ ${step}: ${e.message}`); process.exit(1); });
