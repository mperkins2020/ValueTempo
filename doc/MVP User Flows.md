# MVP User Flows v0.5.1, decision-screen format

### Global UI pattern

- Left, Work Canvas  
- Right, Navigator panel (thought partner)  
- Top, Progress strip: Cycle → Units → Config → Sim → Approve  
- Top right, Completeness pill: Green, Amber, Red, plus “Next missing”

---

### Flow 0: Setup

### Screen 0A, Route `/setup/workspace`

**Operator decision:** What workspace am I creating and what role am I operating in?

**AVS Brain needs and why:** Workspace identity and role to apply defaults, permissions, and audit expectations.

Inputs

- workspace\_name (required)  
- operator\_role (required enum): founder, product\_growth, engineer

Outputs

- workspace record, includes `workspace_id` (generated)  
- operator session context, stores active `workspace_id` for later subject resolution  
- All configs later must reference `subject_resolution.workspace_id` from this workspace.

Validation and gating

- Continue disabled until both fields set

Objects touched

- Workspace

Telemetry

- `workspace_created`

CTA

- Continue to Data Mode

---

### Screen 0B, Route `/setup/data-mode`

**Operator decision:** Do I want mocked data or manual upload to make this cycle real?

**AVS Brain needs and why:** Event catalog and metric catalog must exist or Value Units cannot be defined.

Inputs

- data\_mode (required enum): mocked, csv\_upload, connectors\_stub  
- if csv\_upload: upload event\_catalog.csv, optional costs.csv

Outputs

- event\_catalog  
- metric\_catalog (curated, seeded)  
- quality\_signal\_catalog (seeded)  
- cost\_model defaults if missing

Validation and gating

- Continue disabled until data\_mode selected  
- If csv\_upload, event\_catalog required

Objects touched

- Catalogs

Telemetry

- `data_mode_selected`

CTA

- Start first cycle

---

### Flow 1: Create cycle, ingest context

### Screen 1A, Route `/cycles/new/context`

**Operator decision:** Do I want AVS Brain to infer segments and goals from docs, or enter manually?

**AVS Brain needs and why:** Context to draft credible defaults and reduce blank-page friction.

Inputs

- documents upload (optional)  
- paste text (optional)  
- skip flag (optional, if true then ignore uploads)

Outputs

- `cycle_draft_context` record linked to active `workspace_id`  
- extracted cards list (segments, candidate goal type, candidate metrics, constraints, candidate value units)  
- open questions list, max 5, each mapped to a specific required field in Screen 1B or Flow 2 (segments, goal\_type, primary\_metrics, value\_units, unit\_economics)

Validation and gating

- Continue enabled if at least one doc uploaded, or Skip clicked  
- If Skip clicked, disable upload controls and clear any selected files

Objects touched

- CycleDraftContext

Telemetry

- `context_uploaded` or `context_skipped`  
- `extractions_viewed`

CTA

- Review and confirm cycle

---

### Screen 1B, Route `/cycles/new/north-star`

**Operator decision:** What is the outcome I am optimizing for in this cycle, and how will I measure it?

**AVS Brain needs and why:** Goal type plus up to 3 metrics are required to evaluate readiness and simulation outputs.

Inputs (required)

- cycle\_name (required, short label)  
- cycle\_type: sandbox, production  
- period\_length\_days:  
  - production: fixed 90  
  - sandbox: 90 or 120  
- segments (multi-select)  
- goal\_type enum: pmf\_learning, revenue, margin, market\_share, data\_flywheel  
- primary\_metrics (multi-select, max 3): These metrics become required lenses in simulation and promotion gating.

Inputs (optional)

- narrative (1 to 2 sentences)

Outputs

- Cycle created in `draft` state, includes `cycle_id`  
- Cycle linked to `workspace_id`  
- CycleDraftContext linked to cycle for traceability (if it exists)

Validation and gating

- Continue disabled until required fields set  
- If production, period is forced 90  
- If sandbox 120, label “not promotable to production”  
- Downstream gate: production configs cannot be approved unless a ValueUnitSnapshot exists for this cycle

Objects touched

- Cycle

Telemetry

- `cycle_created`

CTA

- Continue to Value Units

---

### Flow 2: Value Units

### Screen 2A, Route `/cycles/:cycleId/value-units`

**Operator decision:** What unit represents real customer value, and do I have enough quality and economics context to trust it?

**AVS Brain needs and why:** Deterministic unit definitions for simulation, readiness checks, and billing patch mapping.

Inputs per value unit

- value\_unit\_id (system-generated, immutable)  
- name (required)  
- unit\_type enum (required): usage, outcome, quality\_adjusted\_outcome Note: MVP treats quality as advisory only. `quality_adjusted_outcome` does not change billing math or metered quantities in MVP, it only affects completeness flags and recommendations.  
- event\_mapping (required): event\_type, filters, aggregation  
  - aggregation enum: count, sum(field), distinct\_count(field)  
- outcome\_statement (required)  
- metrics\_intent mapping (required): per primary metric, expected impact enum: positive, negative, unknown  
- quality\_signal\_source (required for production promotion, advisory in MVP): multi-select, allow empty in draft but blocks promotion if pooled  
- unit\_economics (required for production promotion): avg\_cost\_per\_unit\_usd, target\_price\_per\_unit\_usd, target\_margin, economics\_confidence (rough, medium, high)

Outputs

- ValueUnitDefinition records created or updated  
- Completeness status computed per unit: green, amber, red  
- ValueUnitSnapshot version created on submit

Validation and gating

- Draft creation always allowed  
- Units can be Amber in sandbox  
- Completeness definition:  
  - Green: event\_mapping \+ outcome\_statement \+ metrics\_intent \+ unit\_economics \+ at least one quality signal  
  - Amber: missing unit\_economics or quality signal  
  - Red: missing event\_mapping or outcome\_statement  
- Promotion rule (referenced later): any value unit referenced in pools must be Green

Objects touched

- ValueUnitDefinition  
- ValueUnitSnapshot

Telemetry

- `value_unit_created`  
- `value_unit_updated`

CTA

- Submit units snapshot

---

### Screen 2B, Route /cycles/:cycleId/value-units/submit

**Operator decision:** Are these value units stable enough to anchor configuration work?

**AVS Brain needs and why:** A snapshot to prevent drift and to create a stable reference for config versions.

Inputs

- confirm submit

Outputs

- ValueUnitSnapshot created with `value_unit_snapshot_id` and `snapshot_version` incremented  
- Snapshot linked to `cycle_id`  
- Learning log entry created capturing edits accepted or rejected

Validation and gating

- Always allowed  
- Show warnings listing per value unit which fields prevent Green completeness (missing quality, missing economics, missing intent)

Objects touched

- ValueUnitSnapshot  
- LearningLogEntry

Telemetry

- `value_unit_snapshot_submitted`

CTA

- Proceed to Configurations

---

### Flow 3: Configurations

### Screen 3A, Route /cycles/:cycleId/configs/new

**Operator decision:** Which segment, stage, and environment am I configuring for right now, within which cycle?

**AVS Brain needs and why:** Segment, stage, and environment determine defaults and promotion gates. The config must be tied to a specific cycle and a submitted value unit snapshot to keep simulation and governance consistent.

Inputs (required)

- cycle\_id (required, prefilled from current cycle)  
- segment (required)  
- stage enum (required): learning, scaling  
- target\_environment enum (required): sandbox, production

Outputs

- ConfigVersion created in `draft` status, includes `config_version_id`  
- ConfigVersion includes `subject_resolution` { workspace\_id (from session), segment, stage, target\_environment }  
- ConfigVersion references latest ValueUnitSnapshot for the cycle (snapshot\_version)

Validation and gating

- Continue disabled until cycle\_id, segment, stage, and target\_environment are set  
- target\_environment \= production requires cycle\_type \= production (90 days)  
- target\_environment \= production requires a submitted ValueUnitSnapshot for this cycle  
- If target\_environment \= production, config cannot be created unless cycle period\_length\_days \= 90

Objects touched

- ConfigVersion (draft)

Telemetry

- `config_draft_created`

CTA

- Define Pools

---

### Screen 3B, Route `/configs/:configId/pools`

**Operator decision:** What is included vs charged for each value unit, and what happens at overage?

**AVS Brain needs and why:** Pools are the economic contract the customer app enforces. They must be explicit, versioned, and unambiguous.

Inputs per pool (required)

- pool\_id (system-generated, immutable)  
- value\_unit\_id (required)  
- label (required)  
- included\_quantity (required)  
- rollover (required): { enabled: boolean, max\_rollover\_quantity?: number, expires\_after\_days?: number }  
- overage\_behavior enum (required): allow\_overage, throttle, hard\_stop  
- is\_exploration\_pool (required boolean)

Defaults

- stage \= learning: suggest Core pool \+ Exploration pool (is\_exploration\_pool \= true)  
- stage \= scaling: suggest Core pool \+ Pro pool, optional small Exploration pool

Outputs

- Pools persisted to config version

Validation and gating

- If a pool references a value unit that is not Green, promotion is blocked later  
- If is\_exploration\_pool \= false and target\_price\_per\_unit\_usd \= 0 for that unit, warn (allowed, but likely misconfigured)

Objects touched

- ConfigVersion

Telemetry

- `pool_added`  
- `pool_updated`

CTA

- Configure Exploration

---

### Screen 3C, Route `/configs/:configId/exploration`

**Operator decision:** Do I subsidize exploration for this segment and stage, and how does it expire or graduate?

**AVS Brain needs and why:** Exploration must be explicit or it will leak cost and distort metrics. Exploration settings must point to a specific exploration pool.

Inputs

- exploration\_enabled (toggle)  
- exploration\_pool\_selector (required if enabled): select pool where is\_exploration\_pool \= true  
- qualifying\_events (required if enabled)  
- expires\_after\_days (required if enabled)  
- graduation\_signal (required if stage is scaling and exploration enabled)

Defaults

- learning: enabled by default, expires after **30 days (editable, 14–60 allowed)**  
- scaling: disabled by default

Outputs

- Exploration rules persisted, linked to the selected exploration pool

Validation and gating

- If enabled, require selected exploration pool \+ events \+ expiry  
- If enabled and stage \= scaling, require graduation\_signal

Objects touched

- ConfigVersion

Telemetry

- `exploration_configured`

CTA

- Configure Rails

---

### Screen 3D, Route `/configs/:configId/rails`

**Operator decision:** What constraints prevent cost blowups while preserving the path to value?

**AVS Brain needs and why:** Rails are required for safe rollout and for simulation risk detection. Rails must be deterministic so the customer app can enforce them.

Inputs (required for production target)

- usage\_thresholds array (required): apply per pool consumption percent, default 70/90/100  
  - each item: { percent: 70|90|100, action: warn|throttle|block|require\_approval|degrade\_quality }  
- monthly\_spend\_cap\_usd (required for production target)  
- at\_cap\_action enum (required for production target): warn, throttle, block, require\_approval, degrade\_quality  
- margin\_floor numeric (required for production target)

Inputs (optional)

- absolute\_usage\_caps (optional): per value\_unit\_id or per pool\_id, if needed for hard ceilings

Defaults

- learning: warn, warn, throttle  
- scaling: warn, throttle, block

Outputs

- Rails persisted

Validation and gating

- If production target, missing margin\_floor or monthly\_spend\_cap\_usd blocks promotion later  
- If usage\_thresholds missing any of 70/90/100, block simulate

Objects touched

- ConfigVersion

Telemetry

- `rails_configured`

CTA

- Simulate and Review

---

### Flow 4: Simulation gatekeeper

### Screen 4A, Route `/configs/:configId/simulate`

**Operator decision:** What am I comparing against and which window should I simulate over?

**AVS Brain needs and why:** Simulation inputs must be explicit for reproducibility and governance.

Inputs (required)

- baseline\_config\_version\_id: active or none  
- historical\_window\_days: 30, 60, 90, 120, or mocked  
- filter\_target\_segment\_stage toggle

Inputs (optional, defaulted in MVP)

- include\_exploration\_in\_results toggle (default: true)  
- pricing\_mode enum (default: use\_unit\_economics) **Definition:** revenue proxy uses `unit_economics.target_price_per_unit_usd` for each value unit

Outputs

- SimulationRun record created, linked to config\_version\_id and cycle\_id  
- SimulationRun stores inputs and derived outputs

Validation and gating

- Run enabled if config has at least one pool  
- Run blocked if no submitted ValueUnitSnapshot exists for the cycle

Objects touched

- SimulationRun

Telemetry

- `simulation_started`  
- `simulation_completed`

CTA

- Review Results

---

### Screen 4B, Route `/configs/:configId/review`

**Operator decision:** Do I promote this config, given predicted outcomes and risks?

**AVS Brain needs and why:** A clear gate decision, plus traceable evidence, simulation output, and blocking issues.

Outputs shown

- Primary metric deltas (declared in cycle)  
- Economic outcomes: revenue proxy, cost, margin, margin floor violations  
- Exploration outcomes (if enabled)  
- Blocking issues with deep links (generated by deterministic rules)  
- Completeness pill: Green, Amber, Red plus Next missing item

Promotion gating rules

Promotion disabled if any are true:

- cycle missing goal\_type or primary\_metrics  
- any pooled unit is not Green  
- any pooled unit is missing metrics\_intent mapping (at least one entry required)  
- if target\_environment \= production: rails incomplete (must include monthly\_spend\_cap\_usd and margin\_floor)  
- stage \= scaling and economics\_confidence below medium for any pooled unit  
- no SimulationRun exists for this config\_version\_id

Objects touched

- none, until approval

Telemetry

- `review_viewed`

CTA

- Approve and Activate

---

### Flow 5: Approve, activate, export billing patch

### Screen 5A, Route `/configs/:configId/approve`

**Operator decision:** Am I comfortable making this active, and can I justify it later?

**AVS Brain needs and why:** Approval metadata, a reproducible simulation reference, and a diff are required for governance and rollback.

Inputs (required)

- approver\_name  
- approver\_role  
- rationale  
- effective\_at  
- simulation\_run\_id (required, must be the latest completed SimulationRun for this config\_version\_id)  
- baseline\_config\_version\_id (required: active or none)

Outputs

- DecisionRecord created, includes:  
  - approver metadata \+ rationale  
  - diff versus baseline\_config\_version\_id  
  - simulation\_run\_id reference  
  - value\_unit\_snapshot\_version reference  
  - subject\_resolution and effective\_at  
- ConfigVersion status set to active (atomic activation)  
  - any prior active config for the same subject\_resolution is archived  
- BillingPatch generated with deterministic JSON payload (exportable)

Validation and gating

- Approve disabled until approver\_name, approver\_role, and rationale present  
- Approve disabled unless:  
  - a completed SimulationRun exists and matches simulation\_run\_id  
  - promotion gating is Green (no blocking issues)  
  - if target\_environment \= production: cycle\_type must be production and period\_length\_days \= 90

Objects touched

- DecisionRecord  
- ConfigVersion  
- BillingPatch

Telemetry

- `config_approved`  
- `config_activated`  
- `billing_patch_generated`

CTA

- View Active Config and Export

Note: Rollback is supported by re-activating a prior archived config version for the same subject\_resolution.

### Flow 6: Decision Log (system of record \+ storytelling)

### Screen 6A, Route `/decision-log`

**Operator decision:** Which AVS decisions matter right now, and where should I zoom in to understand why we made them?

**AVS Brain needs and why:** A navigable index of DecisionRecords so operators can trace changes, outcomes, and accountability over time.

Inputs

- filters (optional):  
  - date range  
  - segment  
  - stage (learning, scaling)  
  - target\_environment (sandbox, production)  
  - status (active, archived)  
  - goal\_type  
- search (optional): config\_version\_id, cycle\_id, keyword in rationale  
- sort (optional): newest first (default), biggest margin risk, biggest retention delta

Outputs shown

- Decision timeline list (cards or rows), each DecisionRecord includes:  
  - timestamp and effective\_at  
  - subject\_resolution summary (segment, stage, environment)  
  - cycle summary (goal\_type, primary\_metrics, period\_length\_days)  
  - decision outcome pill: Activated, Archived, Rolled back  
  - risk pill: Margin risk, Quality missing, Rails missing (if any)  
  - quick deltas summary from simulation: retention proxy, margin, exploration depth  
  - approver and short rationale preview (first 120 chars)  
  - link: “View decision”

Validation and gating

- None, read-only

Objects touched

- DecisionRecord (read)  
- ConfigVersion (read)  
- SimulationRun (read)

Telemetry

- `decision_log_viewed`  
- `decision_log_filtered`  
- `decision_log_item_opened`

CTA

- “Open decision detail”  
- “Compare two decisions”

---

### Screen 6B, Route `/decision-log/:decisionId`

**Operator decision:** Is this decision still correct, and what evidence do we have for it?

**AVS Brain needs and why:** A single, auditable narrative view that ties together config, diff, simulation, and approvals.

Sections shown

1. Decision header  
- DecisionRecord id  
- effective\_at, created\_at  
- approver\_name, approver\_role  
- subject\_resolution (workspace\_id, segment, stage, target\_environment)  
- status: active or archived  
- buttons: Export BillingPatch JSON, View Active RuntimeConfig  
1. Why we did this (rationale)  
- full rationale text  
- cycle narrative if present  
1. What changed (diff)  
- structured diff view:  
  - pools changes (included quantities, overage behaviors)  
  - exploration changes (enabled, expiry, qualifying events)  
  - rails changes (threshold actions, spend caps, margin floor)  
  - pricing refs changes (price\_book\_ref, target\_price\_per\_unit\_usd changes if applicable)  
1. Evidence (simulation)  
- simulation\_run\_id reference  
- baseline vs candidate summary  
- primary metric deltas and lens metrics  
- risk flags and blocking issues (should be empty if activated)  
1. Completeness snapshot  
- value unit snapshot version used  
- completeness pill per pooled value unit (green, amber, red)  
- missing fields list if any units were amber at approval time (allowed only for sandbox)  
1. Next recommended action (navigator)  
- deterministic suggestions, not free text:  
  - “Consider tightening rails: margin\_floor violated in simulation”  
  - “Promote draft exploration pool to core if graduation signal hit”  
  - “Add quality signal for unit X before scaling”

Validation and gating

- Production decisions are read-only  
- Sandbox decisions allow “Fork config” action

Actions

- Fork this decision into a new draft config (creates new ConfigVersion referencing this decision as baseline)  
- Compare to another decision (opens Screen 6C)

Objects touched

- DecisionRecord (read)  
- ConfigVersion (read)  
- SimulationRun (read)  
- BillingPatch (read)  
- ValueUnitSnapshot (read)

Telemetry

- `decision_detail_viewed`  
- `decision_forked`  
- `decision_patch_exported`

CTA

- “Fork into new draft”  
- “Compare decision”

---

### Screen 6C, Route `/decision-log/compare`

**Operator decision:** Which config is better for our current goal, and what tradeoffs changed between them?

**AVS Brain needs and why:** A structured comparison to prevent “opinion fights” and keep decisions tied to evidence.

Inputs (required)

- decision\_id\_a  
- decision\_id\_b

Outputs shown

- side-by-side comparison:  
  - subject\_resolution and cycle metadata  
  - pools diff table  
  - rails diff table  
  - exploration diff table  
  - unit economics diff (avg\_cost\_per\_unit\_usd, target\_price\_per\_unit\_usd, target\_margin)  
  - simulation deltas comparison  
  - risk flags comparison  
- “Which would you ship?” prompt with optional notes

Validation and gating

- Require both decision IDs

Objects touched

- DecisionRecord (read)  
- ConfigVersion (read)  
- SimulationRun (read)

Telemetry

- `decision_compare_viewed`

CTA

- “Fork winner into new draft”  
- “Export comparison summary”

### Minimal UI requirements for Decision Log

- Timeline list with filters, search, and pill badges  
- Detail page with rationale, diff, simulation summary, and export  
- Compare view for two decisions

### MVP default dataset behavior

- Seed at least 2 DecisionRecords:  
  - one active sandbox config  
  - one candidate promoted config  
- Seed associated SimulationRuns and BillingPatches for each

## Decision Log, objects and endpoints

### Objects

**DecisionRecord**

- `decision_id`  
- `workspace_id`  
- `cycle_id`  
- `config_version_id`  
- `baseline_config_version_id` (or null)  
- `simulation_run_id`  
- `billing_patch_id`  
- `subject_resolution` { `workspace_id`, `segment`, `stage`, `target_environment` }  
- `status` enum: active, archived  
- `approver_name`, `approver_role`  
- `rationale`  
- `effective_at`, `created_at`  
- `diff` (structured)

**DecisionSummary (derived, for list view)**

- `decision_id`  
- `subject_resolution` summary  
- `cycle` summary: `goal_type`, `primary_metrics`, `period_length_days`  
- `outcome_pill` enum: activated, archived, rolled\_back  
- `risk_pills` array (derived from sim output and completeness)  
- `sim_deltas` summary: retention proxy, margin, exploration depth  
- `approver_name`  
- `rationale_preview`

---

### Endpoints

### 1\) List decisions

`GET /api/decision-records`

Query params (optional):

- `workspace_id` (required in practice, inferred from session in MVP)  
- `from` (ISO date)  
- `to` (ISO date)  
- `segment`  
- `stage` (learning, scaling)  
- `target_environment` (sandbox, production)  
- `status` (active, archived)  
- `goal_type`  
- `q` (search across `decision_id`, `cycle_id`, `config_version_id`, rationale text)  
- `sort` enum: newest, margin\_risk, retention\_delta, exploration\_delta

Response:

- `items: DecisionSummary[]`  
- `next_cursor` (optional, for pagination)

### 2\) Decision detail

`GET /api/decision-records/:decisionId`

Response:

- `decision_record` (full DecisionRecord)  
- `config_version` (snapshot or current record)  
- `cycle` (north star metadata)  
- `simulation_run` (inputs \+ outputs)  
- `billing_patch` (exportable payload)  
- `value_unit_snapshot` (version \+ unit completeness map)

### 3\) Compare two decisions

`GET /api/decision-records/compare?decision_id_a=...&decision_id_b=...`

Response:

- `a` and `b` detail summaries  
- `diff_tables`:  
  - pools\_diff  
  - rails\_diff  
  - exploration\_diff  
  - unit\_economics\_diff  
- `simulation_comparison`:  
  - primary\_metric\_deltas  
  - lens\_metric\_deltas  
  - risk\_flags

### 4\) Fork decision into new draft config

`POST /api/decision-records/:decisionId/fork`

Body (required):

- `cycle_id` (target cycle)  
- `target_environment` (sandbox, production)  
- optional overrides:  
  - `segment`  
  - `stage`

Behavior:

- Creates new `ConfigVersion` in `draft` status  
- Copies pools, exploration, rails, and references the same value unit snapshot version used by the source decision  
- Sets `baseline_config_version_id` to the source decision’s config\_version\_id

Response:

- `new_config_version_id`  
- `route_next`: `/configs/:configId/pools` (or `/configs/:configId/review` if you support “fork and review”)

---

### MVP seed requirement

- Seed at least 2 DecisionRecords:  
  - one active sandbox config  
  - one approved production config (or candidate draft with a completed simulation if you’re not activating in seed)  
- Seed associated SimulationRuns and BillingPatches for each decision

