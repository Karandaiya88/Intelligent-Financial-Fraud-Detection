import { clearToken, getToken } from "./auth";
import type {
  BulkResult, DashboardSummary, Dataset, ModelRun, Prediction, PredictionPage, ReportItem, RiskPolicy, TrainResponse,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;
  constructor(status: number, code: string, message: string, details?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface Options {
  method?: string;
  json?: unknown;
  form?: FormData;
  params?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean;
}

function buildUrl(path: string, params?: Options["params"]): string {
  const url = new URL(path, API_URL);
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    if (body?.error) return new ApiError(res.status, body.error.code, body.error.message, body.error.details);
    if (Array.isArray(body?.detail)) {
      const msg = body.detail.map((d: any) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg}`).join("; ");
      return new ApiError(res.status, "VALIDATION_ERROR", msg);
    }
  } catch {
    /* fall through */
  }
  return new ApiError(res.status, "HTTP_ERROR", `Request failed (${res.status}).`);
}

async function send(path: string, opts: Options = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.auth !== false) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  if (opts.json !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.params), {
      method: opts.method ?? (opts.json !== undefined || opts.form ? "POST" : "GET"),
      headers,
      body: opts.form ?? (opts.json !== undefined ? JSON.stringify(opts.json) : undefined),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", `Cannot reach the API at ${API_URL}. Is the backend running?`);
  }
  if (!res.ok) {
    const err = await parseError(res);
    if (res.status === 401 && opts.auth !== false && typeof window !== "undefined") {
      clearToken();
      if (!window.location.pathname.startsWith("/login")) window.location.assign("/login");
    }
    throw err;
  }
  return res;
}

async function request<T>(path: string, opts: Options = {}): Promise<T> {
  return (await send(path, opts)).json() as Promise<T>;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string }>("/api/auth/login", { json: { username, password }, auth: false }),
  logout: () => request<{ status: string }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ username: string; email: string | null }>("/api/auth/me"),

  dashboard: () => request<DashboardSummary>("/api/dashboard/summary"),

  datasets: () => request<Dataset[]>("/api/datasets"),
  dataset: (id: number) => request<Dataset>(`/api/datasets/${id}`),
  uploadDataset: (file: File, target: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("target_column", target);
    return request<Dataset>("/api/datasets/upload", { form });
  },

  models: () => request<ModelRun[]>("/api/models"),
  train: (body: {
    dataset_id: number; models: string[]; random_seed: number; test_size: number; val_size: number;
    threshold_strategy: string; min_precision?: number | null;
  }) => request<TrainResponse>("/api/models/train", { json: body }),
  setPolicy: (id: number, policy: RiskPolicy) =>
    request<{ model_run_id: number; risk_policy: RiskPolicy }>(`/api/models/${id}/policy`, { method: "PUT", json: policy }),

  predict: (model_run_id: number, features: Record<string, number | null>, transaction_reference?: string) =>
    request<Prediction>("/api/fraud/predict", { json: { model_run_id, features, transaction_reference: transaction_reference || null } }),
  bulkPredict: (model_run_id: number, file: File) => {
    const form = new FormData();
    form.append("model_run_id", String(model_run_id));
    form.append("file", file);
    return request<BulkResult>("/api/fraud/bulk-predict", { form });
  },
  predictions: (params: Record<string, string | number | boolean | undefined | null>) =>
    request<PredictionPage>("/api/fraud/predictions", { params }),
  prediction: (id: number) => request<Prediction>(`/api/fraud/predictions/${id}`),

  reports: () => request<ReportItem[]>("/api/reports"),
  generateReport: (body: { report_type: string; format: string; model_run_id?: number | null }) =>
    request<ReportItem>("/api/reports/generate", { json: body }),
  downloadReport: async (item: ReportItem) => {
    const res = await send(item.download_url);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
