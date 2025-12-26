# Canonical Data Model v0.5.1

### Entities and relationships

- Workspace 1 to many Cycles
- Cycle 1 to many ValueUnitDefinitions
- Cycle 1 to many ValueUnitSnapshots
- Cycle 1 to many ConfigVersions
- ConfigVersion 1 to many SimulationRuns
- ConfigVersion 1 to many DecisionRecords
- Workspace 1 to many EnforcementEvents

### Enums

- `CycleType`: sandbox, production
- `Stage`: learning, scaling
- `ConfigStatus`: draft, simulated, active, archived
- `Action`: warn, throttle, block, require_approval, degrade_quality
- `EnforcementEventType`: rail_warning_shown, rail_throttle_applied, hard_cap_blocked, override_approved, exploration_graduated, quality_proxy_failed
- `OverageBehavior`: allow_overage, throttle, hard_stop
- `EconomicsConfidence`: rough, medium, high
- `TargetEnvironment`: sandbox, production
- `ExpectedImpact`: positive, negative, unknown
- `GoalType`: pmf_learning, revenue, margin, market_share, data_flywheel
- `PricingMode`: use_unit_economics

### Minimal field list

### Workspace

- workspace_id, workspace_name, created_at

### Cycle

- cycle_id, workspace_id
- cycle_type
- period_length_days
- start_date, end_date
- goal_type
- primary_metrics array
- segments array
- narrative optional
- created_at

### ValueUnitDefinition

- value_unit_id, cycle_id
- name, unit_type
- event_mapping json (event_type, filters, aggregation)
- outcome_statement
- quality_signal_source string[] (array of signal_id values)
- quality_note optional string (advisory-only explanation, does not affect billing math)
- unit_economics json (avg_cost_per_unit_usd, target_price_per_unit_usd, target_margin, economics_confidence)
- metrics_intent: array of objects, each { metric_id: string, expected_impact: "positive" | "negative" | "unknown" }
  Rule: include one entry per declared cycle.primary_metrics for pooled value units.
- completeness_status enum (green, amber, red)
- created_at, updated_at

### ValueUnitSnapshot

- value_unit_snapshot_id, cycle_id
- version integer
- value_unit_ids array
- created_at

### ConfigVersion

- config_version_id, cycle_id, workspace_id
- segment, stage
- target_environment (TargetEnvironment)
- version integer
- status (ConfigStatus)
- effective_at
- pools json array
- exploration json
- rails json
- billing_patch_id optional
- value_unit_snapshot_version integer
- price_book_ref string
- created_at, updated_at
  
Rule: Activation sets status=active and archives any prior active config for the same subject_resolution.

### SimulationRun

- simulation_run_id, config_version_id
- baseline_config_version_id optional
- input json (historical_window_days, filters, pricing_mode: PricingMode, include_exploration_in_results)
- output json including: primary_metric_deltas, lens_metrics, economics_summary (revenue_usd, cost_usd, margin), exploration_summary (when enabled), risks string[], blocking_issues string[]
- completeness_result enum (green, amber, red)
- created_at

### DecisionRecord

- decision_id, config_version_id, cycle_id
- baseline_config_version_id optional
- billing_patch_id
- subject_resolution json { workspace_id, segment, stage, target_environment }
- value_unit_snapshot_version integer
- approver_name, approver_role
- rationale
- diff json
- simulation_run_id
- effective_at
- created_at

### EnforcementEvent

- enforcement_event_id, workspace_id, config_version_id, customer_id, occurred_at
- event_type EnforcementEventType
- context json

### BillingPatch

- billing_patch_id, config_version_id
- workspace_id
- cycle_id
- price_book_ref
- effective_at
- payload json
- created_at

### Customer (Catalog)
- customer_id, name
- segment_id (stable segment ID, e.g., ai_video_smb)
- created_at

### Segment (Catalog)
- segment_id, label
- description optional
- created_at
