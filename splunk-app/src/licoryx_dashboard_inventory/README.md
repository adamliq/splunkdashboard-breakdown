# Licoryx Dashboard Inventory for Splunk

Inventory, check and document Splunk dashboards, both Dashboard Studio and Classic Simple XML.

For each dashboard it lists every tab, input, data source, search, chain search, visualization and token. It also lists the indexes, sourcetypes, lookups, data models, macros and SPL commands the searches use, and shows how everything connects. On top of that it provides:

- **Checks:** issues, with safe one-click fixes.
- **Recommendations** for performance, maintainability, security and accessibility.
- **Compatibility:** a Splunk version compatibility check.
- **Mockup:** an interactive mockup of the layout.
- **Maps:** relationship maps, a token matrix and a data-flow diagram.
- **Reports:** full reports as PDF, Markdown or Excel.

## Using it

1. Open **Licoryx Dashboard Inventory** from the app menu.
2. Under **Load from Splunk**, pick an app or **All apps**, tick dashboards, and select **Load**.
3. Keep **Also check what the dashboards use** ticked to check each dashboard's indexes, lookups, macros, saved searches and data models against what exists in Splunk. Anything missing is listed on the **Issues** page. The same option lets the app look inside macros, saved searches and data models.
4. Each dashboard's app, owner, sharing, permissions and last update are shown on its **Overview** and in **All dashboards**.
5. Optionally, select **Get view counts** to see how often each dashboard was viewed, and by how many users, in the last 30 days.
6. Alternatively, paste a dashboard's source, or choose files exported from another Splunk instance.

The app is read-only:

- It only reads dashboards and configuration that the viewer can already see, through Splunk's REST API with the viewer's own session, using GET requests.
- The one exception is **Get view counts**, which runs one search on `index=_internal` (Splunk's web access log) when the viewer selects it. It needs permission to search `_internal`.
- It never changes, saves or schedules anything in Splunk.
- Exports and fixed definitions are downloaded to the viewer's computer. To apply a fix, paste the downloaded definition into the dashboard's source editor in Splunk.

## Requirements and compatibility

- Splunk Enterprise 8.2 or later (tested on 8.2, 9.4 and 10.6), or Splunk Cloud Platform (Victoria and Classic experience).
- The app follows the light or dark theme chosen in Splunk.
- **Supported deployments:** standalone search heads, distributed search, and search head clusters. Install it on search heads only.
- **Nothing to configure:** no inputs, indexes, saved searches, alerts, custom commands, Python or other server-side code.
- **No outside connections:** all libraries are inside the app, and the app makes no connections outside Splunk.

## Permissions

Everyone can open the app. What each user can load follows their normal Splunk permissions: they see only the apps, dashboards, macros, saved searches and data models they already have read access to. App objects can be changed only by `admin` and `sc_admin`.

## License

MIT: see `LICENSE.txt`.

## Third-party software

See `appserver/static/lib/THIRD-PARTY-NOTICES.md`: jsPDF (MIT), jsPDF-AutoTable (MIT) and elkjs (EPL-2.0), bundled unmodified.

## Support

Source code, issues and the standalone web version: https://github.com/adamliq/splunkdashboard-breakdown
