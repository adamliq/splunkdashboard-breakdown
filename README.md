# splunkdashboard-breakdown

**Studio Dashboard Inventory** is a single, standalone web page (`index.html`). It lists everything in a Splunk dashboard, shows how the items relate, checks for problems before you deploy, and can repair what it safely can.

Open `index.html` in a browser. It needs no server, build step or internet connection, and it sends nothing anywhere. Paste or drop in the dashboard source, or click **Load sample dashboard**.

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

Explore them through the detail panel (click any item), the **Relationship map**, the **Relationship list**, and the "Driven by tokens" column.

## Exports

From the **Export** menu:

- **Printable summary (.html):** a one-page summary with counts, a mockup of each tab, tokens, data sources, visualizations and issues, ready to print.
- **Report (.md):** a documentation-ready Markdown write-up.
- **Inventory (.csv)** and **Relationships (.csv)**.
- **Model (.json):** the full parsed model.
- **Definition, with selected fixes.**
- **Mockup (.svg / .png).**

## Examples

- `examples/monitoringTemplateDiscreteMetrics.json`: a corrected Studio template.
- `examples/classicWebErrors.xml`: a Classic Simple XML dashboard for trying the converter.
