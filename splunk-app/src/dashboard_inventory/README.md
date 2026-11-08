# Dashboard Inventory for Splunk

Inventory, check and document Splunk dashboards, both Dashboard Studio and Classic Simple XML.

For each dashboard it lists every tab, input, data source, search, chain search, visualization and token. It also lists the indexes, sourcetypes, lookups, data models, macros and SPL commands the searches use, and shows how everything connects. On top of that it provides:

- **Checks:** issues, with safe one-click fixes.
- **Recommendations** for performance, maintainability, security and accessibility.
- **Compatibility:** a Splunk version compatibility check.
- **Mockup:** an interactive mockup of the layout.
- **Maps:** relationship maps, a token matrix and a data-flow diagram.
- **Reports:** full reports as PDF, Markdown or Excel.

## Using it

1. Open **Dashboard Inventory** from the app menu.
2. Under **Load from Splunk**, pick an app, tick one or more dashboards, and select **Load**. Tick **Also load the macros, saved searches and data models** to let the app look inside them.
3. Alternatively, paste a dashboard's source, or choose files exported from another Splunk instance.

The app is read-only:

- It only reads dashboards and configuration that the viewer can already see, through Splunk's REST API with the viewer's own session. It sends GET requests only.
- It never changes, saves or schedules anything in Splunk.
- Exports and fixed definitions are downloaded to the viewer's computer. To apply a fix, paste the downloaded definition into the dashboard's source editor in Splunk.

## Requirements and compatibility

- Splunk Enterprise 8.2 or later, or Splunk Cloud Platform (Victoria and Classic experience).
- **Supported deployments:** standalone search heads, distributed search, and search head clusters. Install it on search heads only.
- **Nothing to configure:** no inputs, indexes, saved searches, alerts, custom commands, Python or other server-side code.
- **No outside connections:** all libraries are inside the app, and the app makes no connections outside Splunk.

## Permissions

Everyone can open the app. What each user can load follows their normal Splunk permissions: they see only the apps, dashboards, macros, saved searches and data models they already have read access to. App objects can be changed only by `admin` and `sc_admin`.

## Third-party software

See `appserver/static/lib/THIRD-PARTY-NOTICES.md`: jsPDF (MIT), jsPDF-AutoTable (MIT) and elkjs (EPL-2.0), bundled unmodified.

## Support

Source code, issues and the standalone web version: https://github.com/adamliq/splunkdashboard-breakdown
