# Build Pack Prompt v0.7 (AVS Brain by ValueTempo, canonical)

**Spec precedence:** If anything conflicts, follow this order: (1) Build Pack Prompt, (2) PRD, (3) MVP User Flows, (4) Canonical Data Model, (5) Seed JSON Reference. Do not invent new field names, reuse the canonical naming exactly.

Build an MVP web app called **AVS Brain by ValueTempo** (AVS Brain), the AVS brain decisioning layer for an AI-native product that outputs versioned AVS configs and decision records, while runtime enforcement of pools and rails happens in the customer app.

## Tech stack

- Next.js App Router, TypeScript  
- Tailwind CSS \+ shadcn/ui components  
- Prisma ORM with SQLite for local dev  
- No external auth required for MVP, use a single local workspace and a fake operator session  
- Create a rules-based Navigator panel for MVP, do not require OpenAI keys. The Navigator should:  
- show extracted cards from uploaded docs (stubbed extraction for now)  
- show a max 5 question checklist that maps to missing required fields  
- show “Next missing item” based on deterministic completeness rules

## Core product constraints

- Production cycles are fixed 90 days. Sandbox cycles can be 90 or 120 days.  
- Stage enum is exactly: `learning`, `scaling`.  
- Quality is advisory in MVP: it affects completeness and recommendations, not billing math or metered quantities.  
- AVS Brain is system of record for decisions and versions.  
- The customer app enforces pools and rails, AVS Brain provides a deterministic config for enforcement and caching.  
- `subject_resolution` is always: `{ workspace_id, segment, stage, target_environment }`.

## Canonical naming (must be consistent across DB, APIs, UI, and seed)

- Use `metrics_intent` (not `metric_intent`).  
- Use `quality_signal_source` (array of `signal_id` strings, not nested objects).  
- Use `unit_economics`: `{ avg_cost_per_unit_usd, target_price_per_unit_usd, target_margin, economics_confidence }`. Note: `avg_cost_per_unit_usd` and `target_price_per_unit_usd` are per value unit, not totals.  
- Use `pools` (not `value_pools`), `rails` (not `safety_rails`), `exploration` (not `exploration_mode`).  
- Use `config_version_id` and `baseline_config_version_id` consistently.  
- Use `PricingMode` for simulation inputs:  
- `pricing_mode` enum (default): `use_unit_economics`

## Data models (Prisma)

Implement Prisma models for:

- Workspace  
- Cycle  
- CycleDraftContext  
- ValueUnitDefinition  
- ValueUnitSnapshot  
- ConfigVersion  
- Pool  
- ExplorationRule (or embed exploration fields on ConfigVersion, but keep schema deterministic)  
- RailRule (or embed rails fields on ConfigVersion, but keep schema deterministic)  
- SimulationRun  
- DecisionRecord  
- EnforcementEvent  
- BillingPatch

Catalog tables:

- EventCatalog  
- MetricCatalog  
- QualitySignalCatalog  
- Customer  
- SegmentCatalog (required as a stable picklist)

Store `subject_resolution` as explicit fields on ConfigVersion: `workspace_id`, `segment`, `stage`, `target_environment`.

## Pages and routes

- /setup/workspace  
- /setup/data-mode  
- /cycles/new/context  
- /cycles/new/north-star  
- /cycles/\[cycleId\]/value-units  
- /cycles/\[cycleId\]/configs/new  
- /configs/\[configId\]/pools  
- /configs/\[configId\]/exploration  
- /configs/\[configId\]/rails  
- /configs/\[configId\]/simulate  
- /configs/\[configId\]/review  
- /configs/\[configId\]/approve  
- /decision-log  
- /decision-log/\[decisionId\]  
- /decision-log/compare  
- /catalogs (read-only catalogs with deep links)

## UI requirements

- Persistent layout: Work Canvas left, Navigator right, progress strip top, completeness pill top-right.  
- Every screen shows:  
- Operator decision  
- What AVS Brain needs and why  
- Tables:  
- Value unit table with detail pane  
- Pools table editor  
- Diff viewer on approve screen  
- Completeness pill: green, amber, red, plus “Next missing item” label.  
- Catalogs UI:  
- Tabs: Events, Metrics, Quality Signals, Segments, Customers  
- Search \+ filters  
- Copy ID action on each row  
- Side panel details with “Referenced in” and deep links back

## Completeness and gating rules (deterministic)

- Drafts are allowed even if incomplete (Amber/Red), Navigator shows missing fields.  
- Simulation enabled only if:  
- cycle has `goal_type` and at least one `primary_metric`, and  
- config has at least one pool, and  
- every pooled value unit has `event_mapping` and `unit_economics`.  
- `quality_signal_source` does not block simulation in MVP.  
- Approve and activate (production) is blocked unless:  
- `cycle_type=production` and `period_length_days=90`, and  
- rails are complete: `monthly_spend_cap_usd`, `margin_floor`, and `usage_thresholds` include 70, 90, 100, and  
- for every pooled value unit:  
- `metrics_intent` present  
- `unit_economics` present  
- `quality_signal_source` has at least one `signal_id`  
- Additional rule:  
- if `stage=scaling` and `target_environment=production`, pooled units require `economics_confidence >= medium`.

## APIs

### Runtime config (for customer app enforcement)

- GET `/api/runtime/config?workspace_id=&segment=&stage=&target_environment=`

Returns an `avs_config` payload for the ACTIVE ConfigVersion (status=`active`) matching `subject_resolution`.

The customer app caches this config and enforces without synchronous calls to AVS Brain.

#### avs_config response shape (must be deterministic and versioned)

{

 "avs_version": "v2.0",

 "cycle_id": "cycle_...",

 "config_version_id": "cfg_...",

 "effective_at": "2026-01-15T00:00:00Z",

 "north_star": { "goal_type": "pmf_learning", "primary_metrics": \["paid_engagement_retention_90d"\], "narrative": "..." },

 "subject_resolution": { "workspace_id": "ws_...", "segment": "ai_video_smb", "stage": "learning", "target_environment": "production" },

 "quality_mode": "advisory",

 "value_units": \[

 { "value_unit_id": "vu_...", "name": "Usable HD minute", "event_mapping": {}, "metrics_intent": \[\], "quality_signal_source": \["csat"\], "unit_economics": {} }

 \],

 "pools": \[

 { "pool_id": "pool_core", "label": "Core", "value_unit_id": "vu_...", "included_quantity": 300, "rollover": { "enabled": false }, "overage_behavior": "allow_overage", "is_exploration_pool": false }

 \],

 "exploration": { "enabled": true, "exploration_pool_id": "pool_exploration", "qualifying_events": \["labs_feature_used"\], "expires_after_days": 30, "graduation_signal": "repeat_usage_threshold" },

 "rails": { "usage_thresholds": \[{"percent":70,"action":"warn"}\], "monthly_spend_cap_usd": 650, "at_cap_action": "require_approval", "margin_floor": 0.68 },

 "rating_agility": { "price_book_ref": "usd_2026_01_default" },

 "metric_lenses": \["exploration_depth", "gross_margin"\],

 "governance": {

 "config_version_id": "cfg_...",

 "approval_ref": "dec_...",

 "config_status": "active",

 "audit": \[{ "type": "approved", "by": "Theresa, CEO", "at": "2026-01-14T23:00:00Z" }\]

 },

 "generated_at": "2026-01-14T22:10:00Z",

 "source": "avs_brain_operator_ui"

}

Notes:

- `governance.approval_ref` must be the `decision_id` of the DecisionRecord that activated this config_version.

### Enforcement outcomes

- POST `/api/enforcement-events`

Records enforcement outcomes (warnings, throttles, blocks, overrides, exploration graduation, quality proxy failed).

Body includes: `workspace_id`, `customer_id`, `config_version_id`, `occurred_at`, `event_type`, `context` (json).

### Authoring

CRUD for cycles, cycle draft context, value units, value unit snapshots, config versions, pools, exploration rules, rails.

### Simulation

- POST `/api/simulations`

Input:

- `candidate_config_version_id`  
- `baseline_config_version_id` (optional)  
- `historical_window_days` (30/60/90/120 or mocked)  
- `filters`: segment, stage, target_environment  
- `pricing_mode` (PricingMode, default `use_unit_economics`)  
- `include_exploration_in_results` (default true)

Store a SimulationRun with inputs and outputs, including risks list and blocking issues list.

### Approval and activation

- POST `/api/approve`

Activates a ConfigVersion:

- requires a completed SimulationRun reference  
- creates a DecisionRecord including: diff vs baseline, approval metadata, `simulation_run_id`, `value_unit_snapshot_version`  
- generates a BillingPatch JSON payload  
- enforces one active config per subject_resolution by archiving any prior active config for the same subject

### Decision log

- GET `/api/decision-records` (list with filters and search)  
- GET `/api/decision-records/:decisionId` (detail with rationale, diff, sim summary, billing patch export)  
- GET `/api/decision-records/compare?decision_id_a=&decision_id_b=`  
- POST `/api/decision-records/:decisionId/fork` (create new draft config from a prior decision)

## Simulation MVP logic

- Use seeded `usage_events.json`.  
- For each value unit, compute usage based on `event_type` \+ filters \+ aggregation.  
- Apply pools to compute included vs overage.  
- Compute simple economics:  
- `revenue_usd = sum(overage_units * target_price_per_unit_usd)`  
- `cost_usd = sum(total_units * avg_cost_per_unit_usd)`  
- `margin = (revenue_usd - cost_usd) / max(revenue_usd, epsilon)`  
- Compute `exploration_depth = count(qualifying exploration events in window)`.  
- Flag regressions:  
- margin_floor violated  
- spend cap exceeded  
- Output must include: metric deltas (even if proxies), risks list, blocking issues list.  
- `historical_window_days` supported: 30, 60, 90, 120, mocked.

## Exploration modeling

- Exploration quantity comes from the pool marked `is_exploration_pool=true`.  
- Exploration rules reference that pool (`exploration_pool_id`) and define `qualifying_events`, `expires_after_days`, `graduation_signal`.

## Billing patch

- Generate a BillingPatch JSON payload mapping value units to billable meters, products, and rate card updates.  
- Do not call Metronome APIs in MVP.  
- Provide an export button to view and copy the JSON.

### Billing patch export

- POST `/api/export/billing-patch`  
    
- Input: `{ "config_version_id": "cfg_..." }`  
    
- Output: BillingPatch `{ billing_patch_id, price_book_ref, effective_at, payload }`  
    
- GET `/api/billing-patch/:config_version_id`  
    
- Output: BillingPatch `{ billing_patch_id, price_book_ref, effective_at, payload }`

## Seed data

Load JSON files from `/seed/*.json` on first run into SQLite via a seed script.

Include:

- workspaces.json  
- event_catalog.json  
- metric_catalog.json  
- quality_signal_catalog.json  
- customers.json  
- segment_catalog.json  
- usage_events.json  
- cycles.json  
- value_units.json  
- value_unit_snapshots.json  
- configs.json  
- simulation_runs.json  
- decision_records.json  
- billing_patches.json

## Deliverables

- A working local app with seeded demo data  
- Ability to complete Flow 0 to 6, ending with:  
- an active config  
- a DecisionRecord  
- a BillingPatch export  
- a Decision Log list and detail view  
- Runtime config endpoint returns the active config for enforcement by the customer app  
- Catalogs page supports deep linking from pickers and copyable stable IDs

