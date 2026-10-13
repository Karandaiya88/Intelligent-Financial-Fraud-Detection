"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/datasets", label: "Datasets", icon: "🗂" },
  { href: "/models", label: "Model Lab", icon: "🧪" },
  { href: "/transactions", label: "Transactions", icon: "🔎" },
  { href: "/predict", label: "Single Prediction", icon: "🎯" },
  { href: "/reports", label: "Reports", icon: "📄" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<string>("");

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    setReady(true);
    api.me().then((m) => setUser(m.username)).catch(() => { /* 401 handled in api client */ });
  }, [router]);

  async function logout() {
    try { await api.logout(); } catch { /* token may already be invalid */ }
    clearToken();
    router.replace("/login");
  }

  if (!ready) return <div className="p-8 text-sm text-slate-500">Checking session…</div>;

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3 lg:block lg:py-5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-white" aria-hidden>🛡</span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-900">Fraud Detection</p>
              <p className="text-[11px] text-slate-500">Analyst workspace</p>
            </div>
          </div>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {NAV.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}>
                <span aria-hidden>{n.icon}</span>{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-slate-200 p-4 lg:absolute lg:bottom-0 lg:left-0 lg:right-0 lg:block">
          <p className="truncate text-xs text-slate-500">Signed in as <span className="font-semibold text-slate-700">{user || "…"}</span></p>
          <button onClick={logout} className="btn-secondary mt-2 w-full">Log out</button>
        </div>
      </aside>
      <main className="flex-1 lg:ml-60">
        <div className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
          <span className="text-xs text-slate-500">{user}</span>
          <button onClick={logout} className="btn-secondary !py-1">Log out</button>
        </div>
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
