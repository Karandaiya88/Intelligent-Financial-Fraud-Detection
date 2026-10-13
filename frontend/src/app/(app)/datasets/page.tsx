"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAsync, usePersistentState } from "@/lib/hooks";
import { dateTime, int, pct } from "@/lib/format";
import { ClassBalanceChart } from "@/components/charts";
import { UploadDropzone } from "@/components/UploadDropzone";
import { Card, EmptyState, ErrorBanner, MetricCard, PageHeader, Spinner } from "@/components/ui";

export default function DatasetsPage() {
  const list = useAsync(() => api.datasets(), []);
  const [selected, setSelected] = usePersistentState<number | null>("fraud_selected_dataset", null);
  const [target, setTarget] = useState("Class");
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<Error | null>(null);

  const activeId = selected ?? list.data?.[0]?.id ?? null;
  const detail = useAsync(() => (activeId ? api.dataset(activeId) : Promise.resolve(null)), [activeId]);

  async function upload(file: File) {
    setBusy(true);
    setUploadError(null);
    try {
      const ds = await api.uploadDataset(file, target.trim() || "Class");
      await list.reload();
      setSelected(ds.id);
    } catch (e) {
      setUploadError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  const ds = detail.data;
  const ins = ds?.inspection;
  const missing = ins ? Object.entries(ins.missing_values) : [];
  const preview = ins?.preview ?? [];

  return (
    <>
      <PageHeader
        title="Dataset Management"
        description="Upload a CSV/Excel dataset, validate its schema and inspect row counts, missing values, duplicates and class balance."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card title="Upload dataset" subtitle="Required columns: Time, V1–V28, Amount and the target column (0 = non-fraud, 1 = fraud).">
          <div className="mb-3">
            <label htmlFor="target" className="label">Target column</label>
            <input id="target" className="input" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <ErrorBanner error={uploadError} />
          <UploadDropzone onFile={upload} busy={busy} hint="CSV or Excel (.xlsx). The server enforces the size limit." />
        </Card>

        <Card title="Uploaded datasets">
          <ErrorBanner error={list.error} />
          {list.loading && !list.data && <Spinner />}
          {list.data && list.data.length === 0 && <EmptyState title="No datasets yet" description="Upload your first dataset on the left." />}
          {list.data && list.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-200"><th className="th">ID</th><th className="th">File</th><th className="th">Rows</th><th className="th">Fraud rate</th><th className="th">Uploaded</th></tr></thead>
                <tbody>
                  {list.data.map((d) => (
                    <tr key={d.id} onClick={() => setSelected(d.id)} className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${d.id === activeId ? "bg-brand-50" : ""}`}>
                      <td className="td font-semibold">#{d.id}</td>
                      <td className="td">{d.filename}</td>
                      <td className="td tabular-nums">{int(d.row_count)}</td>
                      <td className="td tabular-nums">{pct(d.inspection.fraud_rate, 3)}</td>
                      <td className="td">{dateTime(d.uploaded_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {activeId && (
        <div className="mt-6 space-y-6">
          <ErrorBanner error={detail.error} />
          {detail.loading && !ds && <Spinner />}
          {ds && ins && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-900">Dataset #{ds.id}: {ds.filename}</h2>
                <Link href="/models" className="btn-primary" onClick={() => setSelected(ds.id)}>Train models on this dataset →</Link>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <MetricCard label="Rows" value={int(ds.row_count)} />
                <MetricCard label="Columns" value={int(ins.column_count)} />
                <MetricCard label="Duplicate rows" value={int(ins.duplicates)} tone={ins.duplicates > 0 ? "warning" : "default"} />
                <MetricCard label="Columns with missing values" value={int(missing.length)} tone={missing.length > 0 ? "warning" : "good"} />
                <MetricCard label="Fraud rate" value={pct(ins.fraud_rate, 3)} hint={`${int(ins.class_balance["1"] ?? 0)} fraud rows`} tone="danger" />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Class balance" subtitle="Severely imbalanced data: accuracy alone is misleading. Evaluation uses precision, recall, F1, PR-AUC and ROC-AUC.">
                  <ClassBalanceChart balance={ins.class_balance} />
                  <p className="mt-2 text-xs text-slate-500">Logarithmic scale. Fingerprint: <code>{ds.fingerprint.slice(0, 12)}</code></p>
                </Card>
                <Card title="Missing values">
                  {missing.length === 0 ? <p className="text-sm text-emerald-700">No missing values found.</p> : (
                    <ul className="space-y-1 text-sm">{missing.map(([c, n]) => <li key={c}><span className="font-semibold">{c}</span>: {int(n)}</li>)}</ul>
                  )}
                  <p className="mt-3 text-xs text-slate-500">Missing values are imputed with the training median inside the model pipeline.</p>
                </Card>
              </div>

              <Card title="Preview" subtitle="First rows of the uploaded data.">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b border-slate-200">{preview[0] && Object.keys(preview[0]).map((k) => <th key={k} className="th">{k}</th>)}</tr></thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          {Object.values(row).map((v, j) => <td key={j} className="td tabular-nums">{v === null ? "–" : typeof v === "number" ? Number(v.toPrecision(5)) : v}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Schema">
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">Show {Object.keys(ds.column_schema).length} columns and types</summary>
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                    {Object.entries(ds.column_schema).map(([c, t]) => <div key={c}><span className="font-medium">{c}</span> <span className="text-slate-400">{t}</span></div>)}
                  </div>
                </details>
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}
