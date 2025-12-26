# AVS Brain by ValueTempo
AVS Brian is the economic decisioning layer for AI-native founders and product managers with business 
This is an alpha version of AVS Brain. 

### System boundaries and contracts

**AVS Brain role**
- AVS Brain is the **control plane** and **system of record** for AVS decisions, configs, and rationale.
- AVS Brain generates versioned policies, simulations, and billing patches, it does not enforce runtime usage limits.

**Customer app role**
- The customer app is the **data plane**, it enforces pools and rails at runtime using the active config fetched from AVS Brain and cached locally.
- The customer app emits enforcement outcomes back to AVS Brain for learning and audit.

**Billing system role (Metronome or similar)**
- Billing is the **ledger**, it meters and invoices.
- AVS Brain may push pricing references upstream as a billing patch, billing does not own pool and rail enforcement.

### MVP scope, goals, and non-goals
**MVP goals**
- Generate a coherent AVS cycle, value units, and a config for a segment and stage.
- Run a deterministic simulation that produces a gate decision, ready or not ready.
- Create an approval record and a versioned active config.
- Export a billing patch payload (even if actual push is stubbed in MVP).

**MVP non-goals**
- No billing execution inside AVS Brain.
- No contract negotiation logic.
- No full experimentation system (assignment, holdouts, causal reads). MVP uses simulation, not experiments.

### Period rules
- **Production cycle length is fixed to 90 days.**
- Sandbox cycles may be 90 or 120 days.
- Only 90-day cycles can be promoted to production.

### Stage enum for MVP
- Stage is a required enum with exactly two values:
    - `learning`
    - `scaling`

Stage must drive defaults and promotion strictness, otherwise it is removed.

### Quality is advisory in MVP
- Quality signals are required inputs for completeness and recommendations.
- Quality does not alter billing math in MVP.
- Simulation may flag quality risk, but pricing output remains unaffected.

### Enforcement contract, what Valuebeat outputs, what the app enforces
Valuebeat must output a deterministic enforcement policy:

- Value unit counting rules (event type, filters, aggregation)
- Pools (included quantities, rollover policy, overage behavior)
- Exploration rules (qualifying events, expiration, graduation signal)
- Rails (thresholds, caps, actions)

Allowed action enums:
- `warn`
- `throttle`
- `block`
- `require_approval`
- `degrade_quality`

Runtime enforcement happens only in the customer app.

### Versioning, audit, and decision record
Every change to a production config must produce:
- Config version snapshot
- Diff versus previous active version
- Approval metadata (approver, rationale)
- Simulation run reference
- Effective date

### Learning loop inputs, enforcement outcomes
Customer app posts enforcement outcomes to Valuebeat:
- `rail_warning_shown`
- `rail_throttle_applied`
- `hard_cap_blocked`
- `exploration_graduated`
- `override_approved`
- `quality_proxy_failed`

ValueTempo stores these as evidence tied to config versions.

Copyrights © 2025-2026 ValueTempo.ai All Reserved.
