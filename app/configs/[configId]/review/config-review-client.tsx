"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ConfigDetail = {
  config_version_id: string;
  workspace_id: string;
  segment: string;
  stage: string;
  target_environment: string;
  status: string;
  version: number;
  effective_at: string;
  value_unit_snapshot_version: number;
  price_book_ref: string;
  pools: any;
  exploration: any;
  rails: any;
  cycle: {
    goal_type: string | null;
    primary_metrics: string[];
    narrative: string | null;
  };
};

type BaselineOption = {
  config_version_id: string;
  version: number;
  status: string;
  effective_at: string;
};

type SimulationResult = {
  simulation_run_id: string;
  output: {
    economics_summary?: {
      revenue_usd?: number;
      revenue_billed_usd?: number;
      revenue_commit_floor_usd_total?: number;
      revenue_usage_total_usd?: number;
      revenue_usage_overage_usd?: number;
      cost_usd?: number;
      margin?: number | null;
      margin_commit_floor?: number | null;
      revenue_annualized_usd?: number;
      cost_annualized_usd?: number;
      revenue_12mo_churn_adjusted_usd?: number;
      cost_12mo_churn_adjusted_usd?: number;
      revenue_commit_floor_annualized_usd?: number;
      revenue_commit_floor_12mo_churn_adjusted_usd?: number;
      assumptions?: {
        segment_customer_count?: number;
        annual_churn_rate?: number;
        monthly_churn_rate?: number;
        churn_horizon_months?: number;
      };
    };
    pool_breakdown?: Array<{
      pool_id: string;
      value_unit_id: string;
      revenue_usd?: number;
      revenue_billed_usd?: number;
      revenue_commit_floor_usd?: number;
      revenue_usage_total_usd?: number;
      revenue_usage_overage_usd?: number;
      pricing_mode_used?: string;
      commit_semantics_used?: string | null;
      [key: string]: any;
    }>;
    lens_metrics?: {
      exploration_depth?: number;
      margin_floor_violations?: number;
      [key: string]: any;
    };
    risks?: string[];
    blocking_issues?: string[];
    [key: string]: any;
  };
  completeness_result: string;
};

type SegmentRow = {
  segment: string;
  stage: string;
  target_environment: string;
  customer_count: string; // string to avoid cursor jumping on input
};

type SegmentSimulationResult = {
  segment: string;
  stage: string;
  target_environment: string;
  result: SimulationResult;
};

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ConfigReviewClient({
  configId,
}: {
  configId: string;
}) {
  const [data, setData] = useState<ConfigDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Simulation state
  const [baselineOptions, setBaselineOptions] = useState<BaselineOption[]>([]);
  const [baselineLoading, setBaselineLoading] = useState(true);
  const [baselineConfigId, setBaselineConfigId] = useState<string>("none");
  const [historicalWindowDays, setHistoricalWindowDays] = useState<number>(30);
  const [includeExploration, setIncludeExploration] = useState<boolean>(true);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [simulationRunning, setSimulationRunning] = useState<boolean>(false);
  
  // Product rollup state
  const [simulationMode, setSimulationMode] = useState<"single" | "rollup">("single");
  const [segmentRows, setSegmentRows] = useState<SegmentRow[]>([]);
  const [segmentResults, setSegmentResults] = useState<SegmentSimulationResult[]>([]);
  const [segments, setSegments] = useState<Array<{ segment_id: string; label: string }>>([]);
  const [customers, setCustomers] = useState<Array<{ customer_id: string; segment_id: string }>>([]);
  
  // Churn state (strings to avoid cursor jumping on input)
  const [churnMode, setChurnMode] = useState<"stage_default" | "custom">("stage_default");
  const [annualChurnRate, setAnnualChurnRate] = useState<string>("50"); // percent as string
  const [churnHorizonMonths, setChurnHorizonMonths] = useState<string>("12"); // months as string
  
  // Pricing mode state
  const [pricingMode, setPricingMode] = useState<"use_unit_economics" | "revenue_proxy_total" | "revenue_proxy_commit">("use_unit_economics");
  const [poolPricingModeOverrides, setPoolPricingModeOverrides] = useState<Record<string, "use_unit_economics" | "revenue_proxy_total" | "revenue_proxy_commit">>({});
  
  // Commit semantics state
  const [commitSemantics, setCommitSemantics] = useState<"commit_floor" | "entitlement_only">("commit_floor");
  const [poolCommitSemanticsOverrides, setPoolCommitSemanticsOverrides] = useState<Record<string, "commit_floor" | "entitlement_only">>({});
  
  // Approval state
  const [approverName, setApproverName] = useState<string>("Theresa");
  const [approverRole, setApproverRole] = useState<string>("CEO");
  const [rationale, setRationale] = useState<string>("");
  const [effectiveAt, setEffectiveAt] = useState<string>("");
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalRunning, setApprovalRunning] = useState<boolean>(false);
  
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`/api/configs/${configId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Config not found");
          }
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? `Request failed: ${res.status}`);
        }
        const json = (await res.json()) as ConfigDetail;
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [configId]);

  // Fetch baseline options
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setBaselineLoading(true);
        const res = await fetch(`/api/configs/${configId}/baseline-options`, {
          cache: "no-store",
        });
        if (!res.ok) {
          return;
        }
        const json = (await res.json()) as { items: BaselineOption[] };
        if (!cancelled) setBaselineOptions(json.items);
      } catch (e: any) {
        console.error("Error loading baseline options:", e);
      } finally {
        if (!cancelled) setBaselineLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [configId]);

  // Load segments and customers for rollup mode
  useEffect(() => {
    async function load() {
      try {
        const [segRes, custRes] = await Promise.all([
          fetch("/api/catalogs/segments"),
          fetch("/api/catalogs/customers"),
        ]);
        if (segRes.ok) {
          const segs = await segRes.json();
          setSegments(segs);
        }
        if (custRes.ok) {
          const custs = await custRes.json();
          setCustomers(custs);
        }
      } catch (e) {
        console.error("Error loading segments/customers:", e);
      }
    }
    load();
  }, []);

  // Initialize segment rows when data loads
  useEffect(() => {
    if (data && segmentRows.length === 0) {
      // Count customers for default segment
      const customerCount = customers.filter(c => c.segment_id === data.segment).length || 1;
      setSegmentRows([{
        segment: data.segment,
        stage: data.stage,
        target_environment: data.target_environment,
        customer_count: String(customerCount),
      }]);
    }
  }, [data, customers, segmentRows.length]);

  async function handleRunSimulation() {
    if (!data) return;

    setSimulationRunning(true);
    setSimulationError(null);
    setSimulationResult(null);
    setSegmentResults([]);

    try {
      if (simulationMode === "single") {
        // Single segment mode
        const body: any = {
          candidate_config_version_id: data.config_version_id,
          baseline_config_version_id: baselineConfigId === "none" ? null : baselineConfigId,
          historical_window_days: historicalWindowDays,
          filters: {
            workspace_id: data.workspace_id,
            segment: data.segment,
            stage: data.stage,
            target_environment: data.target_environment,
          },
          pricing_mode: pricingMode,
          include_exploration_in_results: includeExploration,
          pool_pricing_mode_overrides: Object.keys(poolPricingModeOverrides).length > 0 ? poolPricingModeOverrides : undefined,
          commit_semantics: commitSemantics,
          pool_commit_semantics_overrides: Object.keys(poolCommitSemanticsOverrides).length > 0 ? poolCommitSemanticsOverrides : undefined,
        };

        // Add churn inputs if custom (parse and validate at request time)
        if (churnMode === "custom") {
          const parsedPercent = parseFloat(annualChurnRate);
          if (!isNaN(parsedPercent) && annualChurnRate.trim() !== "") {
            const clampedPercent = Math.max(0, Math.min(100, parsedPercent));
            body.annual_churn_rate = clampedPercent / 100; // convert percent to decimal
          }
          const parsedMonths = parseInt(churnHorizonMonths, 10);
          if (!isNaN(parsedMonths) && churnHorizonMonths.trim() !== "") {
            body.churn_horizon_months = Math.max(1, Math.min(120, parsedMonths));
          } else {
            body.churn_horizon_months = 12; // default if blank/invalid
          }
        }

        const res = await fetch("/api/simulations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => null);
          const errorMsg = json?.error ?? `Request failed: ${res.status}`;
          const errorDetails = json?.details ? `: ${json.details}` : "";
          throw new Error(errorMsg + errorDetails);
        }

        const result = (await res.json()) as SimulationResult;
        setSimulationResult(result);
      } else {
        // Product rollup mode - run simulation for each segment row
        const results: SegmentSimulationResult[] = [];
        
        for (const row of segmentRows) {
          const body: any = {
            candidate_config_version_id: data.config_version_id,
            baseline_config_version_id: baselineConfigId === "none" ? null : baselineConfigId,
            historical_window_days: historicalWindowDays,
            filters: {
              workspace_id: data.workspace_id,
              segment: row.segment,
              stage: row.stage,
              target_environment: row.target_environment,
            },
            pricing_mode: pricingMode,
            include_exploration_in_results: includeExploration,
            pool_pricing_mode_overrides: Object.keys(poolPricingModeOverrides).length > 0 ? poolPricingModeOverrides : undefined,
            commit_semantics: commitSemantics,
            pool_commit_semantics_overrides: Object.keys(poolCommitSemanticsOverrides).length > 0 ? poolCommitSemanticsOverrides : undefined,
          };

          // Parse and validate customer count
          const parsedCustomerCount = parseInt(row.customer_count, 10);
          if (!isNaN(parsedCustomerCount) && row.customer_count.trim() !== "") {
            body.segment_customer_count = Math.max(1, parsedCustomerCount);
          } else {
            body.segment_customer_count = 1; // default if blank/invalid
          }

          // Add churn inputs if custom (parse and validate at request time)
          if (churnMode === "custom") {
            const parsedPercent = parseFloat(annualChurnRate);
            if (!isNaN(parsedPercent) && annualChurnRate.trim() !== "") {
              const clampedPercent = Math.max(0, Math.min(100, parsedPercent));
              body.annual_churn_rate = clampedPercent / 100; // convert percent to decimal
            }
            const parsedMonths = parseInt(churnHorizonMonths, 10);
            if (!isNaN(parsedMonths) && churnHorizonMonths.trim() !== "") {
              body.churn_horizon_months = Math.max(1, Math.min(120, parsedMonths));
            } else {
              body.churn_horizon_months = 12; // default if blank/invalid
            }
          }

          const res = await fetch("/api/simulations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const json = await res.json().catch(() => null);
            const errorMsg = json?.error ?? `Request failed: ${res.status}`;
            throw new Error(`Segment ${row.segment}: ${errorMsg}`);
          }

          const result = (await res.json()) as SimulationResult;
          results.push({
            segment: row.segment,
            stage: row.stage,
            target_environment: row.target_environment,
            result,
          });
        }

        setSegmentResults(results);
      }
    } catch (e: any) {
      setSimulationError(e?.message ?? String(e));
    } finally {
      setSimulationRunning(false);
    }
  }

  async function handleApprove() {
    if (!data || !simulationResult) return;

    setApprovalRunning(true);
    setApprovalError(null);

    try {
      const body: any = {
        config_version_id: data.config_version_id,
        simulation_run_id: simulationResult.simulation_run_id,
        approver_name: approverName,
        approver_role: approverRole,
        rationale: rationale,
      };

      if (effectiveAt) {
        // Convert datetime-local format to ISO string
        const date = new Date(effectiveAt);
        body.effective_at = date.toISOString();
      }

      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const errorMsg = json?.error ?? `Request failed: ${res.status}`;
        const errorDetails = json?.details ? `: ${json.details}` : "";
        throw new Error(errorMsg + errorDetails);
      }

      const result = await res.json();
      
      // Redirect to decision log detail page
      router.push(`/decision-log/${result.decision_id}`);
    } catch (e: any) {
      setApprovalError(e?.message ?? String(e));
    } finally {
      setApprovalRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-600">Error: {err}</div>
        {err === "Config not found" && (
          <div className="mt-4 text-sm text-muted-foreground">
            The config version youre looking for doesn&apos;t exist.
          </div>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">No data available.</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Config Review</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data.config_version_id}
        </p>
      </div>

      {/* Header */}
      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Config ID</div>
            <div className="font-mono text-sm">{data.config_version_id}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Status</div>
            <span className="rounded-md border px-2 py-0.5 text-sm">
              {data.status}
            </span>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Version</div>
            <div className="text-sm">{data.version}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Effective At</div>
            <div className="text-sm">{fmt(data.effective_at)}</div>
          </div>
        </div>
      </div>

      {/* Subject Resolution */}
      <div className="rounded-lg border p-4 space-y-2">
        <h2 className="font-semibold">Subject Resolution</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Workspace ID</div>
            <div className="font-mono">{data.workspace_id}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Segment</div>
            <div>{data.segment}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Stage</div>
            <div>{data.stage}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Target Environment</div>
            <div>{data.target_environment}</div>
          </div>
        </div>
      </div>

      {/* North Star */}
      <div className="rounded-lg border p-4 space-y-2">
        <h2 className="font-semibold">North Star</h2>
        <div className="space-y-2 text-sm">
          <div>
            <div className="text-muted-foreground">Goal Type</div>
            <div>{data.cycle.goal_type || "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Primary Metrics</div>
            <div>{data.cycle.primary_metrics.join(", ") || "—"}</div>
          </div>
          {data.cycle.narrative && (
            <div>
              <div className="text-muted-foreground">Narrative</div>
              <div>{data.cycle.narrative}</div>
            </div>
          )}
        </div>
      </div>

      {/* Pools */}
      <div className="rounded-lg border p-4 space-y-2">
        <h2 className="font-semibold">Pools</h2>
        <pre className="text-xs bg-muted p-3 rounded overflow-auto">
          {JSON.stringify(data.pools, null, 2)}
        </pre>
      </div>

      {/* Exploration */}
      <div className="rounded-lg border p-4 space-y-2">
        <h2 className="font-semibold">Exploration</h2>
        <pre className="text-xs bg-muted p-3 rounded overflow-auto">
          {JSON.stringify(data.exploration, null, 2)}
        </pre>
      </div>

      {/* Rails */}
      <div className="rounded-lg border p-4 space-y-2">
        <h2 className="font-semibold">Rails</h2>
        <pre className="text-xs bg-muted p-3 rounded overflow-auto">
          {JSON.stringify(data.rails, null, 2)}
        </pre>
      </div>

      {/* Metadata */}
      <div className="rounded-lg border p-4 space-y-2">
        <h2 className="font-semibold">Metadata</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Value Unit Snapshot Version</div>
            <div>{data.value_unit_snapshot_version}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Price Book Ref</div>
            <div className="font-mono">{data.price_book_ref}</div>
          </div>
        </div>
      </div>

      {/* Simulation */}
      <div className="rounded-lg border p-4 space-y-4">
        <h2 className="font-semibold">Simulation</h2>
        
        <div className="space-y-4">
          {/* Baseline Config */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Baseline Config Version ID
            </label>
            <select
              value={baselineConfigId}
              onChange={(e) => setBaselineConfigId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={baselineLoading || simulationRunning}
            >
              <option value="none">None</option>
              {baselineOptions.map((opt) => (
                <option key={opt.config_version_id} value={opt.config_version_id}>
                  {opt.config_version_id} (v{opt.version}, {opt.status})
                </option>
              ))}
            </select>
          </div>

          {/* Historical Window Days */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Historical Window Days
            </label>
            <select
              value={historicalWindowDays}
              onChange={(e) => setHistoricalWindowDays(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={simulationRunning}
            >
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={90}>90</option>
              <option value={120}>120</option>
            </select>
          </div>

          {/* Include Exploration */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="include-exploration"
              checked={includeExploration}
              onChange={(e) => setIncludeExploration(e.target.checked)}
              disabled={simulationRunning}
              className="rounded border-input"
            />
            <label htmlFor="include-exploration" className="text-sm">
              Include exploration in results
            </label>
          </div>

          {/* Pricing Model */}
          <div>
            <label className="block text-sm font-medium mb-1">Pricing Model</label>
            <select
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value as typeof pricingMode)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={simulationRunning}
            >
              <option value="use_unit_economics">use_unit_economics</option>
              <option value="revenue_proxy_total">revenue_proxy_total</option>
              <option value="revenue_proxy_commit">revenue_proxy_commit</option>
            </select>
          </div>

          {/* Commit Semantics (only show when pricing mode is commit or any pool override uses commit) */}
          {(pricingMode === "revenue_proxy_commit" || 
            Object.values(poolPricingModeOverrides).some(mode => mode === "revenue_proxy_commit")) && (
            <div>
              <label className="block text-sm font-medium mb-1">Commit Semantics</label>
              <select
                value={commitSemantics}
                onChange={(e) => setCommitSemantics(e.target.value as typeof commitSemantics)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={simulationRunning}
              >
                <option value="commit_floor">Commit floor (billable minimum)</option>
                <option value="entitlement_only">Entitlement only (track commit separately)</option>
              </select>
            </div>
          )}

          {/* Per-Pool Pricing Mode Overrides */}
          {data && data.pools && Array.isArray(data.pools) && data.pools.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Per-Pool Pricing Overrides</label>
              <div className="text-xs text-muted-foreground mb-2">
                Override pricing mode for specific pools. Leave as &quot;inherit&quot; to use global pricing model.
              </div>
              <div className="space-y-2">
                {data.pools.map((pool: any) => {
                  const poolId = pool.pool_id || pool.value_unit_id;
                  const currentOverride = poolPricingModeOverrides[poolId];
                  const poolPricingModeUsed = currentOverride || pricingMode;
                  const isCommitMode = poolPricingModeUsed === "revenue_proxy_commit";
                  const currentCommitOverride = poolCommitSemanticsOverrides[poolId];
                  return (
                    <div key={poolId} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-32 truncate" title={poolId}>
                          {pool.label || poolId}:
                        </label>
                        <select
                          value={currentOverride || "inherit"}
                          onChange={(e) => {
                            const newOverrides = { ...poolPricingModeOverrides };
                            const newCommitOverrides = { ...poolCommitSemanticsOverrides };
                            if (e.target.value === "inherit") {
                              delete newOverrides[poolId];
                              delete newCommitOverrides[poolId];
                            } else {
                              newOverrides[poolId] = e.target.value as typeof pricingMode;
                              // Clear commit override if switching away from commit mode
                              if (e.target.value !== "revenue_proxy_commit") {
                                delete newCommitOverrides[poolId];
                              }
                            }
                            setPoolPricingModeOverrides(newOverrides);
                            setPoolCommitSemanticsOverrides(newCommitOverrides);
                          }}
                          className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                          disabled={simulationRunning}
                        >
                          <option value="inherit">inherit (global)</option>
                          <option value="use_unit_economics">use_unit_economics</option>
                          <option value="revenue_proxy_total">revenue_proxy_total</option>
                          <option value="revenue_proxy_commit">revenue_proxy_commit</option>
                        </select>
                      </div>
                      {/* Per-pool commit semantics override (only for commit mode pools) */}
                      {isCommitMode && (
                        <div className="flex items-center gap-2 ml-36">
                          <label className="text-xs w-32 text-muted-foreground">Commit semantics:</label>
                          <select
                            value={currentCommitOverride || "inherit"}
                            onChange={(e) => {
                              const newCommitOverrides = { ...poolCommitSemanticsOverrides };
                              if (e.target.value === "inherit") {
                                delete newCommitOverrides[poolId];
                              } else {
                                newCommitOverrides[poolId] = e.target.value as typeof commitSemantics;
                              }
                              setPoolCommitSemanticsOverrides(newCommitOverrides);
                            }}
                            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                            disabled={simulationRunning}
                          >
                            <option value="inherit">inherit (global)</option>
                            <option value="commit_floor">commit_floor</option>
                            <option value="entitlement_only">entitlement_only</option>
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Simulation Mode Toggle */}
          <div>
            <label className="block text-sm font-medium mb-1">Simulation Mode</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="simulation-mode"
                  value="single"
                  checked={simulationMode === "single"}
                  onChange={(e) => setSimulationMode(e.target.value as "single" | "rollup")}
                  disabled={simulationRunning}
                  className="rounded border-input"
                />
                <span className="text-sm">Single segment</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="simulation-mode"
                  value="rollup"
                  checked={simulationMode === "rollup"}
                  onChange={(e) => setSimulationMode(e.target.value as "single" | "rollup")}
                  disabled={simulationRunning}
                  className="rounded border-input"
                />
                <span className="text-sm">Product Rollup (multi-segment)</span>
              </label>
            </div>
          </div>

          {/* Segment Rows (Product Rollup Mode) */}
          {simulationMode === "rollup" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Segment Mix</label>
              {segmentRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-2 items-end">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Segment</label>
                    <select
                      value={row.segment}
                      onChange={(e) => {
                        const newRows = [...segmentRows];
                        newRows[idx].segment = e.target.value;
                        // Update customer count for new segment
                        const count = customers.filter(c => c.segment_id === e.target.value).length || 1;
                        newRows[idx].customer_count = String(count);
                        setSegmentRows(newRows);
                      }}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                      disabled={simulationRunning}
                    >
                      {segments.map((seg) => (
                        <option key={seg.segment_id} value={seg.segment_id}>
                          {seg.label || seg.segment_id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Stage</label>
                    <select
                      value={row.stage}
                      onChange={(e) => {
                        const newRows = [...segmentRows];
                        newRows[idx].stage = e.target.value;
                        setSegmentRows(newRows);
                      }}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                      disabled={simulationRunning}
                    >
                      <option value="learning">learning</option>
                      <option value="scaling">scaling</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Environment</label>
                    <select
                      value={row.target_environment}
                      onChange={(e) => {
                        const newRows = [...segmentRows];
                        newRows[idx].target_environment = e.target.value;
                        setSegmentRows(newRows);
                      }}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                      disabled={simulationRunning}
                    >
                      <option value="sandbox">sandbox</option>
                      <option value="production">production</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Customer Count</label>
                    <input
                      type="text"
                      value={row.customer_count}
                      onChange={(e) => {
                        const newRows = [...segmentRows];
                        newRows[idx].customer_count = e.target.value;
                        setSegmentRows(newRows);
                      }}
                      onBlur={(e) => {
                        // Optional: clamp on blur for better UX
                        const parsed = parseInt(e.target.value, 10);
                        if (!isNaN(parsed) && e.target.value.trim() !== "") {
                          const clamped = Math.max(1, parsed);
                          const newRows = [...segmentRows];
                          newRows[idx].customer_count = String(clamped);
                          setSegmentRows(newRows);
                        } else if (e.target.value.trim() === "") {
                          // Allow empty, will use default at request time
                          const newRows = [...segmentRows];
                          newRows[idx].customer_count = "";
                          setSegmentRows(newRows);
                        }
                      }}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                      disabled={simulationRunning}
                      placeholder="1+"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setSegmentRows(segmentRows.filter((_, i) => i !== idx));
                    }}
                    disabled={simulationRunning || segmentRows.length === 1}
                    className="rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setSegmentRows([...segmentRows, {
                    segment: data?.segment || segments[0]?.segment_id || "",
                    stage: data?.stage || "learning",
                    target_environment: data?.target_environment || "production",
                    customer_count: "1",
                  }]);
                }}
                disabled={simulationRunning}
                className="rounded-md border bg-background px-3 py-1 text-xs hover:bg-accent"
              >
                + Add Segment
              </button>
            </div>
          )}

          {/* Churn Assumptions */}
          <div className="space-y-2 border-t pt-4">
            <label className="block text-sm font-medium">Churn Assumptions</label>
            <div className="space-y-2">
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="churn-mode"
                    value="stage_default"
                    checked={churnMode === "stage_default"}
                    onChange={(e) => setChurnMode(e.target.value as "stage_default" | "custom")}
                    disabled={simulationRunning}
                    className="rounded border-input"
                  />
                  <span className="text-sm">Stage default</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="churn-mode"
                    value="custom"
                    checked={churnMode === "custom"}
                    onChange={(e) => setChurnMode(e.target.value as "stage_default" | "custom")}
                    disabled={simulationRunning}
                    className="rounded border-input"
                  />
                  <span className="text-sm">Custom annual churn</span>
                </label>
              </div>
              {churnMode === "custom" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Annual Churn Rate (%)
                    </label>
                    <input
                      type="text"
                      value={annualChurnRate}
                      onChange={(e) => setAnnualChurnRate(e.target.value)}
                      onBlur={(e) => {
                        // Optional: clamp on blur for better UX
                        const parsed = parseFloat(e.target.value);
                        if (!isNaN(parsed) && e.target.value.trim() !== "") {
                          const clamped = Math.max(0, Math.min(100, parsed));
                          setAnnualChurnRate(String(clamped));
                        } else if (e.target.value.trim() === "") {
                          // Allow empty, will use default at request time
                          setAnnualChurnRate("");
                        }
                      }}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                      disabled={simulationRunning}
                      placeholder="0-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Churn Horizon (months)
                    </label>
                    <input
                      type="text"
                      value={churnHorizonMonths}
                      onChange={(e) => setChurnHorizonMonths(e.target.value)}
                      onBlur={(e) => {
                        // Optional: clamp on blur for better UX
                        const parsed = parseInt(e.target.value, 10);
                        if (!isNaN(parsed) && e.target.value.trim() !== "") {
                          const clamped = Math.max(1, Math.min(120, parsed));
                          setChurnHorizonMonths(String(clamped));
                        } else if (e.target.value.trim() === "") {
                          // Allow empty, will use default at request time
                          setChurnHorizonMonths("");
                        }
                      }}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                      disabled={simulationRunning}
                      placeholder="1-120"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRunSimulation}
            disabled={simulationRunning}
            className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {simulationRunning ? "Running..." : "Run simulation"}
          </button>
        </div>

        {/* Simulation Error */}
        {simulationError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="font-medium">Error</div>
            <div className="mt-1">{simulationError}</div>
          </div>
        )}

        {/* Product Rollup Results */}
        {simulationMode === "rollup" && segmentResults.length > 0 && (() => {
          // Aggregate rollup results
          const rollup = {
            revenue_usd: 0,
            revenue_billed_usd: 0,
            revenue_commit_floor_usd_total: 0,
            revenue_usage_total_usd: 0,
            cost_usd: 0,
            revenue_annualized_usd: 0,
            cost_annualized_usd: 0,
            revenue_12mo_churn_adjusted_usd: 0,
            cost_12mo_churn_adjusted_usd: 0,
            revenue_commit_floor_annualized_usd: 0,
            revenue_commit_floor_12mo_churn_adjusted_usd: 0,
            margin_floor_violations: 0,
            exploration_depth: 0,
            risks: [] as string[],
            assumptions: segmentResults[0]?.result.output.economics_summary?.assumptions,
          };

          segmentResults.forEach((segResult) => {
            const econ = segResult.result.output.economics_summary;
            if (econ) {
              rollup.revenue_usd += econ.revenue_usd || 0;
              rollup.revenue_billed_usd += econ.revenue_billed_usd || econ.revenue_usd || 0;
              rollup.revenue_commit_floor_usd_total += econ.revenue_commit_floor_usd_total || 0;
              rollup.revenue_usage_total_usd += econ.revenue_usage_total_usd || 0;
              rollup.cost_usd += econ.cost_usd || 0;
              rollup.revenue_annualized_usd += econ.revenue_annualized_usd || 0;
              rollup.cost_annualized_usd += econ.cost_annualized_usd || 0;
              rollup.revenue_12mo_churn_adjusted_usd += econ.revenue_12mo_churn_adjusted_usd || 0;
              rollup.cost_12mo_churn_adjusted_usd += econ.cost_12mo_churn_adjusted_usd || 0;
              rollup.revenue_commit_floor_annualized_usd += econ.revenue_commit_floor_annualized_usd || 0;
              rollup.revenue_commit_floor_12mo_churn_adjusted_usd += econ.revenue_commit_floor_12mo_churn_adjusted_usd || 0;
            }
            const lens = segResult.result.output.lens_metrics;
            if (lens) {
              rollup.margin_floor_violations += lens.margin_floor_violations || 0;
              rollup.exploration_depth += lens.exploration_depth || 0;
            }
            if (segResult.result.output.risks) {
              segResult.result.output.risks.forEach((risk) => {
                rollup.risks.push(`[${segResult.segment}] ${risk}`);
              });
            }
          });

          const rollupMargin = rollup.revenue_usd === 0 
            ? null 
            : (rollup.revenue_usd - rollup.cost_usd) / Math.max(rollup.revenue_usd, 1e-9);

          return (
            <div className="space-y-4 border-t pt-4">
              <div className="text-sm font-semibold">Product Rollup Results</div>
              
              {/* Rollup Totals */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="text-sm font-medium">Rollup Totals</div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Revenue Billed (USD)</div>
                    <div>{rollup.revenue_usd.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Cost (USD)</div>
                    <div>{rollup.cost_usd.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Margin (Billed)</div>
                    <div>
                      {rollupMargin !== null
                        ? (rollupMargin * 100).toFixed(1) + "%"
                        : "—"}
                    </div>
                  </div>
                </div>
                {rollup.revenue_commit_floor_usd_total > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm mt-2 pt-2 border-t">
                      <div>
                        <div className="text-muted-foreground">Commit Floor Revenue (USD)</div>
                        <div>{rollup.revenue_commit_floor_usd_total.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Usage Total Revenue (USD)</div>
                        <div>{rollup.revenue_usage_total_usd.toFixed(2)}</div>
                      </div>
                    </div>
                    {(() => {
                      const rollupCommitFloorMargin = rollup.revenue_commit_floor_usd_total > 0
                        ? (rollup.revenue_commit_floor_usd_total - rollup.cost_usd) / Math.max(rollup.revenue_commit_floor_usd_total, 1e-9)
                        : null;
                      return (
                        <div className="grid grid-cols-3 gap-4 text-sm mt-2 pt-2 border-t">
                          <div>
                            <div className="text-muted-foreground">Margin (Commit Floor)</div>
                            <div>
                              {rollupCommitFloorMargin !== null
                                ? (rollupCommitFloorMargin * 100).toFixed(1) + "%"
                                : "—"}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Revenue Annualized (USD)</div>
                    <div>{rollup.revenue_annualized_usd.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Cost Annualized (USD)</div>
                    <div>{rollup.cost_annualized_usd.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Revenue 12mo Churn-Adjusted (USD)</div>
                    <div>{rollup.revenue_12mo_churn_adjusted_usd.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Cost 12mo Churn-Adjusted (USD)</div>
                    <div>{rollup.cost_12mo_churn_adjusted_usd.toFixed(2)}</div>
                  </div>
                </div>
                {rollup.assumptions && (
                  <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                    <div>Churn Assumptions: {rollup.assumptions.annual_churn_rate ? (rollup.assumptions.annual_churn_rate * 100).toFixed(1) + "% annual" : "—"}</div>
                    <div>Horizon: {rollup.assumptions.churn_horizon_months || 12} months</div>
                  </div>
                )}
              </div>

              {/* Per-Segment Results Table */}
              <div>
                <div className="text-sm font-medium mb-2">Per-Segment Results</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Segment</th>
                        <th className="text-right p-2">Revenue</th>
                        <th className="text-right p-2">Cost</th>
                        <th className="text-right p-2">Margin</th>
                        <th className="text-right p-2">Violations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segmentResults.map((segResult, idx) => {
                        const econ = segResult.result.output.economics_summary;
                        return (
                          <tr key={idx} className="border-b">
                            <td className="p-2">{segResult.segment}</td>
                            <td className="text-right p-2">{econ?.revenue_usd?.toFixed(2) || "—"}</td>
                            <td className="text-right p-2">{econ?.cost_usd?.toFixed(2) || "—"}</td>
                            <td className="text-right p-2">
                              {econ?.margin !== undefined && econ.margin !== null
                                ? (econ.margin * 100).toFixed(2) + "%"
                                : "—"}
                            </td>
                            <td className="text-right p-2">
                              {segResult.result.output.lens_metrics?.margin_floor_violations || 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rollup Risks */}
              {rollup.risks.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Risks</div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {rollup.risks.map((risk, idx) => (
                      <li key={idx}>{risk}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })()}

        {/* Simulation Results (Single Segment) */}
        {simulationMode === "single" && simulationResult && (
          <div className="space-y-4 border-t pt-4">
            <div>
              <div className="text-sm font-medium">Simulation Run ID</div>
              <div className="font-mono text-sm">{simulationResult.simulation_run_id}</div>
            </div>

            {/* Economics Summary */}
            {simulationResult.output.economics_summary && (
              <div>
                <div className="text-sm font-medium mb-2">Economics Summary</div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Revenue Billed (USD)</div>
                    <div>
                      {simulationResult.output.economics_summary.revenue_billed_usd?.toFixed(2) ?? 
                       simulationResult.output.economics_summary.revenue_usd?.toFixed(2) ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Cost (USD)</div>
                    <div>
                      {simulationResult.output.economics_summary.cost_usd?.toFixed(2) ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Margin</div>
                    <div>
                      {simulationResult.output.economics_summary.margin !== undefined &&
                       simulationResult.output.economics_summary.margin !== null
                        ? (simulationResult.output.economics_summary.margin * 100).toFixed(2) + "%"
                        : "—"}
                    </div>
                  </div>
                </div>
                {(simulationResult.output.economics_summary.revenue_commit_floor_usd_total !== undefined &&
                  simulationResult.output.economics_summary.revenue_commit_floor_usd_total > 0) && (
                  <div className="grid grid-cols-2 gap-4 text-sm mt-2 pt-2 border-t">
                    <div>
                      <div className="text-muted-foreground">Commit Floor Revenue (USD)</div>
                      <div>
                        {simulationResult.output.economics_summary.revenue_commit_floor_usd_total.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Usage Total Revenue (USD)</div>
                      <div>
                        {simulationResult.output.economics_summary.revenue_usage_total_usd?.toFixed(2) ?? "—"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Lens Metrics */}
            {simulationResult.output.lens_metrics && (
              <div>
                <div className="text-sm font-medium mb-2">Lens Metrics</div>
                <div className="space-y-1 text-sm">
                  {simulationResult.output.lens_metrics.exploration_depth !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Exploration Depth: </span>
                      {simulationResult.output.lens_metrics.exploration_depth}
                    </div>
                  )}
                  {simulationResult.output.lens_metrics.margin_floor_violations !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Margin Floor Violations: </span>
                      {simulationResult.output.lens_metrics.margin_floor_violations}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Risks */}
            {simulationResult.output.risks && simulationResult.output.risks.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Risks</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {simulationResult.output.risks.map((risk, idx) => (
                    <li key={idx}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pool Breakdown */}
            {simulationResult.output.pool_breakdown && simulationResult.output.pool_breakdown.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Pool Breakdown</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Pool ID</th>
                        <th className="text-right p-2">Billed Revenue</th>
                        <th className="text-right p-2">Commit Floor</th>
                        <th className="text-right p-2">Usage Total</th>
                        <th className="text-right p-2">Cost</th>
                        <th className="text-left p-2">Pricing Mode</th>
                        <th className="text-left p-2">Commit Semantics</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulationResult.output.pool_breakdown.map((pool: any, idx: number) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{pool.pool_id}</td>
                          <td className="text-right p-2">
                            {(pool.revenue_billed_usd ?? pool.revenue_usd ?? 0).toFixed(2)}
                          </td>
                          <td className="text-right p-2">
                            {(pool.revenue_commit_floor_usd ?? 0).toFixed(2)}
                          </td>
                          <td className="text-right p-2">
                            {(pool.revenue_usage_total_usd ?? 0).toFixed(2)}
                          </td>
                          <td className="text-right p-2">
                            {(pool.cost_usd ?? 0).toFixed(2)}
                          </td>
                          <td className="p-2 text-xs">{pool.pricing_mode_used || "—"}</td>
                          <td className="p-2 text-xs">{pool.commit_semantics_used || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Blocking Issues */}
            {simulationResult.output.blocking_issues &&
              simulationResult.output.blocking_issues.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Blocking Issues</div>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                    {simulationResult.output.blocking_issues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Approval */}
      <div className="rounded-lg border p-4 space-y-4">
        <h2 className="font-semibold">Approval</h2>
        
        <div className="space-y-4">
          {/* Approver Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Approver Name
            </label>
            <input
              type="text"
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={approvalRunning}
            />
          </div>

          {/* Approver Role */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Approver Role
            </label>
            <input
              type="text"
              value={approverRole}
              onChange={(e) => setApproverRole(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={approvalRunning}
            />
          </div>

          {/* Rationale */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Rationale <span className="text-red-600">*</span>
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
              disabled={approvalRunning}
              required
            />
          </div>

          {/* Effective At */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Effective At (optional)
            </label>
            <input
              type="datetime-local"
              value={effectiveAt}
              onChange={(e) => setEffectiveAt(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={approvalRunning}
            />
            <div className="text-xs text-muted-foreground mt-1">
              Leave blank to use current time
            </div>
          </div>

          {/* Approve Button */}
          <button
            onClick={handleApprove}
            disabled={
              approvalRunning ||
              !rationale.trim() ||
              !simulationResult?.simulation_run_id
            }
            className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {approvalRunning ? "Approving..." : "Approve + Activate"}
          </button>

          {!simulationResult?.simulation_run_id && (
            <div className="text-sm text-muted-foreground">
              Run a simulation first before approving
            </div>
          )}
        </div>

        {/* Approval Error */}
        {approvalError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="font-medium">Error</div>
            <div className="mt-1">{approvalError}</div>
          </div>
        )}
      </div>
    </div>
  );
}

