# AVS Brain by ValueTempo: AVS Decisioning Layer, Requirements for Lumina Video MVP

### TL;DR

The AVS Brain decisioning layer (AVS brain) mandates that every production configuration operates on a 90-day north-star cycle and enforces explicit goal types and primary metrics. Teams are required to formally connect value units to product-market fit (PMF), outcome quality, and unit economics—not just raw usage—driving real economic learning and robust linkage between what’s measured and what matters.

## Note: “Lumina” as the example customer

## System boundaries and contracts

**AVS Brain role**

* AVS Brain is the **control plane** and **system of record** for AVS decisions, configs, and rationale.  
    
* AVS Brain generates versioned policies, simulations, and billing patches; it does not enforce runtime usage limits.

**Customer app role**

* The customer app is the **data plane**, it enforces pools and rails at runtime using the active config fetched from AVS Brain and cached locally.  
    
* The customer app emits enforcement outcomes back to AVS Brain for learning and audit.

**Billing system role (Metronome or similar)**

* Billing is the **ledger**, it meters and invoices.  
* AVS Brain may push pricing references upstream as a billing patch, billing does not own pool and rail enforcement.

### **MVP scope, goals, and non-goals**

**MVP goals**

* Generate a coherent AVS cycle, value units, and a config for a segment and stage.  
    
* Run a deterministic simulation that produces a gate decision, ready or not ready.  
    
* Create an approval record and a versioned active config.  
    
* Export a billing patch payload (even if actual push is stubbed in MVP).

**MVP non-goals**

* No billing execution inside AVS Brain.  
    
* No contract negotiation logic.  
    
* No full experimentation system (assignment, holdouts, causal reads). MVP uses simulation, not experiments.

### **Period rules**

* **Production cycle length is fixed to 90 days.**  
    
* Sandbox cycles may be 90 or 120 days.  
    
* Only 90-day cycles can be promoted to production.

### **Stage enum for MVP**

* Stage is a required enum with exactly two values:  
    
  * `learning`  
      
  * `scaling`

Stage must drive defaults and promotion strictness, otherwise it is removed.

### **Quality is advisory in MVP**

* Quality signals are required inputs for completeness and recommendations.  
    
* Quality does not alter billing math in MVP.  
    
* Simulation may flag quality risk, but pricing output remains unaffected.

### **Enforcement contract, what AVS Brain outputs, what the app enforces**

AVS Brain must output a deterministic enforcement policy:

* Value unit counting rules (event type, filters, aggregation)  
    
* Pools (included quantities, rollover policy, overage behavior)  
    
* Exploration rules (qualifying events, expiration, graduation signal)  
    
* Rails (thresholds, caps, actions)

Allowed action enums:

* `warn`  
    
* `throttle`  
    
* `block`  
    
* `require_approval`  
    
* `degrade_quality`

Runtime enforcement happens only in the customer app.

### **Versioning, audit, and decision record**

Every change to a production config must produce:

* Config version snapshot  
    
* Diff versus previous active version  
    
* Approval metadata (approver, rationale)  
    
* Simulation run reference  
    
* Effective date

### **Learning loop inputs, enforcement outcomes**

Customer app posts enforcement outcomes to AVS Brain:

* `rail_warning_shown`  
    
* `rail_throttle_applied`  
    
* `hard_cap_blocked`  
    
* `exploration_graduated`  
    
* `override_approved`  
    
* `quality_proxy_failed`

AVS Brain stores these as evidence tied to config versions.

**Interface summary**

* `RuntimeConfig`, AVS Brain → App (for enforcement)  
* `EnforcementEvent`, App → AVS Brain (outcomes \+ audit)  
* `BillingPatch`, AVS Brain → Billing adapter (export or push)

**Runtime availability rule**

* “Customer app must cache the active config locally and enforce without calling AVS Brain synchronously.”

## Goals

### Business Goals

* **Drive sustainable margins:** Reduce under- and over-monetization by 20% by enforcing that all configs specify explicit unit economics (average cost, target price, target margin), creating much tighter pricing guidance.  
    
* **90-Day PMF refinement:** Institutionalize 90-day review cycles for updating north-star business goals to reflect new data and market dynamics, preventing PMF decay.  
    
* **Close the value loop:** Ensure every AVS config closes the loop between user/job outcomes, value quality, and unit economics to maximize customer lifetime value.  
    
* **Strengthen economic trust:** Provide true economic visibility for all experiments, with change history tied to north-star objectives.

### User Goals

* **Empower experimentation:** Product and growth leaders can define, simulate, and evolve value-based models with direct mapping to key goals and explicit value/quality/economic definitions.  
    
* **Segmentation & stage clarity:** AVS supports precise configs for customer segments and stages, each mapped to specific north stars.  
    
* **Safety & control:** Clearly defined rails, validated in AVS Brain, enforced in the app per 90-day AVS cycle.  
    
* **Transparent workflow:** Governance, simulation, and promotion tightly integrated, making every config traceable back to its goals and value definitions.

### Non-Goals

* AVS will **never** handle billing or payments.  
    
* Will **not** generate generic, unspecific price recommendations or act as a pricing admin tool.  
    
* AVS does **not** replace contract negotiation or enterprise deal-making that requires human judgment.

---

## User Stories

**Personas:**

1. **Founder**  
     
* As a founder, I want to define a required 90-day north-star north star and explicit goal type so my team aligns on the right business outcome each 90 days.  
    
* As a founder, I want visibility into any config missing unit economics or quality signals so I can ensure economic sustainability.  
    
* As a founder, I require rollback capability if margin or PMF risks arise.  
    
2. **Head of Product/Growth**  
     
* As a product/growth leader, I must create AVS configs by stage (learning or scaling) and north star to tailor user value.  
    
* I want to simulate changes, with all required primary metrics and unit economics present before shipping anything to production.  
    
3. **Engineer**  
     
* I need a predictable AVS config API that validates presence of goal type, primary metrics, metrics intent, and unit economics.  
    
* As an engineer, I require simulation APIs that break down results by all declared north-star `primary_metrics` and `metric_lenses`, and include quality coverage and risk flags, so I can spot unintended economic and enforcement risks.

---

## Functional Requirements

### Design Principles

* **90-Day Cycle Enforcement:** All production AVS configs are governed strictly by a 90-day window, anchored to an explicit north-star `goal_type`. There must be no multi-year or indefinite configs in production.  
    
* Sandbox cycles may be 90 or 120 days, sandbox cycles cannot be promoted to production if 120 days.  
    
* **North Star Alignment Required:** Every config must declare a single north-star `goal_type` (one of: `pmf_learning`, `revenue`, `margin`, `market_share`, `data_flywheel`) and specify up to three `primary_metrics`.  
    
* **Hard Mapping to Value/Quality/Economics:** Each config must define value units linked to: (a) measurable job completion/outcomes, (b) at least one explicit quality signal/source, and (c) quantified unit economics (avg\_cost\_per\_unit\_usd, target\_price\_per\_unit\_usd, target margin).  
    
* **Economic Depth over Activity:** AVS insists on linking value units to PMF, quality, and unit economics, not just usage or billing proxies.  
    
* **Billing Upstream, Never In-System:** AVS can push configs to billing but will never perform billing, calculation, or processing itself.

### Configuration & Governance

* **North-Star-Driven:** Enforce config authoring tied to one north star, explicit primary metrics, and defined value units for every production cycle.  
    
* **Governance Tracking:** All changes logged with clear diffs and references to the impacted north star and goals.  
    
* **DecisionRecord required for production activation:** Must include: approver, rationale, diff, simulation reference, effective date  
    
* **ConfigVersioning:** Draft, simulated, approved, active, archived

### Data Ingestion

* Ingest and map historical data to value units, **requiring** explicit mapping to unit economics (i.e., not just event counts).

## **APIs**

### **API A: Runtime config for enforcement (AVS Brain → customer app)**

**Purpose**  
The customer app fetches the active config and enforces pools and rails locally. AVS Brain is not in the per-request inference path, it only serves deterministic config for caching.

**Endpoint**  
`GET /api/runtime/config`

**Query params (required)**

* `workspace_id`  
    
* `segment` (example: `ai_video_smb`)  
    
* `stage` (enum: `learning`, `scaling`)  
    
* `target_environment` (enum: `sandbox`, `production`)

**Query params (optional)**

* `product_area` (only if needed to route configs)  
    
* `customer_id` (future, only if customer-specific overrides exist)

**Caching rule**  
The customer app must cache the returned config locally and enforce without calling AVS Brain synchronously.

**Response payload: `avs_config` (required structure for production configs)**  
**Note: the following fields are required for every production config response:**

* **`north_star` (must include `goal_type` and `primary_metrics`)**  
    
* **`subject_resolution` (must include `workspace_id`, `segment`, `stage`, `target_environment`)**  
    
* **`value_units` (each pooled unit must include `metrics_intent`, `quality_signal_source`, and `unit_economics`)**  
    
* **`pools`**  
    
* **`exploration` (required, may be `{ "enabled": false }`)**  
    
* **`rails`**  
    
* **`rating_agility` (must include `price_book_ref`)**  
    
* **`metric_lenses`**  
    
* **`governance` (must include `config_version_id`, `config_status`, version identifiers, and audit metadata)**

**For sandbox configs, looser rules may apply, but the payload must still be deterministic and versioned.**

**Example `avs_config` (abbreviated)**

{  
"avs\_version": "v2.0",  
"cycle\_id": "cycle\_2026\_01\_prod\_90d",  
"config\_version\_id": "cfg\_smb\_learning\_prod\_v2\_candidate",  
"effective\_at": "2026-01-15T00:00:00Z",  
"north\_star": {  
"goal\_type": "pmf\_learning",  
"primary\_metrics": \["paid\_engagement\_retention\_90d", "gross\_margin"\],  
"narrative": "Improve time-to-aha while maintaining margin safety."  
},  
"subject\_resolution": {  
"workspace\_id": "ws\_1049",  
"segment": "ai\_video\_smb",  
"stage": "learning",  
"target\_environment": "production"  
},  
"quality\_mode": "advisory",  
"value\_units": \[  
{  
"value\_unit\_id": "vu\_usable\_hd\_minute",  
"name": "usable\_hd\_minute",  
"event\_mapping": {  
"event\_type": "video\_render\_completed",  
"filters": { "resolution": "HD", "render\_mode": "production" },  
"aggregation": { "type": "sum", "field": "output\_minutes" }  
},  
"metrics\_intent": \[  
{ "metric\_id": "paid\_engagement\_retention\_90d", "expected\_impact": "positive" },  
{ "metric\_id": "gross\_margin", "expected\_impact": "unknown" }  
\],  
"quality\_signal\_source": \["csat", "edit\_reopen\_rate"\],  
"unit\_economics": {  
"avg\_cost\_per\_unit\_usd": 0.18,  
"target\_price\_per\_unit\_usd": 0.6,  
"target\_margin": 0.7,  
"economics\_confidence": "medium"  
}  
}  
\],  
"pools": \[  
{  
"pool\_id": "pool\_core",  
"label": "Core",  
"value\_unit\_id": "vu\_usable\_hd\_minute",  
"included\_quantity": 300,  
"rollover": { "enabled": false },  
"overage\_behavior": "allow\_overage",  
"is\_exploration\_pool": false  
}  
\],  
"exploration": {  
"enabled": false  
},  
"rails": {  
"usage\_thresholds": \[  
{ "percent": 70, "action": "warn" },  
{ "percent": 90, "action": "throttle" },  
{ "percent": 100, "action": "block" }  
\],  
"monthly\_spend\_cap\_usd": 650,  
"at\_cap\_action": "require\_approval",  
"margin\_floor": 0.68  
},  
"rating\_agility": {  
"price\_book\_ref": "usd\_2026\_01\_default"  
},  
"metric\_lenses": \["paid\_engagement\_retention\_90d", "exploration\_depth", "margin\_floor\_violations"\],  
"governance": {  
"approval\_ref": "dec\_01928",  
"config\_status": "draft",  
"audit": \[  
{ "type": "generated", "by": "operator", "at": "2026-01-14T22:10:00Z" }  
\]  
},  
"generated\_at": "2026-01-14T22:10:00Z",  
"source": "AVS Brain\_operator\_ui"  
}

### **API B: Enforcement outcomes (customer app → AVS Brain)**

**Purpose**  
The customer app reports enforcement outcomes back to AVS Brain for audit and learning. These are outcomes and context, not raw usage.

**Endpoint**  
`POST /api/enforcement-events`

**Body (required)**

* `workspace_id`  
    
* `customer_id` (or `account_id`)  
    
* `config_version_id`  
    
* `occurred_at` (timestamp)  
    
* `event_type` (enum):  
    
  * `rail_warning_shown`  
      
  * `rail_throttle_applied`  
      
  * `hard_cap_blocked`  
      
  * `override_approved`  
      
  * `exploration_graduated`  
      
  * `quality_proxy_failed`


* `context` (json): pool, value\_unit, threshold, usage to date, cap values, and any override metadata

---

### **API C: Billing patch export (AVS Brain → billing adapter)**

**Purpose**  
AVS Brain exports a deterministic BillingPatch payload that a billing adapter can apply to Metronome or other systems. AVS Brain does not run billing steps.

**Endpoints**

* `POST /api/export/billing-patch`  
  or  
    
* `GET /api/billing-patch/:config_version_id`

**Response**

* `billing_patch_id`  
    
* `price_book_ref`  
    
* `effective_at`  
    
* `payload` (JSON export)

---

### **API D: Simulation**

**Purpose**  
Simulate baseline vs candidate config outcomes. Simulation is scenario evaluation, not experimentation.

**Endpoint**  
`POST /api/simulations`

**Inputs (required)**

* `candidate_config_version_id`  
    
* `baseline_config_version_id` (or null)  
    
* `historical_window_days` (MVP supports 30, 60, 90, 120, mocked)  
    
* `filters`: segment, stage, target\_environment

**Outputs (required)**

* Metric deltas, even if proxies  
    
* Economics summary (revenue proxy, cost, margin proxy)  
    
* Exploration depth  
    
* Risks list  
    
* Blocking issues list

---

### **API E: Approval and activation**

**Purpose**  
Activate a config version, write a DecisionRecord, generate a BillingPatch, and enforce “one active config per subject\_resolution.”

**Endpoint**  
`POST /api/approve`

**Inputs (required)**

* `config_version_id`  
    
* `baseline_config_version_id` (or null)  
    
* `simulation_run_id` (must be completed and latest for that config\_version)  
    
* `approver_name`, `approver_role`, `rationale`, `effective_at`

**Outputs**

* DecisionRecord created  
    
* ConfigVersion set to active, prior active for same subject\_resolution archived  
    
* BillingPatch generated

---

### **API F: Decision log**

**Endpoints**

* `GET /api/decision-records`  
    
* `GET /api/decision-records/:decisionId`  
    
* `GET /api/decision-records/compare?decision_id_a=&decision_id_b=`  
    
* `POST /api/decision-records/:decisionId/fork`

**Outputs (required)**  
Simulations referenced in the Decision Log must include outputs broken down by all declared `primary_metrics` and `metric_lenses`, plus economics summary, risks, and blocking issues, including quality coverage or missing quality mappings for pooled units.  
**Before/After**: results must highlight if any primary metrics regress, or if config is incomplete in quality or economic mapping.

---

## **LLM-assisted workflows**

* **All explainers must reference**: north-star `goal_type` and `primary_metrics`, value units and their `metrics_intent`, quality signals (`quality_signal_source`), unit economics (`unit_economics`), and the relevant pools and rails, never just raw usage.  
    
* **Configs are flagged as incomplete** unless minimum definitions are present: `goal_type`, `primary_metrics`, and for every **pooled** value unit: `metrics_intent`, at least one `quality_signal_source`, and `unit_economics`. If incomplete, the LLM must output blocking issues plus the exact missing fields needed to simulate and promote

---

## **Integrations**

* **Billing and tools**: AVS Brain exports a deterministic `BillingPatch` (price book refs, billable meters, contract mappings). AVS Brain never performs charging, invoicing, or payment steps.  
    
* **Enforcement**: pools, exploration, and rails are enforced in the customer app layer at runtime. Billing may also enforce **ledger-side spend thresholds** as an optional backstop, but it is not the source of truth for product access decisions.

---

## User Experience

**Entry Point & First-Time User Experience**  
Users are onboarded through a guided setup that starts with **context ingestion** (doc upload or paste), then confirms the 90-day cycle north star. AVS Brain infers candidate segments, goal types, metrics, and constraints from context, then asks a short checklist of clarification questions mapped to missing required fields.

Operators must select a valid `goal_type` (enum) and up to three `primary_metrics` (constrained picklist, not free text). Draft creation is allowed with warnings. Promotion to production is gated by deterministic completeness rules.

**Guided definition prompts**  
For each value unit, operators specify the outcome/job, event mapping (event\_type, filters, aggregation), metrics intent (expected impact per primary metric), quality signal sources (advisory in MVP), and unit economics per unit (avg cost and target price).

**Gating philosophy**

1. **Drafts are allowed early.**  
   You can create and save drafts for cycles, value units, and configs even if they are incomplete. Incomplete items are marked **Amber** or **Red**, and the Navigator lists the exact missing fields.  
     
2. **Simulation requires minimum structure, not perfection.**  
   “Run simulation” is enabled only when:  
     
* the cycle has `goal_type` and at least one `primary_metric`, and  
    
* the config has at least one pool, and  
    
* every pooled value unit has a valid `event_mapping` and `unit_economics` (per unit).  
  Quality signals do not block simulation in MVP.  
    
3. **Promotion to production is strict and deterministic.**  
   “Approve and activate” is blocked unless:  
     
* the cycle is `cycle_type=production` and `period_length_days=90`, and  
    
* every pooled value unit is **Green**:  
    
  * `metrics_intent` present  
      
  * `unit_economics` present  
      
  * at least one `quality_signal_source` present


* rails are complete for production: `monthly_spend_cap_usd`, `margin_floor`, and `usage_thresholds` include 70, 90, 100\.  
    
4. **Scaling stage raises the economics bar.**  
   If `stage=scaling` and `target_environment=production`, then for every pooled value unit:  
* `economics_confidence` must be at least `medium`.  
  If not, promotion is blocked with a specific message naming the unit(s).  
5. **Activation requires evidence and creates an auditable record.**  
   Approval requires a completed `SimulationRun` reference. Activating a config:  
     
* creates a `DecisionRecord` including diff vs baseline, approval metadata, simulation reference, and value unit snapshot version, and  
    
* enforces **one active config per subject\_resolution**, archiving any prior active config for the same subject.

**Core Flow**

1. **Create cycle and confirm north star (90 days)**  
   UI mandates selection of one `goal_type` and up to three `primary_metrics`, plus segments, cycle\_type, and narrative (optional).  
     
2. **Define value units (Flow 2\)**  
   Operators map value units to explicit outcomes and deterministic event mappings. Unit economics are required for production promotion. Quality signals are advisory in MVP but required for production promotion if pooled.  
     
3. **Configure segment, stage, environment (Flow 3A)**  
   Create a config version for a specific subject\_resolution (segment, stage, target\_environment).  
     
4. **Define pools, exploration, rails (Flow 3B–3D)**  
   Pools define included vs overage. Exploration is explicit and tied to an exploration pool. Rails define spend caps, thresholds, and margin floor.  
     
5. **Simulate and review (Flow 4\)**  
   Simulation outputs are broken out by declared primary metrics and metric lenses. Navigator surfaces blocking issues and exact missing fields before approval.  
     
6. **Approve, activate, export billing patch (Flow 5\)**  
   Config cannot be activated unless promotion gates are Green and a completed SimulationRun is referenced. Activation generates a DecisionRecord and exportable BillingPatch JSON. No external billing calls in MVP.

**Advanced Features & Edge Cases**  
Rollback and A/B flags are out of scope for MVP, except “fork from decision” which creates a new draft config version referencing a prior decision.

---

## Narrative

Theresa, Lumina’s CEO, faces runaway infra bills as usage surges, without confidence that value and pricing are aligned. She opens AVS Brain and uploads a short strategy doc. AVS Brain extracts candidate context cards and asks a small checklist, then Theresa confirms a production 90-day cycle for segment `ai_video_smb`, goal\_type `pmf_learning`, primary metrics `paid_engagement_retention_90d` and `gross_margin`.

AVS Brain drafts value units and prompts Theresa to confirm the core unit `Usable HD minute` (`vu_usable_hd_minute`), including its event mapping, rough unit economics per unit, and advisory quality signals. Theresa proceeds to configuration for stage `learning` in `production`, defines pools and rails, then runs a simulation. The review screen flags that a pooled unit is missing a required field for production promotion, Theresa fixes it, reruns simulation, and sees margin floor risk and spend cap thresholds clearly.

Once the gate is Green, Theresa approves and activates the config. AVS Brain creates an auditable DecisionRecord, archives the prior active config for that subject\_resolution, and generates a deterministic BillingPatch JSON export. Product and billing teams now share a single record of “what changed and why,” shifting debates from anecdote to traceable decisions.

---

## Success Metrics

### User-Centric

* **Config Completeness:** % of production configs with all required unit\_economics and quality signals defined (target: \>98%).  
    
* **Experiment Velocity:** Median time from config proposal to fully validated, production-ready config (\<48 hours).  
    
* **Prevention of Incomplete Rollouts:** \# of config submission attempts blocked due to missing unit\_economics or primary metrics.  
    
* **Governance Compliance:** % of all production configs with a north star+goal\_type set.

### Business

* **Margin Compliance:** % of 90-day cycles hitting margin floor targets.  
    
* **Churn Impact:** Rate of “blind” pricing/packaging changes (those not attached to a north star+primary metrics), expected to fall to zero.

### Technical

* **API Validation:** % of production API calls rejected for missing required fields (should be \<2%).  
    
* **Simulation Coverage:** % of simulation runs that output `primary_metric_deltas` (proxies allowed), `lens_metrics`, economics summary (revenue, cost, margin), exploration summary when enabled, plus `risks` and `blocking_issues.`

---

## Technical Considerations

### **Data Models**  `avs_config` object:

* `north_star`: `goal_type` (enum), `primary_metrics` (array, max 3), `narrative` (optional)  
    
* `subject_resolution`: required object that uniquely identifies which config applies, must include `workspace_id`, `segment`, `stage` (enum: `learning` or `scaling`), and `target_environment` (enum: `sandbox` or `production`)  
    
* `value_units`: array of value units, each must include:  
    
  * `value_unit_id`, `name`  
      
  * `event_mapping`: `{ event_type, filters, aggregation }`  
      
  * `metrics_intent`: array of `{ metric_id, expected_impact }`  
      
  * `quality_signal_source`: array of signal ids (advisory in MVP, required for production promotion if pooled)  
      
  * `unit_economics`: `{ avg_cost_per_unit_usd, target_price_per_unit_usd, target_margin, economics_confidence }`


* `pools`: array of pools, each must include:  
    
  * `pool_id`, `label`, `value_unit_id`  
      
  * `included_quantity`, `rollover`, `overage_behavior`  
      
  * `is_exploration_pool` (boolean)


* `exploration`: object:  
    
  * `enabled` (boolean)  
      
  * if enabled: `exploration_pool_id`, `qualifying_events`, `expires_after_days`, `graduation_signal`


* `rails`: object:  
    
  * `usage_thresholds` array of `{ percent, action }`  
      
  * `monthly_spend_cap_usd`, `at_cap_action`, `margin_floor`


* `rating_agility`: `price_book_ref` (required for production), plus optional metadata for billing patch generation  
    
* `metric_lenses`: array of metric ids used for simulation cuts and gating (e.g., `exploration_depth`, `margin_floor_violations`)  
    
* `governance`: required for production responses, must include `config_version_id`, `config_status`, `approval_ref` (if active), and `audit` entries

### Catalog Tables

Catalogs provide the curated picklists AVS Brain uses for deterministic configuration and simulation. Catalog IDs are stable, versioned, and referenced by configs. For MVP, catalogs are seeded from `/seed/*.json` and managed as read-only tables in the UI.

1\) EventCatalog

**Purpose**: Defines the event types the product can meter or use for exploration and quality proxies.

Fields

* `event_type` (string, primary key)  
    
* `description` (string)  
    
* `dimensions` (string array, allowed filters and aggregation fields)

Used by

* ValueUnitDefinition `event_mapping`  
    
* Exploration rules `qualifying_events`  
    
* Simulation metering engine

Seed file

* /seed/event\_catalog.json

---

2\) MetricCatalog

**Purpose**: Defines the allowed north-star metrics and lens metrics.

Fields

* `metric_id` (string, primary key)  
    
* `label` (string)  
    
* `type` enum: `north_star`, `lens`

Used by

* Cycle `primary_metrics`  
    
* Value units `metrics_intent.metric_id`  
    
* Simulation outputs `primary_metric_deltas` and `lens_metrics`  
    
* Promotion gating rules

Seed file

* /seed/metric\_catalog.json

---

3\) QualitySignalCatalog

**Purpose**: Defines the allowed quality signals and their source systems.

Fields

* `signal_id` (string, primary key)  
    
* `label` (string)  
    
* `source` enum/string (example: `in_app_prompt`, `product_events`, `ops_review`)

Used by

* Value units `quality_signal_source`  
    
* Navigator completeness rules and recommendations  
    
* Enforcement outcomes `quality_proxy_failed` context

Seed file

* /seed/quality\_signal\_catalog.json

---

4\) CustomerCatalog

**Purpose**: Defines known customers or accounts for demo segmentation and enforcement event attribution. MVP uses customers for seed simulation only.

Fields

* `customer_id` (string, primary key)  
    
* `name` (string)  
    
* `segment` (string)

Used by

* Seed usage events attribution  
    
* Enforcement events attribution  
    
* Filtering simulation and decision log views

Seed file

* /seed/customers.json

---

5\) SegmentCatalog (optional for MVP, recommended)

**Purpose**: Provides stable segment IDs and display labels for multi-select UI.

Fields

* `segment_id` (string, primary key) example: `ai_video_smb`  
    
* `label` (string)  
    
* `description` (string, optional)

Used by

* Cycle `segments`  
    
* subject\_resolution `segment`  
    
* Decision log filtering

Seed approach

* Either a dedicated `/seed/segment_catalog.json`, or derive from customers and configs in seed.

---

6\) Enum reference (MVP)

These enums must be consistent across PRD, UI, seed, and API payloads.

* `stage`: `learning`, `scaling`  
    
* `target_environment`: `sandbox`, `production`  
    
* `cycle_type`: `sandbox`, `production`  
    
* `goal_type`: `pmf_learning`, `revenue`, `margin`, `market_share`, `data_flywheel`  
    
* `expected_impact`: `positive`, `negative`, `unknown`  
    
* `overage_behavior`: `allow_overage`, `throttle`, `hard_stop`  
    
* `rail_action`: `warn`, `throttle`, `block`, `require_approval`, `degrade_quality` (optional in UI, supported by schema)  
    
* `economics_confidence`: `rough`, `medium`, `high`

---

7\) Catalog governance (MVP)

* Catalog tables are read-only in the UI.  
    
* Changes happen by editing seed files and reseeding local DB.  
    
* Production systems should version catalogs and track changes in audit log, not required in MVP.

### **Catalog UI Flow (read-only)**

**Route:** `/catalogs`  
**Goal:** Provide stable IDs for deterministic config, and deep links from pickers.

* Tabs: Events, Metrics, Quality Signals, Segments, Customers  
    
* Search by id or label, filters by metric type and quality source  
    
* Row actions: Copy ID, View details  
    
* Details side panel: description, dimensions (events), used-by references (value units/configs), deep links back to authoring  
    
* Read-only in MVP, edits happen via seed files and reseed

### Product Constraints

* **Config Completeness Validation (production activation gate):** System must enforce, cannot activate any `target_environment=production` config unless all are true:  
  (a) Cycle is `cycle_type=production` and `period_length_days=90`, and includes `north_star.goal_type` plus at least 1 `primary_metric`.  
  (b) Config has at least 1 pool.  
  (c) For **every pooled** `value_unit_id`: `event_mapping` is valid, `metrics_intent` is present (expected impact declared), and `unit_economics` is present (`avg_cost_per_unit_usd`, `target_price_per_unit_usd`, `target_margin`, `economics_confidence`).  
  (d) For **every pooled** `value_unit_id`: at least 1 `quality_signal_source` is selected (quality is advisory in MVP, but still required for production activation to prevent “value without quality” configs).  
  (e) Rails are complete for production: `monthly_spend_cap_usd`, `margin_floor`, `at_cap_action`, and `usage_thresholds` include 70, 90, 100\.  
  (f) If `stage=scaling`, then for every pooled value unit `economics_confidence` must be `medium` or `high`.  
    
* **No Generic Modes:** There is no fallback “usage only” or “free text” pricing—value, quality, and economics must always be defined and mapped structurally.  
    
* **No Billing Logic:** AVS cannot perform or automate direct billing; only propagate validated configs upstream.

### Simulation

* Compares `candidate_config_version_id` vs `baseline_config_version_id` (or baseline \= none) over a selectable `window_days` (MVP supports 30, 60, 90, 120, mocked).  
    
* Filters: `segment`, `stage`, `target_environment` must be explicit for reproducibility.  
    
* Uses deterministic metering from `event_mapping` (event\_type \+ filters \+ aggregation) against seeded usage events. No causal inference, no assignment, no holdouts.  
    
* Outputs must include:  
    
  * primary metric deltas (proxy deltas allowed in MVP) for all declared `primary_metrics`  
      
  * lens metrics for all declared `metric_lenses` (example: exploration\_depth, margin\_floor\_violations)  
      
  * economics summary: revenue, cost, margin, plus rail violations (spend cap, margin floor)  
      
  * exploration summary if enabled (qualifying events count, exploration pool consumption)  
      
  * `risks` list and `blocking_issues` list, with deep links to exact missing fields


* System blocks approval if simulation cannot produce outputs at this declared granularity.

### Integration

* AVS exposes structured config for push/upstream use (Orb, Metronome) and presents validated, current config to Lumina app runtime.  
    
* Data warehouse mapping: historical value units must tie to quality and economics—no generic aggregation allowed.

### Data Storage & Privacy

* All configs and governance logs are securely stored; no PII/billing info retained.  
    
* Change logs are auditable and aligned with compliance standards.

### Scalability & Edge Cases

* Strict rule enforcement at low scale (\<1000 configs) with batch simulation/validation.  
    
* System responds to any attempted incomplete config with actionable error guidance.

### Potential Challenges

* Ensuring rich LLM explainers reflect config intent and constraints.  
    
* Resistance to completion prompts: UI must provide educational assist for why every required field matters.  
    
* Preventing disconnect/drift if downstream systems aren’t ready to accept structured configs.

---

## Milestones & Sequencing

### Project Estimate

* **Medium:** 2–4 weeks for MVP, including hard enforcement of config completeness and north-star cycle structure.

### Team

* **2-person team:** Engineer (API/backend/validation), PM/Designer (workflow, UI, LLM prompts, rule structure)

### Phases

* **Phase 1:** Hard-enforced config structure and API  
    
* **Phase 2:** Simulation with per-metric, per-economic breakdowns tied to goals  
    
* **Phase 3:** Production push, system/edge validation, and workflow UX polish

---

