"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken, setToken } from "@/lib/auth";
import { ErrorBanner, Spinner } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (getToken()) router.replace("/dashboard"); }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.login(username.trim(), password);
      setToken(res.access_token);
      router.replace("/dashboard");
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-900 to-brand-900 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-brand-700 text-2xl text-white" aria-hidden>🛡</div>
          <h1 className="text-xl font-bold text-slate-900">Fraud Detection Platform</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to the analyst workspace</p>
        </div>
        <ErrorBanner error={error} />
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="username" className="label">Username</label>
            <input id="username" className="input" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input id="password" type="password" className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy || !username || !password}>
            {busy ? <Spinner label="Signing in…" /> : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">Academic decision-support prototype. Not connected to any bank or payment system.</p>
      </div>
    </main>
  );
}
