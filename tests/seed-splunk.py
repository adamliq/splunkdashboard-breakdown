#!/usr/bin/env python3
"""Add the test dashboards, macros and saved search to a local test Splunk (for tests/e2e.js).

    SPLUNK_PASSWORD=… python3 tests/seed-splunk.py [https://127.0.0.1:8089]

Creates, in the Search & Reporting app: web_ops (the page's sample dashboard), web_sla_detail and
classic_errors (tests/fixtures), the sample macros and saved search; and ops_home in the Home app
(launcher), so "All apps" has more than one app. Safe to rerun. Only for throwaway test instances:
it skips TLS verification for the default self-signed certificate.
"""
import base64
import os
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MGMT = (sys.argv[1] if len(sys.argv) > 1 else 'https://127.0.0.1:8089').rstrip('/')
AUTH = 'Basic ' + base64.b64encode(f"{os.environ.get('SPLUNK_USER', 'admin')}:{os.environ['SPLUNK_PASSWORD']}".encode()).decode()
CTX = ssl._create_unverified_context()

page = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
sample = re.search(r'<script id="sample" type="application/json">(.*?)</script>', page, re.S).group(1).strip()
conf = re.search(r'<script id="sample-conf" type="text/plain">(.*?)</script>', page, re.S).group(1).strip()
fixture = lambda name: open(os.path.join(ROOT, 'tests', 'fixtures', name), encoding='utf-8').read()


def post(path, data, update=None):
    """Create; if it exists already, update it (POST to the entity)."""
    req = urllib.request.Request(MGMT + path, urllib.parse.urlencode(data).encode(), {'Authorization': AUTH})
    try:
        urllib.request.urlopen(req, context=CTX)
        print('created', path, data.get('name', ''))
    except urllib.error.HTTPError as e:
        if e.code == 409 and update:
            body = {k: v for k, v in data.items() if k != 'name'}
            urllib.request.urlopen(urllib.request.Request(MGMT + path + '/' + urllib.parse.quote(data['name'], safe=''), urllib.parse.urlencode(body).encode(), {'Authorization': AUTH}), context=CTX)
            print('updated', path, data['name'])
        else:
            sys.exit(f'{path} {data.get("name", "")}: HTTP {e.code} {e.read()[:300]!r}')


views = {
    ('search', 'web_ops'): f'<dashboard version="2" theme="light"><label>Web Operations Overview</label><definition><![CDATA[{sample}]]></definition></dashboard>',
    ('search', 'web_sla_detail'): f'<dashboard version="2"><label>Web SLA detail</label><definition><![CDATA[{fixture("web_sla_detail.json")}]]></definition></dashboard>',
    ('search', 'classic_errors'): fixture('classic_errors.xml'),
    ('launcher', 'ops_home'): f'<dashboard version="2"><label>Ops home</label><definition><![CDATA[{fixture("web_sla_detail.json").replace("Web SLA detail", "Ops home")}]]></definition></dashboard>',
}
for (app, name), xml in views.items():
    post(f'/servicesNS/nobody/{app}/data/ui/views', {'name': name, 'eai:data': xml}, update=True)

stanzas, cur = [], None
for line in conf.split('\n'):
    m = re.match(r'^\[(.+)\]$', line)
    if m:
        cur = {'name': m.group(1)}
        stanzas.append(cur)
        continue
    kv = re.match(r'^(\S+)\s*=\s*(.*)$', line)
    if kv and cur:
        cur[kv.group(1)] = kv.group(2)
for st in stanzas:
    if 'definition' in st:
        post('/servicesNS/nobody/search/configs/conf-macros', {k: v for k, v in st.items() if k in ('name', 'definition', 'args')}, update=True)
    elif 'search' in st:
        post('/servicesNS/nobody/search/saved/searches', {'name': st['name'], 'search': st['search']}, update=True)
