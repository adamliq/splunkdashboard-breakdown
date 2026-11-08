/*
 * Dashboard Inventory: shows the inventory page (inventory.html, in this app's static folder)
 * inside this dashboard. It tells the page where Splunk's REST API is, so the page can list and
 * read dashboards with the viewer's own session (read-only), and passes any share link on.
 * Plain script: no Splunk Web libraries are imported.
 */
(function () {
  'use strict';
  var APP = 'dashboard_inventory';
  var VERSION = '@VERSION@';

  function mount() {
    var host = document.getElementById('sdi-host');
    if (!host) { setTimeout(mount, 100); return; }
    if (host.getAttribute('data-mounted')) { return; }
    host.setAttribute('data-mounted', '1');

    // /<root>/<locale>/app/<app>/<view>: everything before /app/ is the root and locale.
    var path = window.location.pathname;
    var i = path.indexOf('/app/');
    var base = i >= 0 ? path.slice(0, i) : '';
    var app = i >= 0 ? path.slice(i + 5).split('/')[0] : APP;
    var params = [
      'v=' + encodeURIComponent(VERSION),
      'splunkd=' + encodeURIComponent(base + '/splunkd/__raw'),
      'app=' + encodeURIComponent(app),
      'page=' + encodeURIComponent(path)
    ].join('&');

    var frame = document.createElement('iframe');
    frame.src = base + '/static/app/' + APP + '/inventory.html?' + params + (window.location.hash || '');
    frame.title = 'Dashboard Inventory';
    frame.className = 'sdi-frame';
    frame.setAttribute('allow', 'clipboard-write');
    host.textContent = '';
    host.appendChild(frame);

    function size() {
      var top = frame.getBoundingClientRect().top;
      frame.style.height = Math.max(480, window.innerHeight - top - 12) + 'px';
    }
    size();
    window.addEventListener('resize', size);
    setTimeout(size, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}());
