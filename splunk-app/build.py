#!/usr/bin/env python3
"""Build the Dashboard Inventory Splunk app package.

    python3 splunk-app/build.py            # writes dist/dashboard_inventory-<version>.tgz

What it does:
  * copies the app skeleton from splunk-app/src/dashboard_inventory
  * turns the repository's index.html into appserver/static/inventory.html, with the page's
    stylesheet and script split out into inventory.css and inventory.js (no inline code)
  * copies the bundled libraries and their licences from splunk-app/vendor/lib
  * writes a .tgz with the permissions Splunk Cloud expects (directories 755, files 644),
    no hidden files, and owner/group root

Standard library only.
"""
import configparser
import io
import os
import re
import shutil
import sys
import tarfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'splunk-app', 'src', 'dashboard_inventory')
VENDOR = os.path.join(ROOT, 'splunk-app', 'vendor', 'lib')
PAGE = os.path.join(ROOT, 'index.html')
DIST = os.path.join(ROOT, 'dist')
APP = 'dashboard_inventory'


def app_version():
    conf = configparser.ConfigParser(interpolation=None)
    conf.read(os.path.join(SRC, 'default', 'app.conf'))
    version = conf.get('launcher', 'version')
    if conf.get('id', 'version') != version:
        sys.exit('app.conf: [id] and [launcher] versions differ')
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
    js = "'use strict';\n" + script.group(1)
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


if __name__ == '__main__':
    build()
