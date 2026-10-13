"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Risk, Signal } from "@/lib/types";
import { MODEL_LABELS, int, num } from "@/lib/format";

const RISK_COLORS: Record<Risk, string> = { LOW: "#10b981", MEDIUM: "#f59e0b", HIGH: "#ef4444" };

export function RiskDistributionChart({ dist }: { dist: Record<Risk, number> }) {
  const data = (["LOW", "MEDIUM", "HIGH"] as Risk[]).map((k) => ({ name: k, count: dist[k] ?? 0 }));
  return (
    <div className="h-64" role="img" aria-label="Predicted risk distribution bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip formatter={(v) => int(Number(v))} />
          <Bar dataKey="count" name="Transactions" radius={[6, 6, 0, 0]}>
            {data.map((d) => <Cell key={d.name} fill={RISK_COLORS[d.name as Risk]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ModelComparisonChart({ rows }: {
  rows: { model: string; precision: number; recall: number; f1: number; pr_auc: number | null }[];
}) {
  const data = rows.map((r) => ({ name: MODEL_LABELS[r.model] ?? r.model, Precision: r.precision, Recall: r.recall, F1: r.f1, "PR-AUC": r.pr_auc ?? 0 }));
  return (
    <div className="h-72" role="img" aria-label="Model comparison grouped bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 1]} />
          <Tooltip formatter={(v) => num(Number(v))} />
          <Legend />
          <Bar dataKey="Precision" fill="#0d9488" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Recall" fill="#6366f1" radius={[3, 3, 0, 0]} />
          <Bar dataKey="F1" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          <Bar dataKey="PR-AUC" fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ClassBalanceChart({ balance }: { balance: Record<string, number> }) {
  const data = [
    { name: "Non-fraud (0)", count: balance["0"] ?? 0, fill: "#14b8a6" },
    { name: "Fraud (1)", count: balance["1"] ?? 0, fill: "#ef4444" },
  ];
  return (
    <div className="h-56" role="img" aria-label="Class balance bar chart on a logarithmic scale">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" />
          <YAxis scale="log" domain={[1, "auto"]} allowDataOverflow tickFormatter={(v) => int(Number(v))} />
          <Tooltip formatter={(v) => int(Number(v))} />
          <Bar dataKey="count" name="Rows" radius={[6, 6, 0, 0]}>
            {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SignalChart({ signals }: { signals: Signal[] }) {
  const data = signals.map((s) => ({ name: s.feature, value: s.contribution ?? s.z_score }));
  return (
    <div style={{ height: Math.max(140, data.length * 36) }} role="img" aria-label="Top feature signals bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" />
          <YAxis type="category" dataKey="name" width={56} />
          <Tooltip formatter={(v) => num(Number(v))} />
          <ReferenceLine x={0} stroke="#94a3b8" />
          <Bar dataKey="value" name="Signal" radius={3}>
            {data.map((d, i) => <Cell key={i} fill={d.value >= 0 ? "#ef4444" : "#0d9488"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
