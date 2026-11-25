import React, { useState } from 'react';
import { ArrowRight, Lock, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useErp } from '../context/ErpContext';

export const AuthScreen: React.FC = () => {
  const { loginWithGoogle, theme, toggleTheme } = useErp();
  const [signingIn, setSigningIn] = useState(false);

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      await loginWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9F8] dark:bg-[#08100D] flex flex-col">
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#064E3B] text-[#E6C983] font-display font-bold text-sm flex items-center justify-center tracking-tight">
            AM
          </div>
          <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            AM PIXEL STUDIO
          </span>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle color theme"
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#13231D] transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="h-[2px] w-12 bg-[#B89146]" />
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.15] [text-wrap:balance]">
              Business Management &amp; Accounting ERP for AM PIXEL STUDIO
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              Manage creative clients, projects, quotations, non-GST commercial invoices,
              payment receipts, multi-currency settlements, expenses, and live INR financial
              reports from one secure ledger.
            </p>

            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-slate-200 dark:border-emerald-950">
              <div>
                <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Real Ledger Accounting
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Payments sync invoice balances atomically with zero fabricated figures.
                </p>
              </div>
              <div>
                <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Multi-Currency Forex
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Track INR, USD, AED, SAR, GBP &amp; EUR with explicit manual exchange rates.
                </p>
              </div>
              <div>
                <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  PDF &amp; Excel Ready
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Export non-GST commercial invoices, studio receipts, and accounting reports.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-2xl p-8 shadow-sm">
              <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-emerald-950/70">
                <div className="w-10 h-10 rounded-xl bg-[#064E3B]/10 dark:bg-[#064E3B]/40 text-[#064E3B] dark:text-[#E6C983] flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                    Administrator Sign In
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Protected by Firebase Auth &amp; Firestore Rules
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <button
                  type="button"
                  disabled={signingIn}
                  onClick={handleLogin}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3 text-sm font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                >
                  <span>{signingIn ? 'Signing in...' : 'Continue with Google'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-2.5 text-xs text-slate-500 dark:text-slate-400 pt-2">
                  <ShieldCheck className="w-4 h-4 text-[#064E3B] dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Your studio records are stored privately in Cloud Firestore under your
                    verified Google account. Data persists automatically across sessions and
                    devices.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-6 py-5 border-t border-slate-200/80 dark:border-emerald-950/60 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span>AM PIXEL STUDIO · Kerala, India · Contact: 9400527450</span>
        <a
          href="https://www.instagram.com/_am_pixel_studio/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[#064E3B] dark:hover:text-emerald-400 transition-colors"
        >
          @_am_pixel_studio
        </a>
      </footer>
    </div>
  );
};
