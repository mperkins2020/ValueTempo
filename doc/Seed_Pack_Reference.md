# Seed JSON v0.5.1

### `/seed/workspaces.json`

```json
[
{
"workspace_id":"ws_1049",
"workspace_name":"Lumina Demo Workspace",
"created_at":"2025-12-24T00:00:00Z"
}
]

```

### `/seed/event_catalog.json`

```json
[
{
"event_type":"video_render_completed",
"description":"A render finishes and outputs a video file",
"dimensions":["resolution","render_mode","output_minutes","workspace_id","customer_id","segment"]
},
{
"event_type":"draft_export_created",
"description":"User exports a draft output",
"dimensions":["resolution","workspace_id","customer_id","segment"]
},
{
"event_type":"labs_feature_used",
"description":"User triggers an experimental feature",
"dimensions":["feature_name","workspace_id","customer_id","segment"]
},
{
"event_type":"quality_proxy_recorded",
"description":"A quality proxy is recorded for an output",
"dimensions":["proxy_type","proxy_value","workspace_id","customer_id","segment"]
}
]

```

### `/seed/metric_catalog.json`

```json
[
{"metric_id":"paid_engagement_retention_90d","label":"Paid engagement retention (90d)","type":"north_star"},
{"metric_id":"monthly_churn_rate","label":"Monthly churn rate","type":"north_star"},
{"metric_id":"gross_margin","label":"Gross margin","type":"north_star"},
{"metric_id":"exploration_depth","label":"Exploration depth","type":"lens"},
{"metric_id":"margin_floor_violations","label":"Margin floor violations","type":"lens"}
]

```

### `/seed/quality_signal_catalog.json`

```json
[
{"signal_id":"csat","label":"CSAT","source":"in_app_prompt"},
{"signal_id":"edit_reopen_rate","label":"Edit reopen rate","source":"product_events"},
{"signal_id":"manual_qa_pass","label":"Manual QA pass rate","source":"ops_review"}
]

```

### `/seed/customers.json`

```json
[
{"customer_id":"cust_2001","name":"Pioneer Studio","segment":"ai_video_smb"},
{"customer_id":"cust_2002","name":"Northwind Media","segment":"ai_video_enterprise"}
]

```

### `/seed/segment_catalog.json`

```json
[
{"segment_id":"ai_video_smb","label":"AI Video SMB","description":"SMB creators and small teams"},
{"segment_id":"ai_video_enterprise","label":"AI Video Enterprise","description":"Enterprise media and studios"}
]

```

### `/seed/cycles.json`

```json
[
{
"cycle_id":"cycle_2026_01_prod_90d",
"workspace_id":"ws_1049",
"cycle_type":"production",
"period_length_days":90,
"start_date":"2026-01-01",
"end_date":"2026-04-01",
"goal_type":"pmf_learning",
"segments":["ai_video_smb"],
"primary_metrics":["paid_engagement_retention_90d","gross_margin"],
"narrative":"Improve time-to-aha while maintaining margin safety."
}
]

```

### `/seed/value_units.json`

```json
[
{
"value_unit_id":"vu_usable_hd_minute",
"cycle_id":"cycle_2026_01_prod_90d",
"name":"Usable HD minute",
"unit_type":"outcome",
"event_mapping":{
"event_type":"video_render_completed",
"filters":{"resolution":"HD","render_mode":"production"},
"aggregation":{"type":"sum","field":"output_minutes"}
},
"outcome_statement":"Completed HD video ready to publish",
"quality_signal_source":["edit_reopen_rate","csat"],
"quality_note":"Advisory only in MVP, affects completeness and recommendations, not billing math.",
"unit_economics":{
"avg_cost_per_unit_usd":0.18,
"target_price_per_unit_usd":0.6,
"target_margin":0.7,
"economics_confidence":"medium"
},
"metrics_intent":[
{"metric_id":"paid_engagement_retention_90d","expected_impact":"positive"},
{"metric_id":"gross_margin","expected_impact":"unknown"}
]
},
{
"value_unit_id":"vu_usable_4k_minute",
"cycle_id":"cycle_2026_01_prod_90d",
"name":"Usable 4K minute",
"unit_type":"outcome",
"event_mapping":{
"event_type":"video_render_completed",
"filters":{"resolution":"4K","render_mode":"production"},
"aggregation":{"type":"sum","field":"output_minutes"}
},
"outcome_statement":"Completed 4K video ready to publish",
"quality_signal_source":["manual_qa_pass"],
"quality_note":"Advisory only in MVP, affects completeness and recommendations, not billing math.",
"unit_economics":{
"avg_cost_per_unit_usd":0.55,
"target_price_per_unit_usd":1.8,
"target_margin":0.7,
"economics_confidence":"rough"
},
"metrics_intent":[
{"metric_id":"paid_engagement_retention_90d","expected_impact":"positive"},
{"metric_id":"gross_margin","expected_impact":"negative"}
]
},
{
"value_unit_id":"vu_draft_export",
"cycle_id":"cycle_2026_01_prod_90d",
"name":"Draft export",
"unit_type":"usage",
"event_mapping":{
"event_type":"draft_export_created",
"filters":{},
"aggregation":{"type":"count"}
},
"outcome_statement":"User exports a draft to test workflow",
"quality_signal_source":[],
"quality_note":"No quality signals yet. Allowed in sandbox. Blocks production promotion if pooled.",
"unit_economics":{
"avg_cost_per_unit_usd":0.02,
"target_price_per_unit_usd":0.0,
"target_margin":0.0,
"economics_confidence":"medium"
},
"metrics_intent":[
{"metric_id":"paid_engagement_retention_90d","expected_impact":"unknown"}
]
}
]

```

### `/seed/value_unit_snapshots.json`

```json
[
{
"value_unit_snapshot_id":"vus_2026_01_v1",
"workspace_id":"ws_1049",
"cycle_id":"cycle_2026_01_prod_90d",
"snapshot_version":1,
"created_at":"2026-01-01T00:00:00Z",
"value_unit_ids":["vu_usable_hd_minute","vu_usable_4k_minute","vu_draft_export"]
}
]

```

### `/seed/configs.json`

```json
[
{
"config_version_id":"cfg_smb_learning_sandbox_v1",
"workspace_id":"ws_1049",
"cycle_id":"cycle_2026_01_prod_90d",
"segment":"ai_video_smb",
"stage":"learning",
"target_environment":"sandbox",
"version":1,
"status":"active",
"effective_at":"2026-01-01T00:00:00Z",
"value_unit_snapshot_version":1,
"pools":[
{
"pool_id":"pool_core",
"label":"Core",
"value_unit_id":"vu_usable_hd_minute",
"included_quantity":5,
"rollover":{"enabled":false},
"overage_behavior":"allow_overage",
"is_exploration_pool":false
},
{
"pool_id":"pool_exploration",
"label":"Exploration",
"value_unit_id":"vu_draft_export",
"included_quantity":0,
"rollover":{"enabled":false},
"overage_behavior":"throttle",
"is_exploration_pool":true
}
],
"exploration":{
"enabled":true,
"exploration_pool_id":"pool_exploration",
"qualifying_events":["draft_export_created","labs_feature_used"],
"expires_after_days":30,
"graduation_signal":"repeat_usage_threshold"
},
"rails":{
"usage_thresholds":[
{"percent":70,"action":"warn"},
{"percent":90,"action":"warn"},
{"percent":100,"action":"throttle"}
],
"monthly_spend_cap_usd":500,
"at_cap_action":"require_approval",
"margin_floor":0.65
}
},
{
"config_version_id":"cfg_smb_learning_prod_v1",
"workspace_id":"ws_1049",
"cycle_id":"cycle_2026_01_prod_90d",
"segment":"ai_video_smb",
"stage":"learning",
"target_environment":"production",
"version":1,
"status":"active",
"effective_at":"2026-01-01T00:00:00Z",
"value_unit_snapshot_version":1,
"pools":[
{
"pool_id":"pool_core",
"label":"Core",
"value_unit_id":"vu_usable_hd_minute",
"included_quantity":0,
"rollover":{"enabled":false},
"overage_behavior":"allow_overage",
"is_exploration_pool":false
}
],
"exploration":{"enabled":false},
"rails":{
"usage_thresholds":[
{"percent":70,"action":"warn"},
{"percent":90,"action":"throttle"},
{"percent":100,"action":"block"}
],
"monthly_spend_cap_usd":600,
"at_cap_action":"require_approval",
"margin_floor":0.68
}
},
{
"config_version_id":"cfg_smb_learning_prod_v2_candidate",
"workspace_id":"ws_1049",
"cycle_id":"cycle_2026_01_prod_90d",
"segment":"ai_video_smb",
"stage":"learning",
"target_environment":"production",
"version":2,
"status":"draft",
"effective_at":"2026-01-15T00:00:00Z",
"value_unit_snapshot_version":1,
"pools":[
{
"pool_id":"pool_core",
"label":"Core",
"value_unit_id":"vu_usable_hd_minute",
"included_quantity":0,
"rollover":{"enabled":false},
"overage_behavior":"allow_overage",
"is_exploration_pool":false
},
{
"pool_id":"pool_4k",
"label":"4K Pro",
"value_unit_id":"vu_usable_4k_minute",
"included_quantity":1,
"rollover":{"enabled":false},
"overage_behavior":"throttle",
"is_exploration_pool":false
}
],
"exploration":{"enabled":false},
"rails":{
"usage_thresholds":[
{"percent":70,"action":"warn"},
{"percent":90,"action":"throttle"},
{"percent":100,"action":"block"}
],
"monthly_spend_cap_usd":650,
"at_cap_action":"require_approval",
"margin_floor":0.68
}
}
]

```

### `/seed/usage_events.json`

```json
[
{
"ts":"2026-01-02T10:05:00Z",
"event_type":"video_render_completed",
"workspace_id":"ws_1049",
"customer_id":"cust_2001",
"segment":"ai_video_smb",
"resolution":"HD",
"render_mode":"production",
"output_minutes":6
},
{
"ts":"2026-01-02T11:20:00Z",
"event_type":"video_render_completed",
"workspace_id":"ws_1049",
"customer_id":"cust_2001",
"segment":"ai_video_smb",
"resolution":"HD",
"render_mode":"production",
"output_minutes":4
},
{
"ts":"2026-01-03T09:10:00Z",
"event_type":"draft_export_created",
"workspace_id":"ws_1049",
"customer_id":"cust_2001",
"segment":"ai_video_smb",
"resolution":"HD"
},
{
"ts":"2026-01-03T09:12:00Z",
"event_type":"labs_feature_used",
"workspace_id":"ws_1049",
"customer_id":"cust_2001",
"segment":"ai_video_smb",
"feature_name":"auto_scene_cut"
},
{
"ts":"2026-01-04T14:00:00Z",
"event_type":"video_render_completed",
"workspace_id":"ws_1049",
"customer_id":"cust_2001",
"segment":"ai_video_smb",
"resolution":"4K",
"render_mode":"production",
"output_minutes":2
},
{
"ts":"2026-01-05T16:40:00Z",
"event_type":"quality_proxy_recorded",
"workspace_id":"ws_1049",
"customer_id":"cust_2001",
"segment":"ai_video_smb",
"proxy_type":"csat",
"proxy_value":4
}
]

```

### `/seed/simulation_runs.json`

```json
[
{
"simulation_run_id":"sim_sandbox_v1_30d",
"workspace_id":"ws_1049",
"cycle_id":"cycle_2026_01_prod_90d",
"candidate_config_version_id":"cfg_smb_learning_sandbox_v1",
"baseline_config_version_id":null,
"created_at":"2026-01-05T18:00:00Z",
"inputs":{
"historical_window_days":30,
"filters":{"segment":"ai_video_smb","stage":"learning","target_environment":"sandbox"}
},
"outputs":{
"primary_metric_deltas":{
"paid_engagement_retention_90d":null,
"gross_margin":null
},
"lens_metrics":{
"exploration_depth":2,
"margin_floor_violations":1
},
"economics":{
"revenue_usd":3.0,
"cost_usd":1.8,
"margin":0.4
},
"risks":["margin_floor_violated"],
"blocking_issues":[]
}
},
{
"simulation_run_id":"sim_prod_v1_30d",
"workspace_id":"ws_1049",
"cycle_id":"cycle_2026_01_prod_90d",
"candidate_config_version_id":"cfg_smb_learning_prod_v1",
"baseline_config_version_id":null,
"created_at":"2026-01-05T18:05:00Z",
"inputs":{
"historical_window_days":30,
"filters":{"segment":"ai_video_smb","stage":"learning","target_environment":"production"}
},
"outputs":{
"primary_metric_deltas":{
"paid_engagement_retention_90d":null,
"gross_margin":null
},
"lens_metrics":{
"exploration_depth":0,
"margin_floor_violations":0
},
"economics":{
"revenue_usd":6.0,
"cost_usd":1.8,
"margin":0.7
},
"risks":[],
"blocking_issues":[]
}
},
{
"simulation_run_id":"sim_prod_v2_candidate_30d",
"workspace_id":"ws_1049",
"cycle_id":"cycle_2026_01_prod_90d",
"candidate_config_version_id":"cfg_smb_learning_prod_v2_candidate",
"baseline_config_version_id":"cfg_smb_learning_prod_v1",
"created_at":"2026-01-05T18:10:00Z",
"inputs":{
"historical_window_days":30,
"filters":{"segment":"ai_video_smb","stage":"learning","target_environment":"production"}
},
"outputs":{
"primary_metric_deltas":{
"paid_engagement_retention_90d":0.01,
"gross_margin":-0.02
},
"lens_metrics":{
"exploration_depth":0,
"margin_floor_violations":1
},
"economics":{
"revenue_usd":7.8,
"cost_usd":2.9,
"margin":0.6282
},
"risks":["margin_floor_violated"],
"blocking_issues":[]
}
}
]

```

### `/seed/billing_patches.json`

```json
[
{
"billing_patch_id":"bp_sandbox_v1",
"workspace_id":"ws_1049",
"cycle_id":"cycle_2026_01_prod_90d",
"config_version_id":"cfg_smb_learning_sandbox_v1",
"created_at":"2026-01-01T00:10:00Z",
"price_book_ref":"usd_2026_01_default",
"effective_at":"2026-01-01T00:00:00Z",
"payload":{
"target_environment":"sandbox",
"subject_resolution":{
"workspace_id":"ws_1049",
"segment":"ai_video_smb",
"stage":"learning",
"target_environment":"sandbox"
},
"meters":[
{
"meter_id":"mtr_usable_hd_minutes",
"event_type":"video_render_completed",
"aggregation":{"type":"sum","field":"output_minutes"},
"filters":{"resolution":"HD","render_mode":"production"}
},
{
"meter_id":"mtr_draft_exports",
"event_type":"draft_export_created",
"aggregation":{"type":"count"},
"filters":{}
}
],
"products":[{"product_id":"prod_lumina_smb","label":"Lumina SMB"}],
"rate_card_updates":[
{
"rate_card_id":"rc_sandbox_v1",
"lines":[
{"meter_id":"mtr_usable_hd_minutes","price_per_unit_usd":0.6},
{"meter_id":"mtr_draft_exports","price_per_unit_usd":0.0}
]
}
],
"contract_overrides":[],
"notes":"MVP export only. No billing system calls."
}
},
{
"billing_patch_id":"bp_prod_v1",
"workspace_id":"ws_1049",
"cycle_id":"cycle_2026_01_prod_90d",
"config_version_id":"cfg_smb_learning_prod_v1",
"created_at":"2026-01-01T00:15:00Z",
"price_book_ref":"usd_2026_01_default",
"effective_at":"2026-01-01T00:00:00Z",
"payload":{
"target_environment":"production",
"subject_resolution":{
"workspace_id":"ws_1049",
"segment":"ai_video_smb",
"stage":"learning",
"target_environment":"production"
},
"meters":[
{
"meter_id":"mtr_usable_hd_minutes",
"event_type":"video_render_completed",
"aggregation":{"type":"sum","field":"output_minutes"},
"filters":{"resolution":"HD","render_mode":"production"}
}
],
"products":[{"product_id":"prod_lumina_smb","label":"Lumina SMB"}],
"rate_card_updates":[
{
"rate_card_id":"rc_prod_v1",
"lines":[
{"meter_id":"mtr_usable_hd_minutes","price_per_unit_usd":0.6}
]
}
],
"contract_overrides":[],
"notes":"MVP export only. No billing system calls."
}
}
]

```

### `/seed/decision_records.json`

```json
[
{
"decision_id":"dec_sandbox_v1_active",
"workspace_id":"ws_1049",
"cycle_id":"cycle_2026_01_prod_90d",
"config_version_id":"cfg_smb_learning_sandbox_v1",
"baseline_config_version_id":null,
"simulation_run_id":"sim_sandbox_v1_30d",
"billing_patch_id":"bp_sandbox_v1",
"subject_resolution":{
"workspace_id":"ws_1049",
"segment":"ai_video_smb",
"stage":"learning",
"target_environment":"sandbox"
},
"status":"active",
"approver_name":"Theresa",
"approver_role":"CEO",
"rationale":"Seed activation for sandbox learning config.",
"effective_at":"2026-01-01T00:00:00Z",
"created_at":"2026-01-01T00:20:00Z",
"value_unit_snapshot_version":1,
"diff":{"type":"initial_activation","changes":[]}
},
{
"decision_id":"dec_prod_v1_active",
"workspace_id":"ws_1049",
"cycle_id":"cycle_2026_01_prod_90d",
"config_version_id":"cfg_smb_learning_prod_v1",
"baseline_config_version_id":null,
"simulation_run_id":"sim_prod_v1_30d",
"billing_patch_id":"bp_prod_v1",
"subject_resolution":{
"workspace_id":"ws_1049",
"segment":"ai_video_smb",
"stage":"learning",
"target_environment":"production"
},
"status":"active",
"approver_name":"Theresa",
"approver_role":"CEO",
"rationale":"Seed activation for production baseline config.",
"effective_at":"2026-01-01T00:00:00Z",
"created_at":"2026-01-01T00:25:00Z",
"value_unit_snapshot_version":1,
"diff":{"type":"initial_activation","changes":[]}
}
]

```

---