"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ConfigListItem = {
  config_version_id: string;
  workspace_id: string;
  segment: string;
  stage: string;
  target_environment: string;
  status: string;
  version: number;
  effective_at: string;
  updated_at: string;
};

type ConfigListResponse = {
  items: ConfigListItem[];
};

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ConfigsClient() {
  const [data, setData] = useState<ConfigListResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch("/api/configs", { cache: "no-store" });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? `Request failed: ${res.status}`);
        }
        const json = (await res.json()) as ConfigListResponse;
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
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Configs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configuration versions and their subject resolutions.
        </p>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">Loading…</div>
      )}

      {err && (
        <div className="text-sm text-red-600">
          Error loading configs: {err}
        </div>
      )}

      {!loading && !err && data && (
        <div className="rounded-lg border overflow-hidden">
          <div className="px-4 py-2 text-sm text-muted-foreground border-b">
            Total: {data.items.length}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-4 py-3">Config ID</th>
                  <th className="px-4 py-3">Subject Resolution</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Effective At</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => {
                  const subjectLabel = `${c.segment} · ${c.stage} · ${c.target_environment}`;

                  return (
                    <tr key={c.config_version_id} className="border-t">
                      <td className="px-4 py-3">
                        <Link
                          className="underline underline-offset-2"
                          href={`/configs/${c.config_version_id}/review`}
                        >
                          {c.config_version_id}
                        </Link>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium">{subjectLabel}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          ws: {c.workspace_id}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="rounded-md border px-2 py-0.5">
                          {c.status}
                        </span>
                      </td>

                      <td className="px-4 py-3">{c.version}</td>
                      <td className="px-4 py-3">{fmt(c.effective_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

