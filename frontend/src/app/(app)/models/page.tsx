"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DEFAULT_PREFS, useAsync, usePersistentState, usePrefs } from "@/lib/hooks";
import { MODEL_LABELS, MODEL_ROLES, dateTime, int, num } from "@/lib/format";
import type { ModelName, ModelRun } from "@/lib/types";
import { ModelComparisonChart } from "@/components/charts";
import { ConfusionMatrix } from "@/components/ConfusionMatrix";
import { BestBadge, Card, Disclaimer, EmptyState, ErrorBanner, PageHeader, Spinner } from "@/components/ui";

const ALL: ModelName[] = ["logistic_regression", "decision_tree", "random_forest", "svm", "naive_bayes"];

export default function ModelLabPage() {
  const datasets = useAsync(() => api.datasets(), []);
  const runs = useAsync(() => api.models(), []);
  const [prefs] = usePrefs();
  const [form, setForm] = useState(DEFAULT_PREFS);
  const [datasetId, setDatasetId] = usePersistentState<number | null>("fraud_selected_dataset", null);
  const [chosen, setChosen] = useState<ModelName[]>(ALL);
  const [busy, setBusy] = useState(false);
  const [trainError, setTrainError] = useState<Error | null>(null);
  const [batchKey, setBatchKey] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [view, setView] = useState<"test" | "validation">("test");

  useEffect(() => { setForm(prefs); }, [JSON.stringify(prefs)]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeDataset = datasetId ?? datasets.data?.[0]?.id ?? null;

  const batches = useMemo(() => {
    const map = new Map<string, ModelRun[]>();
    (runs.data ?? []).forEach((r) => {
      const k = String(r.config.batch ?? r.model_version);
      map.set(k, [...(map.get(k) ?? []), r]);
    });
    return Array.from(map.entries()).map(([key, items]) => ({ key, items: [...items].sort((a, b) => a.model_run_id - b.model_run_id) }));
  }, [runs.data]);

  const activeBatch = batches.find((b) => b.key === batchKey) ?? batches[0];
  const focus = activeBatch?.items.find((r) => r.model_run_id === focusId) ?? activeBatch?.items.find((r) => r.is_best) ?? activeBatch?.items[0];

  const sizeError = form.testSize + form.valSize >= 0.9 ? "Test size + validation size must be below 0.9." : null;
  const canTrain = !busy && !!activeDataset && chosen.length > 0 && !sizeError;

  function toggle(m: ModelName) {
    setChosen((c) => (c.includes(m) ? c.filter((x) => x !== m) : [...c, m]));
  }

  async function train() {
    if (!activeDataset) return;
    setBusy(true);
    setTrainError(null);
    try {
      const res = await api.train({
        dataset_id: activeDataset, models: chosen, random_seed: form.seed, test_size: form.testSize, val_size: form.valSize,
        threshold_strategy: form.strategy, min_precision: form.strategy === "min_precision" ? form.minPrecision : null,
      });
      await runs.reload();
      setBatchKey(String(res.runs[0]?.config.batch ?? ""));
      setFocusId(res.best_model_run_id);
    } catch (e) {
      setTrainError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  const rows = activeBatch?.items ?? [];
  const m = (r: ModelRun) => r.metrics[view];

  return (
    <>
      <PageHeader title="Model Lab" description="Train supported classifiers with a reproducible, leakage-safe pipeline, then compare them on metrics that suit highly imbalanced data." />

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card title="Train models">
          <ErrorBanner error={trainError} />
          {datasets.data && datasets.data.length === 0 ? (
            <EmptyState title="Upload a dataset first" description="Model training needs a validated dataset." />
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="ds" className="label">Dataset</label>
                <select id="ds" className="input" value={activeDataset ?? ""} onChange={(e) => setDatasetId(Number(e.target.value))}>
                  {(datasets.data ?? []).map((d) => <option key={d.id} value={d.id}>#{d.id} · {d.filename} · {int(d.row_count)} rows</option>)}
                </select>
              </div>

              <fieldset>
                <legend className="label">Models</legend>
                <div className="space-y-2">
                  {ALL.map((mn) => (
                    <label key={mn} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
                      <input type="checkbox" className="mt-1" checked={chosen.includes(mn)} onChange={() => toggle(mn)} />
                      <span><span className="text-sm font-semibold">{MODEL_LABELS[mn]}</span><span className="block text-xs text-slate-500">{MODEL_ROLES[mn]}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-3 gap-3">
                <div><label htmlFor="seed" className="label">Random seed</label><input id="seed" type="number" className="input" value={form.seed} onChange={(e) => setForm({ ...form, seed: Number(e.target.value) })} /></div>
                <div><label htmlFor="ts" className="label">Test size</label><input id="ts" type="number" step="0.05" min="0.05" max="0.45" className="input" value={form.testSize} onChange={(e) => setForm({ ...form, testSize: Number(e.target.value) })} /></div>
                <div><label htmlFor="vs" className="label">Validation size</label><input id="vs" type="number" step="0.05" min="0.05" max="0.45" className="input" value={form.valSize} onChange={(e) => setForm({ ...form, valSize: Number(e.target.value) })} /></div>
              </div>
              {sizeError && <p className="text-sm text-red-600" role="alert">{sizeError}</p>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="strat" className="label">Threshold strategy</label>
                  <select id="strat" className="input" value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value as "max_f1" | "min_precision" })}>
                    <option value="max_f1">Maximise F1 (validation)</option>
                    <option value="min_precision">Highest recall at minimum precision</option>
                  </select>
                </div>
                {form.strategy === "min_precision" && (
                  <div><label htmlFor="mp" className="label">Minimum precision</label><input id="mp" type="number" step="0.05" min="0" max="1" className="input" value={form.minPrecision} onChange={(e) => setForm({ ...form, minPrecision: Number(e.target.value) })} /></div>
                )}
              </div>

              <button className="btn-primary w-full" disabled={!canTrain} onClick={train}>
                {busy ? <Spinner label="Training… this can take a while (SVM / Random Forest)" /> : "Train and compare"}
              </button>
              <p className="text-xs text-slate-500">Preprocessing (median imputation + scaling) is fitted on training data only. The test set is evaluated once, after the threshold is chosen on validation data. The SVM trains on a documented stratified sample for speed.</p>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <ErrorBanner error={runs.error} />
          {runs.loading && !runs.data && <Spinner />}
          {runs.data && batches.length === 0 && <EmptyState title="No models trained yet" description="Choose models on the left and click “Train and compare”." />}
          {activeBatch && (
            <>
              <Card
                title="Model comparison"
                subtitle={view === "test" ? "Test-set metrics (used once, after tuning)." : "Validation-set metrics (used for tuning and model selection)."}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <select aria-label="Training batch" className="input !w-auto" value={activeBatch.key} onChange={(e) => { setBatchKey(e.target.value); setFocusId(null); }}>
                      {batches.map((b) => <option key={b.key} value={b.key}>Batch · {dateTime(b.items[0].created_at)} · {b.items.length} models</option>)}
                    </select>
                    <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-sm" role="group" aria-label="Metric set">
                      {(["test", "validation"] as const).map((v) => (
                        <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`px-3 py-1.5 ${view === v ? "bg-brand-700 text-white" : "bg-white text-slate-600"}`}>{v === "test" ? "Test" : "Validation"}</button>
                      ))}
                    </div>
                  </div>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="th">Model</th><th className="th">Precision</th><th className="th">Recall</th><th className="th">F1</th>
                        <th className="th">PR-AUC</th><th className="th">ROC-AUC</th><th className="th">Threshold</th><th className="th">FP</th><th className="th">FN</th><th className="th">Train (s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.model_run_id} onClick={() => setFocusId(r.model_run_id)}
                          className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${focus?.model_run_id === r.model_run_id ? "bg-brand-50" : ""}`}>
                          <td className="td font-semibold">{MODEL_LABELS[r.model_name]} {r.is_best && <BestBadge />}<span className="ml-1 text-xs font-normal text-slate-400">#{r.model_run_id}</span></td>
                          <td className="td tabular-nums">{num(m(r).precision)}</td><td className="td tabular-nums">{num(m(r).recall)}</td><td className="td tabular-nums">{num(m(r).f1)}</td>
                          <td className="td tabular-nums">{num(m(r).pr_auc)}</td><td className="td tabular-nums">{num(m(r).roc_auc)}</td><td className="td tabular-nums">{num(m(r).threshold)}</td>
                          <td className="td tabular-nums">{int(m(r).false_positives)}</td><td className="td tabular-nums">{int(m(r).false_negatives)}</td><td className="td tabular-nums">{num(r.metrics.train_seconds, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Best model is chosen on validation PR-AUC, never on the test set. FP = legitimate transactions flagged; FN = fraud missed. Weigh both against your review capacity.
                </p>
              </Card>

              <Card title="Metric chart">
                <ModelComparisonChart rows={rows.map((r) => ({ model: r.model_name, precision: m(r).precision, recall: m(r).recall, f1: m(r).f1, pr_auc: m(r).pr_auc }))} />
              </Card>

              {focus && (
                <Card title={`Confusion matrix: ${MODEL_LABELS[focus.model_name]} (#${focus.model_run_id})`} subtitle={`${view === "test" ? "Test" : "Validation"} set · decision threshold ${num(m(focus).threshold)}`}>
                  <div className="grid gap-6 md:grid-cols-2">
                    <ConfusionMatrix matrix={m(focus).confusion_matrix} />
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between"><dt className="text-slate-500">Class counts (non-fraud / fraud)</dt><dd className="font-semibold tabular-nums">{int(m(focus).class_counts["0"])} / {int(m(focus).class_counts["1"])}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Training rows used</dt><dd className="font-semibold tabular-nums">{int(focus.metrics.train_rows)}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Model version</dt><dd className="font-mono text-xs">{focus.model_version}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Random seed</dt><dd className="font-semibold">{String(focus.config.seed)}</dd></div>
                      {focus.config.note && <div className="pt-1 text-xs text-slate-500">Note: {String(focus.config.note)}</div>}
                    </dl>
                  </div>
                </Card>
              )}
              <Disclaimer />
            </>
          )}
        </div>
      </div>
    </>
  );
}
