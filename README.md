# splunkdashboard-breakdown

**Studio Dashboard Inventory** is a single, standalone web page (`index.html`). It lists everything in a Splunk Dashboard Studio dashboard and shows how the items relate to each other.

Open `index.html` in a browser. It needs no server, build step or internet connection, and it sends nothing anywhere. Paste or drop in the dashboard source, or click **Load sample dashboard**.

## Accepted input

| Input | Where to get it |
| --- | --- |
| Dashboard Studio JSON | Dashboard → *Edit* → *Source* (`</>`) |
| Dashboard XML (`<dashboard version="2">` with a `<definition>` block) | `$SPLUNK_HOME/etc/apps/<app>/{local,default}/data/ui/views/<name>.xml` |
| REST API response | `GET /servicesNS/-/<app>/data/ui/views/<name>?output_mode=json` |

Classic Simple XML dashboards are detected and rejected with an explanation.

## What it inventories

| Item | What is captured |
| --- | --- |
| **Tabs / canvases** | Tab labels and order, layout type (grid/absolute), the global input bar, and which inputs and visualizations sit on each tab |
| **Inputs** | Type, token set, default value, static options, the data source that populates dynamic options, placement, and tokens used |
| **Data sources** | Searches (`ds.search`), chain searches (`ds.chain`), saved searches (`ds.savedSearch`) and other types; query, effective time range (own, base search or defaults), refresh, and smart sources |
| **Indexes & sourcetypes** | Read from each search's SPL (`index=`, `index::`, `index!=`, `NOT index=`, `index IN (…)`, and the same for `sourcetype`, including `tstats … where index=…`). Excluded terms and token-driven values (`index=$idx$`) are marked. Chain searches inherit their base search's indexes and sourcetypes. Saved searches, `| rest` calls and the indexes `| collect` writes to are listed as *other sources*. A dedicated view shows, for each index and sourcetype, the searches, chains, visualizations and tabs that depend on it |
| **Lookups** | Each lookup and whether the dashboard **reads** it (`| lookup`, `| inputlookup`, `| inputcsv`, `| from lookup:`) or **writes** it (`| outputlookup`, `| outputcsv`), with the command options (`append=t`, `key_field=…`). Shows the searches that read or write each lookup, the chain searches that inherit the reads, and the visualizations and tabs fed by it. Lookup names set by a token are shown on the search. Automatic lookups from props.conf aren't visible in SPL |
| **Data models** | Data models and datasets read through `| tstats … from datamodel=Model.Dataset`, `| from datamodel:Model.Dataset`, `| datamodel Model Dataset search` and `| pivot Model Dataset …`, with the searches that read them, the chains that inherit them, and the visualizations they feed |
| **Macros** | Every `` `macro` `` call, keyed by name and argument count as Splunk does (`` `name(2)` ``), with the calls as written and the searches, chains and visualizations that use it. Macro bodies live in macros.conf, so what they contain is not expanded |
| **SPL commands** | Every command in every search's pipeline (including subsearches and the implicit leading `search`), grouped as generating, transforming, writes data / side effect, or other, with use counts, the searches that use each, and the full pipeline of every search |
| **Searches & chain searches** | A lineage tree from each base search through every chain level, plus the effective SPL of each chain (base and chain queries joined) |
| **Visualizations** | Type, placement, data source lineage, tokens used, tokens set by drilldown, drilldown actions (set token, link to dashboard, URL, search or report), and visibility rules |
| **Tokens** | Every `$token$` reference, including filters (`|s`, `|h`, …) and time-range sub-keys (`$t.earliest$`). Each token records what sets it (input, drilldown, `defaults.tokens`, smart source `$<ds>:result.x$`, or the Splunk environment `$env:*$`) and every place it is used, down to the JSON path |
| **Visibility conditions** | `expressions.conditions` with their expressions and the items they show or hide |
| **Defaults** | `defaults.dataSources` / `defaults.visualizations` inheritance, including tokens a data source picks up from defaults (unless it overrides them) |

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

You can explore the relationships in four ways:

- **Detail panel.** Click any item to see its properties, its direct relationships, its full upstream and downstream lineage, every token reference with its JSON path, and the raw definition.
- **Relationship map.** A column diagram running inputs → tokens → conditions → searches → chain levels → visualizations → tabs. Click a node to highlight its lineage, or focus on a single tab.
- **Relationship list.** A flat, filterable and sortable table of every edge.
- **"Driven by tokens."** Shows, for each visualization, which tokens change its results directly or through its searches.

## Issues detected

The page flags:

- references to missing data sources, base searches, layouts or conditions
- circular chains
- tokens that are used but never set, and tokens that are set but never used
- data sources nothing uses
- searches that name no index (they run against the viewer's default indexes)
- searches that run commands with side effects (`collect`, `sendemail`, `delete`, `script`, …)
- searches that write a lookup (they write on every load, input change and refresh)
- lookups written by one search and read by another in the same dashboard (searches run in parallel, so the read may happen before or after the write)
- visualizations and inputs that are not placed on any tab
- inputs with no token
- smart-source tokens whose data source does not set `enableSmartSources`

## Exports

- **Report (.md):** a documentation-ready Markdown write-up of the whole dashboard.
- **Inventory (.csv):** one row per item, with its upstream and downstream relationships.
- **Relationships (.csv):** one row per relationship.
- **Model (.json):** the full parsed model, including token references and issues.
