# Third-party software

Dashboard Inventory bundles these libraries, unmodified, so that it never loads code from outside Splunk. Each is loaded only when the feature that needs it is used.

| File | Library | Version | Used for | License |
| --- | --- | --- | --- | --- |
| `jspdf.umd.min.js` | [jsPDF](https://github.com/parallax/jsPDF) | 4.2.1 | Full report (.pdf) | MIT, see `LICENSE-jspdf.txt` |
| `jspdf.plugin.autotable.min.js` | [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) | 5.0.9 | Tables in the PDF report | MIT, see `LICENSE-jspdf-autotable.txt` |
| `elk.bundled.js` | [elkjs](https://github.com/kieler/elkjs) (Eclipse Layout Kernel) | 0.11.1 | "Layered, grouped by tab" map layout | EPL-2.0, see `LICENSE-elkjs.md` |

The files are the published npm builds (`dist/jspdf.umd.min.js`, `dist/jspdf.plugin.autotable.min.js`, `lib/elk.bundled.js`). `npm audit` reported no known vulnerabilities in these versions when they were added.
