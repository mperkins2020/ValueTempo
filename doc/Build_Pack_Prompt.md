# Build Pack Prompt

\*\*Spec precedence:\*\* If anything conflicts, follow this order: (1) Build Pack Prompt, (2) PRD, (3) MVP User Flows, (4) Canonical Data Model, (5) Seed JSON Reference. Do not invent new field names, reuse the canonical naming exactly.

Build an MVP web app called AVS Brain, a decisioning layer for an AI-native product that outputs versioned AVS configs and decision records, while runtime enforcement of pools and rails happens in the customer app.

Tech stack:

\- Next.js App Router, TypeScript

\- Tailwind CSS \+ shadcn/ui components

\- Prisma ORM with SQLite for local dev

\- No external auth required for MVP, use a single local workspace and a fake operator session

\- Create a rules-based Navigator panel for MVP, do not require OpenAI keys. The Navigator should:

  \- show extracted cards from uploaded docs (stubbed extraction for now)

  \- show a max 5 question checklist that maps to missing required fields

  \- show “Next missing item” based on deterministic completeness rules

Core product constraints:

\- Production cycles are fixed 90 days. Sandbox cycles can be 90 or 120 days.

\- Stage enum is exactly: learning, scaling.

\- Quality is advisory in MVP: it affects completeness and recommendations, not billing math or metered quantities.

\- AVS Brain by ValueTempo is system of record for decisions and versions.

\- The customer app enforces pools and rails; AVS Brain provides a deterministic config for enforcement and caching.

\- subject\_resolution is always: { workspace\_id, segment, stage, target\_environment }.

Canonical naming (must be consistent across DB, APIs, UI, and seed):

\- Use metrics\_intent (not metric\_intent).

\- Use quality\_signal\_source (array of signal\_id strings, not nested objects).

\- Use unit\_economics:

  { avg\_cost\_per\_unit\_usd, target\_price\_per\_unit\_usd, target\_margin, economics\_confidence }.

  NOTE: avg\_cost\_per\_unit\_usd and target\_price\_per\_unit\_usd are PER VALUE UNIT, not totals.

\- Use pools (not value\_pools), rails (not safety\_rails), exploration (not exploration\_mode).

\- Use config\_version\_id and baseline\_config\_version\_id consistently.

Data models (Prisma):

Implement Prisma models for:

\- Workspace

\- Cycle

\- CycleDraftContext

\- ValueUnitDefinition

\- ValueUnitSnapshot

\- ConfigVersion

\- Pool

\- ExplorationRule (or embed exploration fields on ConfigVersion, but keep schema deterministic)

\- RailRule (or embed rails fields on ConfigVersion, but keep schema deterministic)

\- SimulationRun

\- DecisionRecord

\- EnforcementEvent

\- BillingPatch

Catalog tables:

\- EventCatalog

\- MetricCatalog

\- QualitySignalCatalog

\- Customer

\- SegmentCatalog (recommended, can be seeded or derived, but must exist as a stable picklist)

Store subject\_resolution as explicit fields on ConfigVersion:

workspace\_id, segment, stage, target\_environment.

Pages and routes:

\- /setup/workspace

\- /setup/data-mode

\- /cycles/new/context

\- /cycles/new/north-star

\- /cycles/\[cycleId\]/value-units

\- /cycles/\[cycleId\]/configs/new

\- /configs/\[configId\]/pools

\- /configs/\[configId\]/exploration

\- /configs/\[configId\]/rails

\- /configs/\[configId\]/simulate

\- /configs/\[configId\]/review

\- /configs/\[configId\]/approve

\- /decision-log

\- /decision-log/\[decisionId\]

\- /decision-log/compare

\- /catalogs (read-only catalogs with deep links)

UI requirements:

\- Persistent layout: Work Canvas left, Navigator right, progress strip top, completeness pill top-right.

\- Every screen shows:

  \- Operator decision

  \- What AVS Brain needs and why

\- Tables:

  \- Value unit table with detail pane

  \- Pools table editor

  \- Diff viewer on approve screen

\- Completeness pill: green, amber, red, plus “Next missing item” label.

\- Catalogs UI:

  \- Tabs: Events, Metrics, Quality Signals, Segments, Customers

  \- Search \+ filters

  \- Copy ID action on each row

  \- Side panel details with “Referenced in” and deep links back

Completeness \+ gating rules (deterministic):

\- Drafts are allowed even if incomplete (Amber/Red), Navigator shows missing fields.

\- Simulation enabled only if:

  \- cycle has goal\_type and at least one primary\_metric, AND

  \- config has at least one pool, AND

  \- every pooled value unit has event\_mapping and unit\_economics.

  \- quality\_signal\_source does NOT block simulation in MVP.

\- Approve/activate (production) is blocked unless:

  \- cycle\_type=production AND period\_length\_days=90, AND

  \- rails are complete: monthly\_spend\_cap\_usd, margin\_floor, and usage\_thresholds include 70, 90, 100, AND

  \- for EVERY pooled value unit:

    \- metrics\_intent present

    \- unit\_economics present

    \- quality\_signal\_source has at least one signal\_id

\- Additional rule:

  \- if stage=scaling AND target\_environment=production, pooled units require economics\_confidence \>= medium.

APIs:

Runtime config (for customer app enforcement):

\- GET /api/runtime/config?workspace\_id=\&segment=\&stage=\&target\_environment=

Returns an avs\_config payload for the ACTIVE config\_version matching subject\_resolution.

The customer app caches this config and enforces without synchronous calls to AVS Brain.

avs\_config response shape (must be deterministic and versioned):

{

  avs\_version,

  cycle\_id,

  config\_version\_id,

  effective\_at,

  north\_star { goal\_type, primary\_metrics, narrative? },

  subject\_resolution { workspace\_id, segment, stage, target\_environment },

  quality\_mode: "advisory",

  value\_units: \[ { value\_unit\_id, name, event\_mapping, metrics\_intent, quality\_signal\_source, unit\_economics } \],

  pools: \[ { pool\_id, label, value\_unit\_id, included\_quantity, rollover, overage\_behavior, is\_exploration\_pool } \],

  exploration: { enabled, exploration\_pool\_id?, qualifying\_events?, expires\_after\_days?, graduation\_signal? },

  rails: { usage\_thresholds, monthly\_spend\_cap\_usd, at\_cap\_action, margin\_floor },

  rating\_agility: { price\_book\_ref },

  metric\_lenses: \[metric\_id...\],

  governance: { approval\_ref?, config\_status, audit: \[ {type, by, at}... \] },

  generated\_at,

  source

}

Enforcement outcomes:

\- POST /api/enforcement-events

Records enforcement outcomes (warnings, throttles, blocks, overrides, exploration graduation, quality proxy failed).

Body includes:

workspace\_id, customer\_id, config\_version\_id, occurred\_at, event\_type, context (json).

Authoring:

\- CRUD for cycles, cycle draft context, value units, value unit snapshots, config versions, pools, exploration rules, rails.

Simulation:

\- POST /api/simulations

Input:

candidate\_config\_version\_id

baseline\_config\_version\_id (optional)

historical\_window\_days (30/60/90/120 or mocked)

filters: segment, stage, target\_environment

Store a SimulationRun with inputs and outputs, including risks list and blocking issues list.

Approval and activation:

\- POST /api/approve

Activates a config\_version:

\- requires a completed SimulationRun reference

\- creates a DecisionRecord including:

  diff vs baseline, approval metadata, simulation\_run\_id, value\_unit\_snapshot\_version

\- generates a BillingPatch JSON payload

\- enforces one active config per subject\_resolution by archiving any prior active config for the same subject.

Decision log:

\- GET /api/decision-records (list with filters and search)

\- GET /api/decision-records/:decisionId (detail with rationale, diff, sim summary, billing patch export)

\- GET /api/decision-records/compare?decision\_id\_a=\&decision\_id\_b=

\- POST /api/decision-records/:decisionId/fork (create new draft config from a prior decision)

Simulation MVP logic:

\- Use seeded usage\_events.json.

\- For each value unit, compute usage based on event\_type \+ filters \+ aggregation.

\- Apply pools to compute included vs overage.

\- Compute simple economics:

  \- revenue\_usd \= sum(overage\_units \* target\_price\_per\_unit\_usd)

  \- cost\_usd \= sum(total\_units \* avg\_cost\_per\_unit\_usd)

  \- margin \= (revenue\_usd \- cost\_usd) / max(revenue\_usd, epsilon)

\- Compute exploration\_depth \= count of qualifying exploration events in window.

\- Flag regressions:

  \- margin\_floor violated

  \- spend cap exceeded

\- Output must include:

  metric deltas (even if proxies), risks list, blocking issues list.

\- historical\_window\_days supported: 30, 60, 90, 120, mocked.

Exploration modeling:

\- Exploration quantity comes from the pool marked is\_exploration\_pool=true.

\- Exploration rules reference that pool (exploration\_pool\_id) and define qualifying\_events, expires\_after\_days, graduation\_signal.

Billing patch:

\- Generate a BillingPatch JSON payload mapping value units to billable meters, products, and rate card updates.

\- Do not call Metronome APIs in MVP.

\- Provide an export button to view and copy the JSON.

Seed data:

Load JSON files from /seed/\*.json on first run into SQLite via a seed script.

Include:

\- workspaces.json

\- event\_catalog.json

\- metric\_catalog.json

\- quality\_signal\_catalog.json

\- customers.json

\- segment\_catalog.json

\- usage\_events.json

\- cycles.json

\- value\_units.json

\- value\_unit\_snapshots.json

\- configs.json

\- simulation\_runs.json

\- decision\_records.json

\- billing\_patches.json

Deliverables:

\- A working local app with seeded demo data

\- Ability to complete Flow 0 to 6, ending with:

  \- an active config

  \- a DecisionRecord

  \- a BillingPatch export

  \- a Decision Log list and detail view

\- Runtime config endpoint returns the active config for enforcement by the customer app

\- Catalogs page supports deep linking from pickers and copyable stable IDs

