#!/usr/bin/env python3
"""Build the Licoryx Dashboard Inventory Splunk app package.

    python3 splunk-app/build.py            # writes dist/licoryx_dashboard_inventory-<version>.tgz
    python3 splunk-app/build.py --check    # also fails if splunk-app/package/ holds a different build

What it does:
  * copies the app skeleton from splunk-app/src/licoryx_dashboard_inventory
  * turns the repository's index.html into appserver/static/inventory.html, with the page's
    stylesheet and script split out into inventory.css and inventory.js (no inline code)
  * copies the bundled libraries and their licences from splunk-app/vendor/lib, and the
    repository's LICENSE as LICENSE.txt
  * checks that the version in app.conf, app.manifest and index.html (APP_VERSION) all match
  * writes a .tgz with the permissions Splunk Cloud expects (directories 755, files 644),
    no hidden files, and owner/group root

Standard library only.
"""
import configparser
import io
import json
import os
import re
import shutil
import sys
import tarfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'splunk-app', 'src', 'licoryx_dashboard_inventory')
VENDOR = os.path.join(ROOT, 'splunk-app', 'vendor', 'lib')
PAGE = os.path.join(ROOT, 'index.html')
LICENSE = os.path.join(ROOT, 'LICENSE')
PACKAGED = os.path.join(ROOT, 'splunk-app', 'package')
DIST = os.path.join(ROOT, 'dist')
APP = 'licoryx_dashboard_inventory'

# Splunk Web adds an i18n_register({...}) call to the top of every app .js file it serves. The page
# runs in its own frame, where Splunk's i18n library is not loaded, so it defines a no-op. A function
# declaration is hoisted, so it exists before that call runs; the bundled libraries, loaded later
# into the same frame, use the same global.
I18N_SHIM = ('/* Splunk Web prepends i18n_register(...) to app scripts; this frame has no i18n library. */\n'
             'function i18n_register() {}\n')


def app_version():
    conf = configparser.ConfigParser(interpolation=None)
    conf.read(os.path.join(SRC, 'default', 'app.conf'))
    version = conf.get('launcher', 'version')
    if conf.get('id', 'version') != version:
        sys.exit('app.conf: [id] and [launcher] versions differ')
    with open(os.path.join(SRC, 'app.manifest'), encoding='utf-8') as f:
        manifest = json.load(f)['info']['id']['version']
    with open(PAGE, encoding='utf-8') as f:
        page = re.search(r"APP_VERSION = '([^']+)'", f.read())
    found = {'app.conf': version, 'app.manifest': manifest, 'index.html APP_VERSION': page.group(1) if page else None}
    if len(set(found.values())) != 1:
        sys.exit(f'versions differ: {found}')
    return version


def split_page(html, version):
    """Move the page's main <style> and main <script> into files; keep data scripts inline."""
    style = re.search(r'<style>\n(.*?)</style>', html, re.S)
    if not style:
        sys.exit('index.html: main <style> not found')
    css = style.group(1)
    html = html[:style.start()] + f'<link rel="stylesheet" href="inventory.css?v={version}">' + html[style.end():]
    script = re.search(r"<script>\n'use strict';\n(.*?)</script>", html, re.S)
    if not script:
        sys.exit('index.html: main <script> not found')
    js = I18N_SHIM + "'use strict';\n" + script.group(1)
    html = html[:script.start()] + f'<script src="inventory.js?v={version}"></script>' + html[script.end():]
    leftover = re.findall(r'<script(?![^>]*\b(src|type="(application/json|text/plain)"))[^>]*>', html)
    if leftover:
        sys.exit(f'index.html: unexpected inline scripts remain: {leftover}')
    return html, css, js


def build():
    version = app_version()
    stage = os.path.join(DIST, 'stage')
    out_dir = os.path.join(stage, APP)
    shutil.rmtree(stage, ignore_errors=True)
    shutil.copytree(SRC, out_dir)
    static = os.path.join(out_dir, 'appserver', 'static')

    with open(PAGE, encoding='utf-8') as f:
        html, css, js = split_page(f.read(), version)
    for name, text in (('inventory.html', html), ('inventory.css', css), ('inventory.js', js)):
        with open(os.path.join(static, name), 'w', encoding='utf-8', newline='\n') as f:
            f.write(text)
    host = os.path.join(static, 'inventory_host.js')
    with open(host, encoding='utf-8') as f:
        text = f.read().replace('@VERSION@', version)
    with open(host, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    shutil.copytree(VENDOR, os.path.join(static, 'lib'))
    shutil.copyfile(LICENSE, os.path.join(out_dir, 'LICENSE.txt'))

    os.makedirs(DIST, exist_ok=True)
    package = os.path.join(DIST, f'{APP}-{version}.tgz')
    mtime = int(time.time())
    with tarfile.open(package, 'w:gz', format=tarfile.PAX_FORMAT) as tar:
        for dirpath, dirnames, filenames in os.walk(out_dir):
            dirnames[:] = sorted(d for d in dirnames if not d.startswith('.') and d != '__pycache__')
            rel_dir = os.path.relpath(dirpath, stage)
            tar.addfile(_info(rel_dir, tarfile.DIRTYPE, 0o755, 0, mtime))
            for name in sorted(filenames):
                if name.startswith('.') or name.endswith(('.pyc', '.pyo', '~')):
                    continue
                path = os.path.join(dirpath, name)
                with open(path, 'rb') as f:
                    data = f.read()
                tar.addfile(_info(os.path.join(rel_dir, name), tarfile.REGTYPE, 0o644, len(data), mtime), io.BytesIO(data))
    shutil.rmtree(stage)
    print(package)
    return package


def _info(name, kind, mode, size, mtime):
    info = tarfile.TarInfo(name.replace(os.sep, '/'))
    info.type, info.mode, info.size, info.mtime = kind, mode, size, mtime
    info.uid = info.gid = 0
    info.uname = info.gname = 'root'
    return info


def contents(package):
    """{member name: bytes} for the files in a package (directories and timestamps ignored)."""
    with tarfile.open(package, 'r:gz') as tar:
        return {m.name: tar.extractfile(m).read() for m in tar.getmembers() if m.isfile()}


def check(package):
    """Fail unless splunk-app/package/ holds exactly this build (same files, same contents)."""
    committed = os.path.join(PACKAGED, os.path.basename(package))
    others = [n for n in os.listdir(PACKAGED) if n != os.path.basename(package)] if os.path.isdir(PACKAGED) else []
    if not os.path.exists(committed):
        sys.exit(f'{os.path.relpath(committed, ROOT)} is missing: copy {os.path.relpath(package, ROOT)} there')
    if others:
        sys.exit(f'splunk-app/package/ has other files: {others}')
    want, have = contents(package), contents(committed)
    diff = sorted(n for n in set(want) | set(have) if want.get(n) != have.get(n))
    if diff:
        sys.exit(f'{os.path.relpath(committed, ROOT)} is out of date ({len(diff)} files differ, e.g. {diff[:3]}): rebuild and copy it')
    print('package is up to date')


if __name__ == '__main__':
    built = build()
    if '--check' in sys.argv[1:]:
        check(built)
