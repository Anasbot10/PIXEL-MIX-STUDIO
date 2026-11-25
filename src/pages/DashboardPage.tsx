import React, { useMemo } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Plus,
  Receipt,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useErp } from '../context/ErpContext';
import {
  buildWhatsAppInvoiceUrl,
  formatDisplayDate,
  formatINR,
  getEffectiveInvoiceStatus,
  getMonthKey,
  getMonthLabel,
  roundMoney,
} from '../lib/format';
import { StatusText } from '../components/StatusText';

export const DashboardPage: React.FC = () => {
  const {
    metrics,
    invoices,
    payments,
    expenses,
    settings,
    dataLoading,
    setActivePage,
    openPaymentForInvoice,
    triggerQuickCreate,
    theme,
  } = useErp();

  // Build real 6-month chart series strictly from saved Firestore transactions
  const monthlySeries = useMemo(() => {
    const now = new Date();
    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthKeys.push(key);
    }

    return monthKeys.map((key) => {
      const billed = roundMoney(
        invoices
          .filter(
            (inv) =>
              inv.status !== 'Draft' &&
              inv.status !== 'Cancelled' &&
              getMonthKey(inv.issueDate) === key,
          )
          .reduce((sum, inv) => sum + (inv.grandTotalInr || 0), 0),
      );
      const received = roundMoney(
        payments
          .filter((p) => getMonthKey(p.paymentDate) === key)
          .reduce((sum, p) => sum + (p.netAmountReceivedInr || 0), 0),
      );
      const spent = roundMoney(
        expenses
          .filter((e) => getMonthKey(e.date) === key)
          .reduce((sum, e) => sum + (e.netAmountInr || 0), 0),
      );
      return {
        month: getMonthLabel(key),
        billed,
        received,
        expenses: spent,
      };
    });
  }, [invoices, payments, expenses]);

  // Pending / Overdue invoice alerts
  const pendingAlerts = useMemo(() => {
    return invoices
      .filter((inv) => {
        const eff = getEffectiveInvoiceStatus(inv);
        return (
          (eff === 'Overdue' || eff === 'Unpaid' || eff === 'Partially Paid') &&
          inv.balanceDueInr > 0.01
        );
      })
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      .slice(0, 6);
  }, [invoices]);

  // Recent unified transactions (payments + expenses)
  const recentTransactions = useMemo(() => {
    const items: Array<{
      id: string;
      kind: 'inflow' | 'outflow';
      date: string;
      title: string;
      subtitle: string;
      amountInr: number;
    }> = [
      ...payments.map((p) => ({
        id: `pay-${p.id}`,
        kind: 'inflow' as const,
        date: p.paymentDate,
        title: `${p.receiptNumber} · ${p.customerName}`,
        subtitle: `${p.paymentMethod} · ${p.invoiceNumber}`,
        amountInr: p.netAmountReceivedInr,
      })),
      ...expenses.map((e) => ({
        id: `exp-${e.id}`,
        kind: 'outflow' as const,
        date: e.date,
        title: e.description,
        subtitle: `${e.category}${e.vendor ? ` · ${e.vendor}` : ''}`,
        amountInr: e.netAmountInr,
      })),
    ];
    return items.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 7);
  }, [payments, expenses]);

  const recentInvoices = useMemo(() => invoices.slice(0, 6), [invoices]);

  const gridStroke = theme === 'dark' ? '#1A2E27' : '#E2E8F0';
  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#101C18' : '#FFFFFF',
    borderColor: theme === 'dark' ? '#1E352D' : '#E2E8F0',
    borderRadius: '8px',
    fontSize: '12px',
  };

  if (dataLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950"
            />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Studio Overview & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#B89146] dark:text-[#D4B068]">
            {settings.businessName} · Base Currency INR (₹) · Non-GST Commercial Ledger
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Financial &amp; Operations Overview
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => triggerQuickCreate('invoices')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Invoice
          </button>
          <button
            type="button"
            onClick={() => triggerQuickCreate('payments')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 hover:bg-slate-50 dark:hover:bg-[#152620] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-[#064E3B] dark:text-emerald-400" />
            Record Payment
          </button>
          <button
            type="button"
            onClick={() => triggerQuickCreate('quotations')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 hover:bg-slate-50 dark:hover:bg-[#152620] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#B89146]" />
            New Quotation
          </button>
          <button
            type="button"
            onClick={() => triggerQuickCreate('expenses')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 hover:bg-slate-50 dark:hover:bg-[#152620] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-500" />
            Add Expense
          </button>
          <button
            type="button"
            onClick={() => triggerQuickCreate('customers')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 hover:bg-slate-50 dark:hover:bg-[#152620] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            New Customer
          </button>
        </div>
      </div>

      {/* 8 KPI Stat Grid (Strictly Derived from Real Database Records) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Revenue (Billed)
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
            {formatINR(metrics.totalRevenueInr)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Excludes Draft &amp; Cancelled invoices
          </p>
        </div>

        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Payments Received
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#064E3B] dark:text-emerald-400 tabular-nums">
            {formatINR(metrics.totalPaymentsReceivedInr)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Net INR from {payments.length} recorded receipt{payments.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Pending Payments
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
            {formatINR(metrics.pendingPaymentsInr)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Across {metrics.outstandingInvoicesCount} outstanding invoice
            {metrics.outstandingInvoicesCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Expenses</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-red-600 dark:text-red-400 tabular-nums">
            {formatINR(metrics.totalExpensesInr)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            {expenses.length} logged expense record{expenses.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Net Cash Flow</p>
          <p
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              metrics.netCashFlowInr >= 0
                ? 'text-[#064E3B] dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatINR(metrics.netCashFlowInr)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Payments Received minus Expenses
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActivePage('invoices')}
          className="text-left bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 hover:border-[#064E3B]/50 dark:hover:border-emerald-700 rounded-xl p-5 transition-colors cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Outstanding Invoices
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
            {metrics.outstandingInvoicesCount}
          </p>
          <p className="mt-1.5 text-[11px] text-[#064E3B] dark:text-emerald-400">
            View invoice register →
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActivePage('customers')}
          className="text-left bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 hover:border-[#064E3B]/50 dark:hover:border-emerald-700 rounded-xl p-5 transition-colors cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Customers</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
            {metrics.totalCustomersCount}
          </p>
          <p className="mt-1.5 text-[11px] text-[#064E3B] dark:text-emerald-400">
            Open client CRM →
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActivePage('projects')}
          className="text-left bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 hover:border-[#064E3B]/50 dark:hover:border-emerald-700 rounded-xl p-5 transition-colors cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Projects</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
            {metrics.activeProjectsCount}
          </p>
          <p className="mt-1.5 text-[11px] text-[#064E3B] dark:text-emerald-400">
            Track creative work →
          </p>
        </button>
      </div>

      {/* Charts Row: Income vs Expense Comparison + Monthly Cash Flow & Expense Trend */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Income vs Expense Comparison (Last 6 Months)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Billed Revenue, Cash Received, and Expenses in INR
              </p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => formatINR(Number(value ?? 0))}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="billed" name="Billed Revenue" fill="#B89146" radius={[4, 4, 0, 0]} />
                <Bar dataKey="received" name="Cash Received" fill="#064E3B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-5 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-6">
          <div className="mb-5">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Monthly Revenue &amp; Expense Trend
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cash received trajectory against monthly operating spend
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#047857" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#047857" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => formatINR(Number(value ?? 0))}
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  name="Cash Received"
                  stroke="#047857"
                  strokeWidth={2}
                  fill="url(#emeraldGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#DC2626"
                  strokeWidth={2}
                  fill="url(#expenseGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pending Payment Alerts */}
      <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Pending Payment Alerts
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setActivePage('invoices')}
            className="text-xs font-medium text-[#064E3B] dark:text-emerald-400 hover:underline cursor-pointer"
          >
            All Invoices
          </button>
        </div>

        {pendingAlerts.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No pending or overdue invoices right now.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-emerald-950/70 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-6 font-medium">Invoice</th>
                  <th className="py-3 px-4 font-medium">Customer</th>
                  <th className="py-3 px-4 font-medium">Due Date</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Balance Due (INR)</th>
                  <th className="py-3 px-6 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-emerald-950/70">
                {pendingAlerts.map((inv) => {
                  const eff = getEffectiveInvoiceStatus(inv);
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#13221D]/60 transition-colors"
                    >
                      <td className="py-3 px-6 font-mono font-medium text-slate-900 dark:text-slate-100">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {inv.customerName}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {formatDisplayDate(inv.dueDate)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusText status={eff} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                        {formatINR(inv.balanceDueInr)}
                      </td>
                      <td className="py-3 px-6 text-right">
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openPaymentForInvoice(inv.id)}
                            className="font-semibold text-[#064E3B] dark:text-emerald-400 hover:underline whitespace-nowrap cursor-pointer"
                          >
                            Record Payment
                          </button>
                          <a
                            href={buildWhatsAppInvoiceUrl(
                              inv.customerPhone,
                              inv,
                              settings.businessName,
                              settings.upiId,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                          >
                            WhatsApp
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Split: Recent Invoices + Recent Transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Recent Invoices
            </h3>
            <button
              type="button"
              onClick={() => setActivePage('invoices')}
              className="text-xs font-medium text-[#064E3B] dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Manage
            </button>
          </div>

          {recentInvoices.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <FileText className="w-7 h-7 text-slate-300 dark:text-emerald-900 mx-auto" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No invoices issued yet. Create your first commercial invoice to begin tracking revenue.
              </p>
              <button
                type="button"
                onClick={() => triggerQuickCreate('invoices')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Invoice
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-emerald-950/70">
              {recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-[#13221D]/60"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      <span className="font-mono">{inv.invoiceNumber}</span> · {inv.customerName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Issued {formatDisplayDate(inv.issueDate)} · Due {formatDisplayDate(inv.dueDate)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatINR(inv.grandTotalInr)}
                    </p>
                    <div className="mt-0.5">
                      <StatusText status={getEffectiveInvoiceStatus(inv)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Recent Cash Transactions
            </h3>
            <button
              type="button"
              onClick={() => setActivePage('payments')}
              className="text-xs font-medium text-[#064E3B] dark:text-emerald-400 hover:underline cursor-pointer"
            >
              View Ledger
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <Briefcase className="w-7 h-7 text-slate-300 dark:text-emerald-900 mx-auto" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No recorded payments or expenses yet. Cash inflows and outflows appear here automatically.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-emerald-950/70">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-[#13221D]/60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        tx.kind === 'inflow'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                      }`}
                    >
                      {tx.kind === 'inflow' ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                        {tx.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {formatDisplayDate(tx.date)} · {tx.subtitle}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`font-mono text-xs font-semibold tabular-nums shrink-0 ${
                      tx.kind === 'inflow'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {tx.kind === 'inflow' ? '+' : '-'} {formatINR(tx.amountInr)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
