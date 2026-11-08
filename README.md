# splunkdashboard-breakdown

**Studio Dashboard Inventory** is a single, standalone web page (`index.html`). It lists everything in a Splunk dashboard, shows how the items relate, checks for problems before you deploy, and can repair what it safely can.

**Try it online: [adamliq.github.io/splunkdashboard-breakdown](https://adamliq.github.io/splunkdashboard-breakdown/)**

Or open `index.html` from this repository in a browser. Either way it needs no server, build step or install, and it sends nothing anywhere: dashboards you load stay in your browser. Paste or drop in the dashboard source, or click **Load sample dashboard**. (The only network requests load a library the first time you need it: the PDF library for a PDF report and the layout library for the ELK map layout.)

It is also available as a **Splunk app** that runs inside Splunk Enterprise and Splunk Cloud Platform and loads dashboards straight from Splunk. See [Splunk app](#splunk-app).

## Accepted input

| Input | Where to get it |
| --- | --- |
| Dashboard Studio JSON | Dashboard → *Edit* → *Source* (`</>`) |
| Dashboard XML, Studio (`<dashboard version="2">` with a `<definition>` block) | `$SPLUNK_HOME/etc/apps/<app>/{local,default}/data/ui/views/<name>.xml` |
| Dashboard XML, Classic Simple XML (`<dashboard>` / `<form>`) | Same folder. Converted to the Studio model; layout positions are approximate |
| REST API response, one view or a list of many | `GET /servicesNS/-/<app>/data/ui/views?output_mode=json` |
| Several files at once | Choose or drop multiple files to inventory a whole app |

**Lenient loading.** Copy-and-paste damage is repaired and reported: Markdown code fences, a byte-order mark, `//` and `/* */` comments, trailing commas, extra text after the closing bracket, and curly quotes.

## What it inventories

| Item | What is captured |
| --- | --- |
| **Tabs / canvases** | Tab labels and order, layout type (grid/absolute), the global input bar, and which inputs and visualizations sit on each tab |
| **Inputs** | Type, token set, default value, static options, the data source that populates dynamic options, placement, and tokens used |
| **Data sources** | Searches (`ds.search`), chain searches (`ds.chain`), saved searches (`ds.savedSearch`) and other types; query, effective time range (own, base search or defaults), refresh, and smart sources |
| **Searches & chain searches** | A lineage tree from each base search through every chain level, plus the effective SPL of each chain (base and chain queries joined) |
| **Indexes & sourcetypes** | From each search's SPL (`index=`, `index::`, `index!=`, `NOT index=`, `index IN (…)`, and the same for `sourcetype`, including `tstats … where index=…`). Excluded terms and token-driven values are marked, chains inherit from their base, and `| collect index=…` is listed as a write target |
| **Lookups** | Read (`| lookup`, `| inputlookup`, `| inputcsv`, `| from lookup:`) or written (`| outputlookup`, `| outputcsv`), with command options |
| **Data models** | Read through `tstats … from datamodel=`, `| from datamodel:`, `| datamodel` and `| pivot`, with datasets |
| **Macros** | Every `` `macro` `` call, keyed by name and argument count as Splunk does (`` `name(2)` ``) |
| **SPL commands** | Every command in every pipeline (including subsearches and the implicit leading `search`), grouped as generating, transforming, writes data / side effect, or other, plus each search's full pipeline |
| **Visualizations** | Type, placement, data source lineage, what they read, tokens used and set, drilldown actions, and visibility rules |
| **Tokens** | Every `$token$` reference, what sets it (input, drilldown, default, smart source, Classic `<done>`/`<change>` handler, or `$env:*$`) and every place it is used, down to the JSON path |
| **Visibility conditions** | `expressions.conditions` (and Classic `depends`/`rejects`) with the items they show or hide |

**All items.** The **Inventory → All items** page lists every item of every kind in one table, with its kind, ID, type, placement, what it depends on and what uses it. Filter by kind with the buttons, or by text with the filter box, and download it as CSV. Every item has a stable number (`#`) in inventory order, shown in the table, the CSV and the item's detail panel, and kept when you filter or sort. The pages under it (Tabs, Inputs, Data sources and so on) give the detailed view of each kind.

## Checks

The **Issues** page lists problems as errors, warnings and notes.

**Structure.** Missing data sources, base searches, layouts or conditions; circular chains; tokens used but never set, or set but never used; unused data sources; unplaced panels and inputs; inputs with no token; smart-source tokens without `enableSmartSources`.

**SPL.** Unbalanced quotes, parentheses, brackets or macro backticks; empty commands (`| |` or a trailing pipe); stats functions with no field (`| stats sum by host`); `rename` without `AS`; `eval` without `=`; commands with nothing after them; generating commands without a leading pipe; chain searches without a leading pipe; commands that aren't built-in SPL.

**Behaviour.** Valid dashboards that don't do what you expect:
- a time picker with no effect, because its searches start with `| inputlookup`, `| makeresults` or `| rest`
- a single value set up to show a trend, when its search has no time series
- identical panels, and searches that run the same SPL and time range
- base searches that pass raw events to chain searches (Splunk keeps a limited number of events for chains)
- searches that write lookups or run side-effect commands (`collect`, `sendemail`, `delete` and so on) on every load
- lookups written by one search and read by another in the same dashboard

**Definition.** Names, types and values in the Studio definition that Splunk won't recognise, which otherwise load silently and then do nothing:
- misspelled keys and options (`legendDisplayy`, `queryParamters`, `itmes`, a top-level `visualisations`), with a "did you mean…" and a one-click rename
- unknown visualization, input, data source and drilldown types (`splunk.lne`, `input.dropdwn`), with a one-click correction
- option values that aren't allowed (`stackMode: "stacks"`), numbers given as text, and `"true"`/`"false"` given as text (fixable)
- searches with no query, saved searches with no report name, time range defaults not in `earliest,latest` form, non-numeric number-input defaults, malformed `items`
- the same ID used for both a visualization and an input
- layout problems: unknown layout types, panels overlapping on a grid, panels past the 1,200-pixel grid width or outside an absolute canvas, and zero-size panels

Unknown keys are flagged only when they look like a misspelling of a known one, so app-specific options aren't reported.

## Splunk version compatibility

The **Splunk version** page lists the features the dashboard uses that need a particular Splunk version: Dashboard Studio, the grid layout, default token values, hiding panels with no data, smart-source tokens, tabs, unset-token drilldowns, and show/hide conditions. It shows the minimum version each needs and the items that use it, and says which version the whole dashboard needs; the Overview and the reports show the same. Choose your version (Splunk Enterprise 8.2 to 10.0, or Splunk Cloud Platform) to see what won't work on it. The minimum versions are approximate, based on Splunk release notes. If one is wrong for your environment, correct it in the table; your corrections and version are remembered in your browser.

## Recommendations

The **Recommendations** page suggests optimisations and best practice. Unlike issues, nothing here is broken. Each recommendation has an impact (high, medium or low), a category, why it matters, what to do, an SPL or config example where useful, and the items it applies to. They are also on the Overview and in the full report.

| Category | Recommendations |
| --- | --- |
| **Performance** | Share one base search between searches that start the same way (with suggested base and chain SPL); use `tstats` for counts over indexed fields (with the rewritten search); name indexes instead of `index=*`; avoid leading wildcards; move `| search` filters into the base search; run `| lookup` after aggregating; replace `join`, `transaction` and `map`, and watch `append`/`appendcols` subsearch limits; avoid real-time searches, refreshes under a minute and "All time" defaults; reduce the number of searches that run at once; use scheduled reports for searches that never change; populate input options with `tstats` or a lookup |
| **Security** | Escape free-text input tokens with `$token|s$` |
| **Correctness** | Give multiselect inputs a prefix and delimiter (otherwise values are ANDed); give `| sort` an explicit limit (it keeps 10,000 rows by default) |
| **Maintainability** | Put repeated index names in a macro; flatten deep chains; give data sources descriptive names |
| **Usability** | Give inputs defaults so panels load; add panel titles and make duplicate titles distinct; point out panels that don't follow the time picker; prefer grid layouts; split crowded tabs |
| **Accessibility** | Raise colour contrast for text colours, including colours picked by dynamic options (checked against the panel or canvas background, or the dashboard theme; 4.5:1 for text, 3:1 for large numbers); don't rely on red versus green alone (with colour-blind-safe pairs); describe image panels; give markdown images alt text and keep heading levels in order; avoid text under 12 pixels |

## Repair

Issues with a safe fix carry a checkbox: removing a broken data-source reference, layout entry or visibility condition, removing an unused data source, placing an unplaced panel, adding an unplaced input to the input bar, turning on `enableSmartSources`, adding a missing leading pipe, and removing an empty command. Pick the fixes, then **Download definition** (JSON, or the original XML file with its `<definition>` replaced) or **Load the fixed version** to re-check it. Repairs made while loading are always included.

## Dashboard mockup

Draws the dashboard as laid out: the title, tab bar, global input bar, and each panel and input at its stored position and size. Charts are placeholder sketches for each visualization type, not real data. It is interactive:
- change inputs, or any token value (to simulate drilldown clicks and search results), and titles update
- conditional panels show or hide as their conditions change; ones that can't be evaluated are marked
- panels whose searches use a token with no value show **Waiting for input**

Turn on **Show item names** to tag each panel with its ID and the data sources feeding it (`viz_total ← ds_total`), each input with its ID and token (`input_host → $host$`), and each tab with its layout ID. Export the current tab as SVG or PNG; the tags are included when shown.

## Compare versions

Compare the open dashboard with another version, pasted, chosen as a file, or picked from the loaded dashboards. Shows items added, removed and changed, with field-level changes, a line diff for SPL, and moved or resized panels. Download the changes as Markdown.

## All dashboards

Load several dashboards to get a summary of each (panels, searches, inputs, tokens, errors, warnings), and a table of what they share: indexes, sourcetypes, lookups (with read/write), macros, data models and saved searches, with every dashboard that uses each. Switch dashboards from the header. Download the app inventory as CSV.

## Splunk config

Macro bodies, saved searches and data models live outside the dashboard. Paste `macros.conf` and `savedsearches.conf`, and data model JSON, on the loader or the **Splunk config** page. The page then:
- expands macros (including nested ones and arguments), inlines saved searches, and adds data model constraint searches
- finds the indexes, sourcetypes, lookups, data models and commands hidden inside them, marked *via expansion* or *via saved search*
- flags macros called with the wrong number of arguments, macros that expand into themselves, and macros or saved searches missing from the pasted config

## Relationships

Each relationship is stored as an edge pointing the way data and token values flow:

- input → *sets* → token; visualization → *sets on click* → token; defaults → *default value* → token
- token → *used by* → search / visualization / input / condition / tab
- index / sourcetype → *searched by* → search
- lookup → *read by* → search; search → *writes lookup* → lookup
- data model / macro → *read by* / *used by* → search; command → *used by* → search
- base search → *extended by* → chain search (any depth)
- data source → *feeds* → visualization; data source → *populates* → input
- data source → *provides smart-source token* → token
- condition → *controls visibility of* → visualization / input
- visualization / input → *placed on* → tab → dashboard

Explore them through:

- **Detail panel.** Click any item for its relationships and full lineage.
- **Relationship map.** A left-to-right flow from inputs and tokens through sources and searches to panels and tabs.
  - **Three modes:**
    - **Focus on one item** (the default) shows a single item and what it depends on and what depends on it, 1 to 4 steps each way or all the way. Clicking any item moves the focus to it.
    - **Path between two** answers "how does A affect B?" It draws every route from one item to another, with the number of routes and the shortest. If nothing flows that way but something flows the other way, or the two aren't connected at all, it says so.
    - **Whole dashboard** shows everything, optionally only what feeds one tab.
  - **Two layouts:** **Columns** (one column per kind of item), or **Layered, grouped by tab (ELK)**. ELK draws right-angle lines, places items to reduce crossings, and puts each tab's panels and inputs in a box. It uses [ELK](https://eclipse.dev/elk/) (elkjs), loaded from jsDelivr the first time you choose it.
  - **Hub tokens.** Tokens used by many items, such as a time picker's, are shown as a small badge on each item that uses them instead of as lines. The default is 4 or more uses; you can change the threshold or turn it off. The token matrix still shows every link.
  - **Collapse and expand.** Fold each tab into one box, each base search together with its chain searches, all sources, or all SPL commands. Use the checkboxes, or the **+**/**−** on a box to open or close just that one.
  - **Navigation.** Find an item by name or number. Zoom with Ctrl+scroll, a pinch, or the − / + / Fit / 100% buttons, and drag empty space to pan. Arrow keys move between connected items (right: what it feeds; left: what feeds it; up and down: the column), and Enter opens one.
  - **Changes from Compare.** After comparing two versions, **Show changes** colours the map: added in green, removed in red (dashed) and changed in amber, for both items and connections.
  - Inputs and tokens, sources, and SPL commands can each be hidden. In focus mode, lineage is still followed through hidden items.
  - **Export SVG / PNG** saves the map as shown.
- **Token matrix.** Tokens, or inputs, down the side and panels (grouped by tab) or searches across the top. Each cell shows how the token reaches the item: used directly (●), through its search (○), through a visibility condition (▲), or set by it (◆). Order rows and columns as defined, most used first, or with similar ones grouped together. It is the clearest way to see what an input changes. Export it as SVG or PNG. It is also in the reports when there are 24 or fewer panels.
- **Data flow (Sankey).** Where each panel's data comes from: indexes, lookups and data models, through base searches (and optionally chain searches as their own column), to panels and tabs. Band width is the number of panels, or the number of search steps behind them. Export it as SVG or PNG. It is also in the PDF report. With several dashboards loaded, the **All dashboards** page also has a Sankey from indexes, lookups and data models to the dashboards that read them.
- **Panel lineage maps.** The PDF report includes a map for each panel (up to 40) showing everything that feeds it.
- **Relationship list.** Every connection as a table.
- **"Driven by tokens"** column on the Tabs page.

**Between dashboards.** Drilldowns that open another dashboard ("link to dashboard", or a link to `/app/<app>/<dashboard>`) are listed on the Overview and in the reports. With several dashboards loaded, the **All dashboards** page draws a map of which dashboards open which, and lists each link with the tokens it passes. It also checks whether the target dashboard uses those tokens. Targets are matched to loaded dashboards by view name (file or REST name) or title; others are marked "not loaded".

## Exports

From the **Export** menu:

- **Full report (.pdf)** and **Full report (.md):** everything about the open dashboard in one document. It covers a summary, issues with their fixes, the layout (a mockup image of each tab in the PDF, and positions of every item), the numbered inventory, inputs, data sources (lineage, time ranges, what each search reads, and the full, effective and expanded SPL), indexes, sourcetypes, lookups, data models and macros, SPL commands and pipelines, visualizations, tokens and where each is referenced, visibility conditions, every relationship, the Splunk config used, and the dashboard definition as an appendix.
  - The PDF is landscape A4, with a contents page linking to each section, bookmarks, and page numbers. It is built in the browser with [jsPDF](https://github.com/parallax/jsPDF), loaded from jsDelivr the first time you export. If that can't load (for example offline), the report is saved as a print-ready HTML file instead; open it and choose **Print → Save as PDF**.
  - The Markdown has a linked table of contents and renders on GitHub, GitLab and most wikis.
- **Excel workbook (.xlsx):** the same content as the full report, one sheet per section (inventory, inputs, data sources, what each search reads, SPL, visualizations, tokens, issues, recommendations, relationships and more), each with filters. Written by the page itself, with no library. The All dashboards page also has an app workbook: dashboards, shared items and links between dashboards.
- **Share link…:** a link that opens this dashboard in the page. The whole definition (and, if you tick it, the pasted Splunk config) is compressed into the part of the link after `#`, which browsers never send to a web server; but anyone you give the link to can read the definition, including its searches. From the claude.ai artifact or a local file, links point to the [GitHub Pages site](https://adamliq.github.io/splunkdashboard-breakdown/). Large dashboards make long links, which some chat and email apps cut off; the dialog warns when a link is long.
- **Printable summary (.html):** a one-page summary with counts, a mockup of each tab, tokens, data sources, visualizations and issues, ready to print.
- **Inventory (.csv)** and **Relationships (.csv)**.
- **Model (.json):** the full parsed model.
- **Definition, with selected fixes.**
- **Mockup (.svg / .png).**

## Splunk app

`splunk-app/` packages the page as the **Dashboard Inventory** Splunk app (`dashboard_inventory`), for Splunk Enterprise 8.2 or later and Splunk Cloud Platform (Victoria and Classic experience).

- **Load from Splunk:** pick an app, tick one or more dashboards, and select **Load**. Tick **Also load the macros, saved searches and data models** to expand them, as with pasted config. Pasting and choosing files still work.
- **Read-only:** it reads through Splunk's REST API with the viewer's own session, using GET requests only, so each user sees only what they can already read. It never changes, saves or schedules anything; fixes and exports are downloaded.
- **Self-contained:** jsPDF, jsPDF-AutoTable and elkjs are bundled in `appserver/static/lib` (see `THIRD-PARTY-NOTICES.md`), so the app makes no connections outside Splunk. There is no inline script, Python, input, index, saved search or custom command.
- **Share links** point at the app's page in the same Splunk instance.

**Download:** a ready-built package is in the repository at [`splunk-app/package/dashboard_inventory-1.0.0.tgz`](splunk-app/package/dashboard_inventory-1.0.0.tgz). Install it under **Apps → Manage apps → Install app from file**, or upload it to Splunk Cloud with **Upload app**.

To build the package yourself (Python 3, standard library only):

```sh
python3 splunk-app/build.py        # writes dist/dashboard_inventory-<version>.tgz
```

The build turns `index.html` into `appserver/static/inventory.html`, `inventory.css` and `inventory.js`, adds the bundled libraries, and writes the archive with the file permissions Splunk Cloud expects. After changing `index.html` or the app, rebuild and copy the result to `splunk-app/package/` so the download stays current.

**AppInspect:** version 1.0.0 passes Splunk AppInspect 4.4.0 with no failures, warnings, errors or skipped checks, for the `cloud`, `private_victoria`, `private_classic`, `future` and `aarch64_compatibility` tags, and for all 254 checks run together:

```sh
splunk-appinspect inspect dist/dashboard_inventory-1.0.0.tgz --mode precert --included-tags cloud
```

## Examples

- `examples/monitoringTemplateDiscreteMetrics.json`: a corrected Studio template.
- `examples/classicWebErrors.xml`: a Classic Simple XML dashboard for trying the converter.
- `examples/badPractices.json`: a dashboard that triggers most recommendations.
