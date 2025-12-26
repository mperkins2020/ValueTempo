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
- `ConfigStatus`: draft, simulated, approved, active, archived
- `Action`: warn, throttle, block, require_approval, degrade_quality
- `OverageBehavior`: allow_overage, throttle, hard_stop
- `EconomicsConfidence`: rough, medium, high
- `TargetEnvironment`: sandbox, production
- `ExpectedImpact`: positive, negative, unknown
- `GoalType`: pmf_learning, revenue, margin, market_share, data_flywheel

### Minimal field list

### Workspace

- id, name, created_at

### Cycle

- id, workspace_id
- cycle_type
- period_length_days
- start_date, end_date
- goal_type
- primary_metrics array
- segments array
- narrative optional
- created_at

### ValueUnitDefinition

- id, cycle_id
- name, unit_type
- event_mapping json (event_type, filters, aggregation)
- outcome_statement
- quality_signal_source string[] (array of signal_id values)
- quality_note optional string (advisory-only explanation, does not affect billing math)
- unit_economics json (avg_cost_per_unit_usd, target_price_per_unit_usd, target_margin, economics_confidence)
- metrics_intent: array of objects, each { metric_id: string, expected_impact: "positive" | "negative" | "unknown" }
Rule: include one entry per declared north_star.primary_metrics for pooled value units.
- completeness_status enum (green, amber, red)
- created_at, updated_at

### ValueUnitSnapshot

- id, cycle_id
- version integer
- value_unit_ids array
- created_at

### ConfigVersion

- id, cycle_id, workspace_id
- segment, stage
- target_environment enum (sandbox, production)
- version integer
- status ConfigStatus
- effective_at
- pools json array
- exploration json
- rails json
- billing_patch_ref optional
- created_at, updated_at

### SimulationRun

- id, config_version_id
- baseline_config_version_id optional
- input json (window, filters)
- output json (metric deltas, risks, regression flags)
- completeness_result enum (green, amber, red)
- created_at

### DecisionRecord

- id, config_version_id, cycle_id
- approver_name, approver_role
- rationale
- diff json
- simulation_run_id
- activated_at
- created_at

### EnforcementEvent

- id, workspace_id, config_version_id, customer_id, occurred_at
- event_type enum
- context json

### BillingPatch

- id, config_version_id
- price_book_ref
- effective_at
- payload json
- created_at
