"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { dateTime } from "@/lib/format";
import type { ReportItem } from "@/lib/types";
import { RunSelect } from "@/components/RunSelect";
import { Card, Disclaimer, EmptyState, ErrorBanner, PageHeader, Spinner } from "@/components/ui";

const TYPE_LABEL: Record<string, string> = { model_comparison: "Model comparison", predictions: "Transaction predictions" };

export default function ReportsPage() {
  const reports = useAsync(() => api.reports(), []);
  const runs = useAsync(() => api.models(), []);
  const [type, setType] = useState("model_comparison");
  const [format, setFormat] = useState("xlsx");
  const [runId, setRunId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const runList = runs.data ?? [];
  const effectiveRun = runId ?? (runList.find((r) => r.is_best) ?? runList[0])?.model_run_id ?? null;
  const needsRun = type === "predictions";
  const canGenerate = !busy && (type === "model_comparison" ? runList.length > 0 : !!effectiveRun);

  async function generate() {
    setBusy(true); setError(null);
    try {
      await api.generateReport({ report_type: type, format, model_run_id: needsRun ? effectiveRun : null });
      await reports.reload();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  async function download(item: ReportItem) {
    setDownloading(item.id); setError(null);
    try { await api.downloadReport(item); } catch (e) { setError(e as Error); } finally { setDownloading(null); }
  }

  return (
    <>
      <PageHeader title="Reports" description="Export model comparisons and transaction prediction summaries to CSV or Excel for academic review." />
      <ErrorBanner error={error} />
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card title="Generate report">
          <div className="space-y-4">
            <div><label htmlFor="rt" className="label">Report type</label>
              <select id="rt" className="input" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="model_comparison">Model comparison (latest training batch)</option>
                <option value="predictions">Transaction predictions (one model run)</option>
              </select></div>
            {needsRun && <RunSelect runs={runList} value={effectiveRun} onChange={setRunId} />}
            <div><label htmlFor="fmt" className="label">Format</label>
              <select id="fmt" className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="xlsx">Excel (.xlsx, includes a Notes sheet)</option><option value="csv">CSV</option>
              </select></div>
            {runs.data && runList.length === 0 && <p className="text-sm text-amber-700">Train a model first: reports are built from model runs.</p>}
            <button className="btn-primary w-full" disabled={!canGenerate} onClick={generate}>{busy ? <Spinner label="Generating…" /> : "Generate report"}</button>
          </div>
        </Card>

        <Card title="Generated reports">
          <ErrorBanner error={reports.error} />
          {reports.loading && !reports.data && <Spinner />}
          {reports.data && reports.data.length === 0 && <EmptyState title="No reports yet" description="Generate your first report on the left." />}
          {reports.data && reports.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-200"><th className="th">File</th><th className="th">Type</th><th className="th">Generated</th><th className="th" /></tr></thead>
                <tbody>
                  {reports.data.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="td font-medium">{r.filename}</td>
                      <td className="td">{TYPE_LABEL[r.report_type] ?? r.report_type}</td>
                      <td className="td">{dateTime(r.generated_at)}</td>
                      <td className="td text-right"><button className="btn-secondary !py-1" disabled={downloading === r.id} onClick={() => download(r)}>{downloading === r.id ? "Downloading…" : "Download"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      <div className="mt-6"><Disclaimer>Every report is decision-support output. Probabilities are model estimates, not proof of fraud.</Disclaimer></div>
    </>
  );
}
