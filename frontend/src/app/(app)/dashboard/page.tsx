"use client";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { int, pct } from "@/lib/format";
import { MODEL_LABELS } from "@/lib/format";
import { ClassBalanceChart, ModelComparisonChart, RiskDistributionChart } from "@/components/charts";
import { Card, Disclaimer, EmptyState, ErrorBanner, MetricCard, PageHeader, Spinner } from "@/components/ui";

export default function DashboardPage() {
  const { data, error, loading, reload } = useAsync(() => api.dashboard(), []);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Dataset summary, scored transactions, predicted-risk distribution and model metrics."
        actions={<button className="btn-secondary" onClick={reload} disabled={loading}>Refresh</button>}
      />
      <ErrorBanner error={error} />
      {loading && !data && <Spinner />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Datasets" value={int(data.datasets)} />
            <MetricCard label="Model runs" value={int(data.model_runs)} />
            <MetricCard label="Transactions scored" value={int(data.transactions_scored)} />
            <MetricCard label="High risk" value={int(data.risk_distribution.HIGH)} tone="danger" hint="Route to analyst review" />
            <MetricCard label="Unusual patterns" value={int(data.anomalies)} tone="warning" hint="Anomaly signal, not fraud" />
            <MetricCard
              label="Best model"
              value={data.model_status.best_model ? (MODEL_LABELS[data.model_status.best_model] ?? data.model_status.best_model) : "Not trained"}
              hint={data.model_status.trained ? "Selected on validation PR-AUC" : undefined}
            />
          </div>

          {!data.latest_dataset && (
            <EmptyState
              title="No dataset yet"
              description="Upload a transaction dataset to inspect it, train models and score transactions."
              action={<Link className="btn-primary" href="/datasets">Upload a dataset</Link>}
            />
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Predicted risk distribution" subtitle="LOW / MEDIUM / HIGH are configurable application categories, not financial standards.">
              {data.transactions_scored > 0 ? (
                <RiskDistributionChart dist={data.risk_distribution} />
              ) : (
                <p className="py-10 text-center text-sm text-slate-500">No transactions scored yet. Use <Link className="font-semibold text-brand-700 underline" href="/transactions">Transactions</Link> or <Link className="font-semibold text-brand-700 underline" href="/predict">Single Prediction</Link>.</p>
              )}
            </Card>

            <Card title="Latest dataset: class balance" subtitle={data.latest_dataset ? `${data.latest_dataset.filename} · ${int(data.latest_dataset.row_count)} rows · fraud rate ${pct(data.latest_dataset.fraud_rate, 3)}` : undefined}>
              {data.latest_dataset ? (
                <>
                  <ClassBalanceChart balance={data.latest_dataset.class_balance} />
                  <p className="mt-2 text-xs text-slate-500">Logarithmic scale. A model predicting “non-fraud” for everything would still look highly accurate, so accuracy alone is never used here.</p>
                </>
              ) : <p className="py-10 text-center text-sm text-slate-500">No dataset uploaded.</p>}
            </Card>
          </div>

          <Card title="Model comparison (test set)" subtitle="Metrics suited to imbalanced data. Threshold chosen on validation data; test set used once.">
            {data.model_metrics.length > 0 ? (
              <ModelComparisonChart rows={data.model_metrics} />
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">No models trained yet. Open <Link className="font-semibold text-brand-700 underline" href="/models">Model Lab</Link> to train and compare models.</p>
            )}
          </Card>

          <Disclaimer>{data.disclaimer}</Disclaimer>
        </div>
      )}
    </>
  );
}
