import * as fs from "fs";
import * as path from "path";

type JsonValue = any;

type EventMapping = {
  event_type: string;
  filters?: Record<string, any>;
  aggregation: { type: "count" | "sum"; field?: string };
};

type ValueUnit = {
  value_unit_id: string;
  name: string;
  unit_type?: string;
  event_mapping: string | JsonValue;
  unit_economics: string | JsonValue;
};

type ConfigVersionRow = any;

function parseJson<T>(v: any, fallback: T): T {
  try {
    if (v === null || v === undefined) return fallback;
    if (typeof v === "string") return JSON.parse(v) as T;
    return v as T;
  } catch {
    return fallback;
  }
}

function loadUsageEvents(): any[] {
  const seedDir = path.join(process.cwd(), "seed");
  const filePath = path.join(seedDir, "usage_events.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function matchesFilters(evt: any, filters: Record<string, any>) {
  for (const [k, v] of Object.entries(filters ?? {})) {
    if (v === undefined || v === null) continue;
    if (evt[k] !== v) return false;
  }
  return true;
}

function computeUnitsForValueUnit(vu: ValueUnit, events: any[]): number {
  const mapping = parseJson<EventMapping>(vu.event_mapping, null as any);
  if (!mapping?.event_type || !mapping?.aggregation?.type) return 0;

  const filtered = events
    .filter((e) => e.event_type === mapping.event_type)
    .filter((e) => matchesFilters(e, mapping.filters ?? {}));

  if (mapping.aggregation.type === "count") return filtered.length;

  if (mapping.aggregation.type === "sum") {
    const field = mapping.aggregation.field;
    if (!field) return 0;
    return filtered.reduce((acc, e) => acc + (Number(e[field]) || 0), 0);
  }

  return 0;
}

function epsilonDenom(x: number) {
  return Math.max(x, 1e-9);
}

// Churn calculation helpers
function getAnnualChurnRate(stage: string | undefined): number {
  if (stage === "scaling") return 0.25;
  if (stage === "learning") return 0.50;
  return 0.50; // default to learning churn
}

function computeChurnMetrics(
  stage: string | undefined,
  historical_window_days: number,
  annual_churn_rate_override?: number,
  churn_horizon_months: number = 12
) {
  const annual_churn_rate = annual_churn_rate_override ?? getAnnualChurnRate(stage);
  const monthly_churn = 1 - Math.pow(1 - annual_churn_rate, 1 / 12);
  const r = 1 - monthly_churn; // retention rate
  const retention_sum = r === 1 ? churn_horizon_months : (1 - Math.pow(r, churn_horizon_months)) / (1 - r);
  const annualization_factor = 365 / historical_window_days;
  
  return {
    annual_churn_rate,
    monthly_churn_rate: monthly_churn,
    retention_sum,
    annualization_factor,
    churn_horizon_months,
  };
}

function computeAnnualizedMetrics(
  revenue_usd: number,
  cost_usd: number,
  historical_window_days: number
) {
  const annualization_factor = 365 / historical_window_days;
  return {
    revenue_annualized_usd: revenue_usd * annualization_factor,
    cost_annualized_usd: cost_usd * annualization_factor,
  };
}

function computeChurnAdjustedMetrics(
  revenue_usd: number,
  cost_usd: number,
  historical_window_days: number,
  retention_sum: number,
  churn_horizon_months: number = 12
) {
  const revenue_monthly_runrate = revenue_usd * (30 / historical_window_days);
  const cost_monthly_runrate = cost_usd * (30 / historical_window_days);
  
  return {
    revenue_12mo_churn_adjusted_usd: revenue_monthly_runrate * retention_sum,
    cost_12mo_churn_adjusted_usd: cost_monthly_runrate * retention_sum,
  };
}

type PricingMode = "use_unit_economics" | "revenue_proxy_total" | "revenue_proxy_commit";
type CommitSemantics = "commit_floor" | "entitlement_only";

export async function runSimulation(params: {
  candidate: ConfigVersionRow;
  candidateValueUnits: any[];
  baseline?: ConfigVersionRow;
  baselineValueUnits?: any[];
  historical_window_days: number;
  filters: { workspace_id?: string; segment?: string; stage?: string; target_environment?: string };
  pricing_mode: PricingMode;
  include_exploration_in_results: boolean;
  segment_customer_count?: number;
  annual_churn_rate?: number;
  churn_horizon_months?: number;
  pool_pricing_mode_overrides?: Record<string, PricingMode>;
  commit_semantics?: CommitSemantics;
  pool_commit_semantics_overrides?: Record<string, CommitSemantics>;
}) {
  const usageEvents = loadUsageEvents();

  // Apply top-level filters if present
  const events = usageEvents.filter((e) => {
    if (params.filters.workspace_id && e.workspace_id !== params.filters.workspace_id) return false;
    if (params.filters.segment && e.segment !== params.filters.segment) return false;
    return true;
  });

  const candidatePools = parseJson<any[]>(params.candidate.pools, []);
  const candidateExploration = parseJson<any>(params.candidate.exploration, { enabled: false });
  const candidateRails = parseJson<any>(params.candidate.rails, {});

  const blocking_issues: string[] = [];

  // Map vu_id -> computed units
  const vuMap = new Map<string, any>();
  for (const vu of params.candidateValueUnits) vuMap.set(vu.value_unit_id, vu);

  const usageByVU: Record<string, number> = {};
  for (const vu of params.candidateValueUnits) {
    usageByVU[vu.value_unit_id] = computeUnitsForValueUnit(vu, events);
  }

  // Default commit semantics
  const defaultCommitSemantics: CommitSemantics = params.commit_semantics ?? "commit_floor";

  // Economics
  let revenue_usd = 0;
  let cost_usd = 0;
  let revenue_commit_floor_usd_total = 0;
  let revenue_usage_total_usd = 0;
  let revenue_usage_overage_usd = 0;
  const pool_breakdown: any[] = [];

  for (const pool of candidatePools) {
    const vu = vuMap.get(pool.value_unit_id);
    if (!vu) {
      blocking_issues.push(`Pool references missing value_unit_id: ${pool.value_unit_id}`);
      continue;
    }

    const econ = parseJson<any>(vu.unit_economics, null);
    const c = econ?.avg_cost_per_unit_usd;
    if (typeof c !== "number" || !Number.isFinite(c) || c < 0) {
      blocking_issues.push(`Missing unit_economics.avg_cost_per_unit_usd for ${vu.value_unit_id}`);
      continue;
    }
    const p = econ?.target_price_per_unit_usd;
    if (typeof p !== "number" || !Number.isFinite(p) || p < 0) {
      blocking_issues.push(`Missing unit_economics.target_price_per_unit_usd for ${vu.value_unit_id}`);
      continue;
    }

    const totalUnits = usageByVU[vu.value_unit_id] || 0;
    const included = Number(pool.included_quantity) || 0;
    const overage = Math.max(0, totalUnits - included);
    const pricePerUnit = p;
    const costPerUnit = c;

    // Determine pricing mode and commit semantics for this pool
    const poolPricingModeUsed = params.pool_pricing_mode_overrides?.[pool.pool_id] ?? params.pricing_mode;
    const poolCommitSemanticsUsed = poolPricingModeUsed === "revenue_proxy_commit"
      ? (params.pool_commit_semantics_overrides?.[pool.pool_id] ?? defaultCommitSemantics)
      : null;

    // Compute detailed revenue breakdown
    const usage_total_revenue_usd = totalUnits * pricePerUnit;
    const usage_overage_revenue_usd = overage * pricePerUnit;
    const commit_floor_revenue_usd = included * pricePerUnit;

    // Compute billed revenue based on pricing mode and commit semantics
    let pool_billed_revenue_usd = 0;
    if (poolPricingModeUsed === "use_unit_economics") {
      pool_billed_revenue_usd = usage_overage_revenue_usd;
    } else if (poolPricingModeUsed === "revenue_proxy_total") {
      pool_billed_revenue_usd = usage_total_revenue_usd;
    } else if (poolPricingModeUsed === "revenue_proxy_commit") {
      if (poolCommitSemanticsUsed === "commit_floor") {
        pool_billed_revenue_usd = Math.max(commit_floor_revenue_usd, usage_total_revenue_usd);
      } else if (poolCommitSemanticsUsed === "entitlement_only") {
        pool_billed_revenue_usd = usage_total_revenue_usd;
      } else {
        // Fallback to commit_floor if semantics not set
        pool_billed_revenue_usd = Math.max(commit_floor_revenue_usd, usage_total_revenue_usd);
      }
    }

    const poolCost = totalUnits * costPerUnit;

    revenue_usd += pool_billed_revenue_usd;
    cost_usd += poolCost;
    revenue_commit_floor_usd_total += poolPricingModeUsed === "revenue_proxy_commit" ? commit_floor_revenue_usd : 0;
    revenue_usage_total_usd += usage_total_revenue_usd;
    revenue_usage_overage_usd += usage_overage_revenue_usd;

    // Add to pool breakdown with detailed revenue fields
    pool_breakdown.push({
      pool_id: pool.pool_id,
      value_unit_id: pool.value_unit_id,
      total_units: totalUnits,
      included_units: included,
      overage_units: overage,
      avg_cost_per_unit_usd: costPerUnit,
      target_price_per_unit_usd: pricePerUnit,
      cost_usd: poolCost,
      revenue_usd: pool_billed_revenue_usd, // Keep for backward compatibility
      revenue_billed_usd: pool_billed_revenue_usd,
      revenue_commit_floor_usd: poolPricingModeUsed === "revenue_proxy_commit" ? commit_floor_revenue_usd : 0,
      revenue_usage_total_usd: usage_total_revenue_usd,
      revenue_usage_overage_usd: usage_overage_revenue_usd,
      pricing_mode_used: poolPricingModeUsed,
      commit_semantics_used: poolCommitSemanticsUsed,
    });
  }

  // Apply segment customer count scaling (default to 1 if not provided)
  const segment_customer_count = params.segment_customer_count ?? 1;
  revenue_usd = revenue_usd * segment_customer_count;
  cost_usd = cost_usd * segment_customer_count;
  revenue_commit_floor_usd_total = revenue_commit_floor_usd_total * segment_customer_count;
  revenue_usage_total_usd = revenue_usage_total_usd * segment_customer_count;
  revenue_usage_overage_usd = revenue_usage_overage_usd * segment_customer_count;

  // Compute margin: null when billed revenue is 0, otherwise compute normally
  let margin: number | null = null;
  if (revenue_usd === 0) {
    margin = null;
  } else {
    margin = (revenue_usd - cost_usd) / epsilonDenom(revenue_usd);
  }

  // Compute margin_commit_floor based on committed contract value
  let margin_commit_floor: number | null = null;
  if (revenue_commit_floor_usd_total > 0) {
    margin_commit_floor = (revenue_commit_floor_usd_total - cost_usd) / epsilonDenom(revenue_commit_floor_usd_total);
  }

  // Rails regressions
  const risks: string[] = [];
  // Only check margin floor if margin is a real number (not null)
  if (margin !== null && typeof candidateRails?.margin_floor === "number" && margin < candidateRails.margin_floor) {
    risks.push(`margin_floor violated: margin=${margin.toFixed(3)} < ${candidateRails.margin_floor}`);
  }
  if (typeof candidateRails?.monthly_spend_cap_usd === "number" && cost_usd > candidateRails.monthly_spend_cap_usd) {
    risks.push(`spend cap exceeded: cost_usd=${cost_usd.toFixed(2)} > ${candidateRails.monthly_spend_cap_usd}`);
  }

  // Compute churn metrics (needed for both candidate and baseline)
  const churn_horizon_months = params.churn_horizon_months ?? 12;
  const churnMetrics = computeChurnMetrics(
    params.filters.stage,
    params.historical_window_days,
    params.annual_churn_rate,
    churn_horizon_months
  );

  // Exploration
  let exploration_depth = 0;
  if (params.include_exploration_in_results && candidateExploration?.enabled) {
    const qualifying = new Set<string>(candidateExploration.qualifying_events ?? []);
    exploration_depth = events.filter((e) => qualifying.has(e.event_type)).length;
  }

  // Baseline comparison, optional
  let baseline_summary: any = null;
  if (params.baseline && params.baselineValueUnits) {
    // Minimal baseline economics, same mechanics
    const baselinePools = parseJson<any[]>(params.baseline.pools, []);
    const baselineVUMap = new Map<string, any>();
    for (const vu of params.baselineValueUnits) baselineVUMap.set(vu.value_unit_id, vu);

    const baselineUsageByVU: Record<string, number> = {};
    for (const vu of params.baselineValueUnits) {
      baselineUsageByVU[vu.value_unit_id] = computeUnitsForValueUnit(vu, events);
    }

    let baseRev = 0;
    let baseCost = 0;
    let baseRevCommitFloor = 0;
    let baseRevUsageTotal = 0;
    let baseRevUsageOverage = 0;

    for (const pool of baselinePools) {
      const vu = baselineVUMap.get(pool.value_unit_id);
      if (!vu) continue;

      const econ = parseJson<any>(vu.unit_economics, null);
      const totalUnits = baselineUsageByVU[vu.value_unit_id] || 0;
      const included = Number(pool.included_quantity) || 0;
      const overage = Math.max(0, totalUnits - included);
      const pricePerUnit = Number(econ?.target_price_per_unit_usd || 0);
      const costPerUnit = Number(econ?.avg_cost_per_unit_usd || 0);

      // Determine pricing mode and commit semantics for baseline pool
      const poolPricingModeUsed = params.pool_pricing_mode_overrides?.[pool.pool_id] ?? params.pricing_mode;
      const poolCommitSemanticsUsed = poolPricingModeUsed === "revenue_proxy_commit"
        ? (params.pool_commit_semantics_overrides?.[pool.pool_id] ?? defaultCommitSemantics)
        : null;

      // Compute detailed revenue breakdown
      const usage_total_revenue_usd = totalUnits * pricePerUnit;
      const usage_overage_revenue_usd = overage * pricePerUnit;
      const commit_floor_revenue_usd = included * pricePerUnit;

      // Compute billed revenue
      let pool_billed_revenue_usd = 0;
      if (poolPricingModeUsed === "use_unit_economics") {
        pool_billed_revenue_usd = usage_overage_revenue_usd;
      } else if (poolPricingModeUsed === "revenue_proxy_total") {
        pool_billed_revenue_usd = usage_total_revenue_usd;
      } else if (poolPricingModeUsed === "revenue_proxy_commit") {
        if (poolCommitSemanticsUsed === "commit_floor") {
          pool_billed_revenue_usd = Math.max(commit_floor_revenue_usd, usage_total_revenue_usd);
        } else if (poolCommitSemanticsUsed === "entitlement_only") {
          pool_billed_revenue_usd = usage_total_revenue_usd;
        } else {
          pool_billed_revenue_usd = Math.max(commit_floor_revenue_usd, usage_total_revenue_usd);
        }
      }

      baseRev += pool_billed_revenue_usd;
      baseCost += totalUnits * costPerUnit;
      baseRevCommitFloor += poolPricingModeUsed === "revenue_proxy_commit" ? commit_floor_revenue_usd : 0;
      baseRevUsageTotal += usage_total_revenue_usd;
      baseRevUsageOverage += usage_overage_revenue_usd;
    }

    // Apply segment customer count scaling to baseline
    baseRev = baseRev * segment_customer_count;
    baseCost = baseCost * segment_customer_count;
    baseRevCommitFloor = baseRevCommitFloor * segment_customer_count;
    baseRevUsageTotal = baseRevUsageTotal * segment_customer_count;
    baseRevUsageOverage = baseRevUsageOverage * segment_customer_count;

    // Compute baseline margin with same logic as candidate
    // null when billed revenue is 0, otherwise compute normally
    let baseMargin: number | null = null;
    if (baseRev === 0) {
      baseMargin = null;
    } else {
      baseMargin = (baseRev - baseCost) / epsilonDenom(baseRev);
    }

    // Compute annualized and churn-adjusted metrics for baseline
    const baseAnnualized = computeAnnualizedMetrics(baseRev, baseCost, params.historical_window_days);
    const baseChurnAdjusted = computeChurnAdjustedMetrics(
      baseRev,
      baseCost,
      params.historical_window_days,
      churnMetrics.retention_sum,
      churn_horizon_months
    );
    const baseCommitFloorAnnualized = computeAnnualizedMetrics(baseRevCommitFloor, 0, params.historical_window_days);
    const baseCommitFloorChurnAdjusted = computeChurnAdjustedMetrics(
      baseRevCommitFloor,
      0,
      params.historical_window_days,
      churnMetrics.retention_sum,
      churn_horizon_months
    );

    baseline_summary = {
      revenue_usd: baseRev,
      revenue_billed_usd: baseRev,
      revenue_commit_floor_usd_total: baseRevCommitFloor,
      revenue_usage_total_usd: baseRevUsageTotal,
      revenue_usage_overage_usd: baseRevUsageOverage,
      cost_usd: baseCost,
      margin: baseMargin,
      margin_commit_floor: baseRevCommitFloor > 0 
        ? (baseRevCommitFloor - baseCost) / epsilonDenom(baseRevCommitFloor)
        : null,
      revenue_annualized_usd: baseAnnualized.revenue_annualized_usd,
      cost_annualized_usd: baseAnnualized.cost_annualized_usd,
      revenue_12mo_churn_adjusted_usd: baseChurnAdjusted.revenue_12mo_churn_adjusted_usd,
      cost_12mo_churn_adjusted_usd: baseChurnAdjusted.cost_12mo_churn_adjusted_usd,
      revenue_commit_floor_annualized_usd: baseCommitFloorAnnualized.revenue_annualized_usd,
      revenue_commit_floor_12mo_churn_adjusted_usd: baseCommitFloorChurnAdjusted.revenue_12mo_churn_adjusted_usd,
    };
  }

  // Compute annualized metrics for candidate
  const annualized = computeAnnualizedMetrics(revenue_usd, cost_usd, params.historical_window_days);
  const commitFloorAnnualized = computeAnnualizedMetrics(revenue_commit_floor_usd_total, 0, params.historical_window_days);
  
  // Compute churn-adjusted metrics for candidate
  const churnAdjusted = computeChurnAdjustedMetrics(
    revenue_usd,
    cost_usd,
    params.historical_window_days,
    churnMetrics.retention_sum,
    churn_horizon_months
  );
  const commitFloorChurnAdjusted = computeChurnAdjustedMetrics(
    revenue_commit_floor_usd_total,
    0,
    params.historical_window_days,
    churnMetrics.retention_sum,
    churn_horizon_months
  );

  // Minimal output contract
  return {
    primary_metric_deltas: {}, // you can fill later, keep deterministic
    lens_metrics: {
      exploration_depth,
      margin_floor_violations: margin !== null && risks.some((r) => r.startsWith("margin_floor violated")) ? 1 : 0,
    },
    economics_summary: {
      revenue_usd, // Keep for backward compatibility, equals revenue_billed_usd
      revenue_billed_usd: revenue_usd,
      revenue_commit_floor_usd_total,
      revenue_usage_total_usd,
      revenue_usage_overage_usd,
      cost_usd,
      margin,
      margin_commit_floor,
      revenue_annualized_usd: annualized.revenue_annualized_usd,
      cost_annualized_usd: annualized.cost_annualized_usd,
      revenue_12mo_churn_adjusted_usd: churnAdjusted.revenue_12mo_churn_adjusted_usd,
      cost_12mo_churn_adjusted_usd: churnAdjusted.cost_12mo_churn_adjusted_usd,
      revenue_commit_floor_annualized_usd: commitFloorAnnualized.revenue_annualized_usd,
      revenue_commit_floor_12mo_churn_adjusted_usd: commitFloorChurnAdjusted.revenue_12mo_churn_adjusted_usd,
      assumptions: {
        segment_customer_count,
        annual_churn_rate: churnMetrics.annual_churn_rate,
        monthly_churn_rate: churnMetrics.monthly_churn_rate,
        annualization_factor: churnMetrics.annualization_factor,
        churn_horizon_months: churnMetrics.churn_horizon_months,
      },
    },
    pool_breakdown,
    exploration_summary: params.include_exploration_in_results
      ? { enabled: Boolean(candidateExploration?.enabled), exploration_depth }
      : { enabled: false },
    risks,
    blocking_issues,
    baseline_summary,
  };
}
