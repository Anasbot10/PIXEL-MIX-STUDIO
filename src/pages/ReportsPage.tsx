import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import {
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
  formatDisplayDate,
  formatINR,
  formatPdfCurrency,
  getEffectiveInvoiceStatus,
  roundMoney,
  todayISO,
} from '../lib/format';
import { downloadFinancialReportPdf } from '../lib/pdfGenerator';
import { exportReportToExcel } from '../lib/excelExport';
import { StatusText } from '../components/StatusText';

type PeriodMode = 'daily' | 'weekly' | 'monthly' | 'annual';
type ReportTab = 'summary' | 'customers' | 'services' | 'expenses' | 'outstanding';

function getDateRange(mode: PeriodMode, anchorDate: string): { start: string; end: string; label: string } {
  const d = anchorDate ? new Date(`${anchorDate}T00:00:00`) : new Date();
  const toIso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  if (mode === 'daily') {
    const iso = toIso(d);
    return { start: iso, end: iso, label: `Daily (${formatDisplayDate(iso)})` };
  }
  if (mode === 'weekly') {
    const startDt = new Date(d);
    startDt.setDate(d.getDate() - 6);
    const start = toIso(startDt);
    const end = toIso(d);
    return {
      start,
      end,
      label: `Weekly (${formatDisplayDate(start)} – ${formatDisplayDate(end)})`,
    };
  }
  if (mode === 'monthly') {
    const startDt = new Date(d.getFullYear(), d.getMonth(), 1);
    const endDt = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return {
      start: toIso(startDt),
      end: toIso(endDt),
      label: `Monthly (${d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })})`,
    };
  }
  const year = d.getFullYear();
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    label: `Annual (${year})`,
  };
}

export const ReportsPage: React.FC = () => {
  const { invoices, payments, expenses, settings, theme, notify } = useErp();

  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');
  const [anchorDate, setAnchorDate] = useState(todayISO());
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');

  const range = useMemo(() => getDateRange(periodMode, anchorDate), [periodMode, anchorDate]);

  const inRange = (dateStr: string) => Boolean(dateStr && dateStr >= range.start && dateStr <= range.end);

  const reportData = useMemo(() => {
    const billedInvoices = invoices.filter(
      (inv) => inv.status !== 'Draft' && inv.status !== 'Cancelled' && inRange(inv.issueDate),
    );
    const periodPayments = payments.filter((p) => inRange(p.paymentDate));
    const periodExpenses = expenses.filter((e) => inRange(e.date));

    const billedRevenueInr = roundMoney(
      billedInvoices.reduce((sum, i) => sum + (i.grandTotalInr || 0), 0),
    );
    const cashReceivedInr = roundMoney(
      periodPayments.reduce((sum, p) => sum + (p.netAmountReceivedInr || 0), 0),
    );
    const totalExpensesInr = roundMoney(
      periodExpenses.reduce((sum, e) => sum + (e.netAmountInr || 0), 0),
    );
    const transferFeesInr = roundMoney(
      periodPayments.reduce((sum, p) => sum + (p.transferFees || 0), 0) +
        periodExpenses.reduce((sum, e) => sum + (e.transferFees || 0), 0),
    );
    const netCashFlowInr = roundMoney(cashReceivedInr - totalExpensesInr);

    // Customer-wise income (both billed & cash received in period)
    const custMap = new Map<
      string,
      { customerName: string; invoiceCount: number; billedInr: number; receivedInr: number }
    >();
    billedInvoices.forEach((inv) => {
      const cur = custMap.get(inv.customerId) || {
        customerName: inv.customerName,
        invoiceCount: 0,
        billedInr: 0,
        receivedInr: 0,
      };
      cur.invoiceCount += 1;
      cur.billedInr = roundMoney(cur.billedInr + (inv.grandTotalInr || 0));
      custMap.set(inv.customerId, cur);
    });
    periodPayments.forEach((pay) => {
      const cur = custMap.get(pay.customerId) || {
        customerName: pay.customerName,
        invoiceCount: 0,
        billedInr: 0,
        receivedInr: 0,
      };
      cur.receivedInr = roundMoney(cur.receivedInr + (pay.netAmountReceivedInr || 0));
      custMap.set(pay.customerId, cur);
    });
    const customerIncome = Array.from(custMap.values()).sort((a, b) => b.receivedInr - a.receivedInr);

    // Service-wise income from non-draft, non-cancelled invoices in period
    const srvMap = new Map<string, { serviceName: string; qty: number; billedInr: number }>();
    billedInvoices.forEach((inv) => {
      const rate = inv.currency === 'INR' ? 1 : inv.exchangeRate || 1;
      inv.items.forEach((item) => {
        const key = item.name.trim() || 'Custom Design';
        const cur = srvMap.get(key) || { serviceName: key, qty: 0, billedInr: 0 };
        cur.qty = roundMoney(cur.qty + (item.quantity || 0));
        cur.billedInr = roundMoney(cur.billedInr + (item.total || 0) * rate);
        srvMap.set(key, cur);
      });
    });
    const serviceIncome = Array.from(srvMap.values()).sort((a, b) => b.billedInr - a.billedInr);

    // Expense breakdown by category in period
    const expCatMap = new Map<string, { category: string; count: number; totalInr: number }>();
    periodExpenses.forEach((e) => {
      const cur = expCatMap.get(e.category) || { category: e.category, count: 0, totalInr: 0 };
      cur.count += 1;
      cur.totalInr = roundMoney(cur.totalInr + (e.netAmountInr || 0));
      expCatMap.set(e.category, cur);
    });
    const expenseByCategory = Array.from(expCatMap.values()).sort((a, b) => b.totalInr - a.totalInr);

    // All currently outstanding invoices (all-time receivable snapshot)
    const outstandingInvoices = invoices
      .filter((inv) => {
        const eff = getEffectiveInvoiceStatus(inv);
        return (eff === 'Unpaid' || eff === 'Partially Paid' || eff === 'Overdue') && inv.balanceDueInr > 0.01;
      })
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

    const totalOutstandingInr = roundMoney(
      outstandingInvoices.reduce((sum, i) => sum + (i.balanceDueInr || 0), 0),
    );

    const chartData = [
      {
        name: range.label,
        Billed: billedRevenueInr,
        Received: cashReceivedInr,
        Expenses: totalExpensesInr,
        NetCashFlow: netCashFlowInr,
      },
    ];

    return {
      billedInvoices,
      periodPayments,
      periodExpenses,
      billedRevenueInr,
      cashReceivedInr,
      totalExpensesInr,
      transferFeesInr,
      netCashFlowInr,
      customerIncome,
      serviceIncome,
      expenseByCategory,
      outstandingInvoices,
      totalOutstandingInr,
      chartData,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, payments, expenses, range]);

  const handleExportPdf = () => {
    const summaryItems = [
      { label: 'Billed Revenue (Non-Draft/Non-Cancelled)', value: formatPdfCurrency(reportData.billedRevenueInr, 'INR') },
      { label: 'Actual Payments Received (Receipts)', value: formatPdfCurrency(reportData.cashReceivedInr, 'INR') },
      { label: 'Total Operating Expenses', value: formatPdfCurrency(reportData.totalExpensesInr, 'INR') },
      { label: 'Net Cash Flow (Cash Received - Expenses)', value: formatPdfCurrency(reportData.netCashFlowInr, 'INR') },
      { label: 'Total Outstanding Receivables (All-Time)', value: formatPdfCurrency(reportData.totalOutstandingInr, 'INR') },
    ];

    if (activeTab === 'customers') {
      downloadFinancialReportPdf(
        'Customer-wise Income Report',
        range.label,
        settings,
        summaryItems,
        ['Customer', 'Invoices', 'Billed (INR)', 'Cash Received (INR)'],
        reportData.customerIncome.map((c) => [
          c.customerName,
          String(c.invoiceCount),
          formatPdfCurrency(c.billedInr, 'INR'),
          formatPdfCurrency(c.receivedInr, 'INR'),
        ]),
        `AM_PIXEL_Customer_Income_${range.start}`,
      );
    } else if (activeTab === 'services') {
      downloadFinancialReportPdf(
        'Service-wise Income Report',
        range.label,
        settings,
        summaryItems,
        ['Service / Deliverable', 'Units Billed', 'Billed Value (INR)'],
        reportData.serviceIncome.map((s) => [
          s.serviceName,
          String(s.qty),
          formatPdfCurrency(s.billedInr, 'INR'),
        ]),
        `AM_PIXEL_Service_Income_${range.start}`,
      );
    } else if (activeTab === 'expenses') {
      downloadFinancialReportPdf(
        'Expense Report',
        range.label,
        settings,
        summaryItems,
        ['Date', 'Category', 'Description', 'Vendor', 'Amount (INR)'],
        reportData.periodExpenses.map((e) => [
          e.date,
          e.category,
          e.description,
          e.vendor || '-',
          formatPdfCurrency(e.netAmountInr, 'INR'),
        ]),
        `AM_PIXEL_Expenses_${range.start}`,
      );
    } else if (activeTab === 'outstanding') {
      downloadFinancialReportPdf(
        'Outstanding Payments Report',
        `As of ${formatDisplayDate(todayISO())}`,
        settings,
        summaryItems,
        ['Invoice No', 'Customer', 'Due Date', 'Status', 'Balance Due (INR)'],
        reportData.outstandingInvoices.map((i) => [
          i.invoiceNumber,
          i.customerName,
          i.dueDate,
          getEffectiveInvoiceStatus(i),
          formatPdfCurrency(i.balanceDueInr, 'INR'),
        ]),
        `AM_PIXEL_Outstanding_${todayISO()}`,
      );
    } else {
      downloadFinancialReportPdf(
        'Profit & Cash-Flow Summary',
        range.label,
        settings,
        summaryItems,
        ['Receipt / Expense Code', 'Date', 'Type', 'Party / Category', 'Net INR'],
        [
          ...reportData.periodPayments.map((p) => [
            p.receiptNumber,
            p.paymentDate,
            'Cash Inflow',
            `${p.customerName} (${p.invoiceNumber})`,
            formatPdfCurrency(p.netAmountReceivedInr, 'INR'),
          ]),
          ...reportData.periodExpenses.map((e) => [
            e.expenseCode,
            e.date,
            'Expense Outflow',
            `${e.category} - ${e.description}`,
            `- ${formatPdfCurrency(e.netAmountInr, 'INR')}`,
          ]),
        ],
        `AM_PIXEL_CashFlow_${range.start}`,
      );
    }
    notify('PDF financial report downloaded.', 'success');
  };

  const handleExportExcel = () => {
    if (activeTab === 'customers') {
      exportReportToExcel(
        'Customer Income',
        reportData.customerIncome.map((c) => ({
          Customer: c.customerName,
          Invoices: c.invoiceCount,
          BilledINR: c.billedInr,
          CashReceivedINR: c.receivedInr,
        })),
        `AM_PIXEL_Customer_Income_${range.start}`,
      );
    } else if (activeTab === 'services') {
      exportReportToExcel(
        'Service Income',
        reportData.serviceIncome.map((s) => ({
          Service: s.serviceName,
          Quantity: s.qty,
          BilledINR: s.billedInr,
        })),
        `AM_PIXEL_Service_Income_${range.start}`,
      );
    } else if (activeTab === 'expenses') {
      exportReportToExcel(
        'Expenses',
        reportData.periodExpenses.map((e) => ({
          Code: e.expenseCode,
          Date: e.date,
          Category: e.category,
          Description: e.description,
          Vendor: e.vendor,
          Currency: e.originalCurrency,
          OriginalAmount: e.originalAmount,
          NetINR: e.netAmountInr,
        })),
        `AM_PIXEL_Expenses_${range.start}`,
      );
    } else if (activeTab === 'outstanding') {
      exportReportToExcel(
        'Outstanding',
        reportData.outstandingInvoices.map((i) => ({
          InvoiceNo: i.invoiceNumber,
          Customer: i.customerName,
          IssueDate: i.issueDate,
          DueDate: i.dueDate,
          Status: getEffectiveInvoiceStatus(i),
          GrandTotalINR: i.grandTotalInr,
          AmountPaidINR: i.amountPaidInr,
          BalanceDueINR: i.balanceDueInr,
        })),
        `AM_PIXEL_Outstanding_${todayISO()}`,
      );
    } else {
      exportReportToExcel(
        'Cash Flow Summary',
        [
          { Metric: 'Period', Value: range.label },
          { Metric: 'Billed Revenue (INR)', Value: reportData.billedRevenueInr },
          { Metric: 'Cash Payments Received (INR)', Value: reportData.cashReceivedInr },
          { Metric: 'Total Expenses (INR)', Value: reportData.totalExpensesInr },
          { Metric: 'Net Cash Flow (INR)', Value: reportData.netCashFlowInr },
          { Metric: 'Transfer / Bank Fees (INR)', Value: reportData.transferFeesInr },
          { Metric: 'Total Outstanding Receivables (INR)', Value: reportData.totalOutstandingInr },
        ],
        `AM_PIXEL_CashFlow_${range.start}`,
      );
    }
    notify('Excel (.xlsx) report exported.', 'success');
  };

  const gridStroke = theme === 'dark' ? '#1A2E27' : '#E2E8F0';
  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Financial Reports &amp; Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {range.label} · Strictly calculated from saved Firestore transactions (Base INR).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 hover:bg-slate-50 rounded-lg whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#064E3B] dark:text-emerald-400" />
            Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Period Picker & Report Tabs */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0F1B17] rounded-lg">
            {(['daily', 'weekly', 'monthly', 'annual'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPeriodMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer ${
                  periodMode === mode
                    ? 'bg-white dark:bg-[#162922] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            aria-label="Report reference date"
            className="px-3 py-2 text-xs bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-lg outline-none"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0F1B17] rounded-lg overflow-x-auto">
          {(
            [
              ['summary', 'Profit & Cash Flow'],
              ['customers', 'Customer Income'],
              ['services', 'Service Income'],
              ['expenses', 'Expense Report'],
              ['outstanding', 'Outstanding'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === id
                  ? 'bg-white dark:bg-[#162922] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Period Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-4">
          <p className="text-[11px] text-slate-500">Billed Revenue</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {formatINR(reportData.billedRevenueInr)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-4">
          <p className="text-[11px] text-slate-500">Cash Received</p>
          <p className="mt-1 font-mono text-lg font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatINR(reportData.cashReceivedInr)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-4">
          <p className="text-[11px] text-slate-500">Operating Expenses</p>
          <p className="mt-1 font-mono text-lg font-semibold text-red-600 dark:text-red-400 tabular-nums">
            {formatINR(reportData.totalExpensesInr)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-4">
          <p className="text-[11px] text-slate-500">Net Cash Flow</p>
          <p
            className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
              reportData.netCashFlowInr >= 0
                ? 'text-[#064E3B] dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatINR(reportData.netCashFlowInr)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-4">
          <p className="text-[11px] text-slate-500">Outstanding Receivables</p>
          <p className="mt-1 font-mono text-lg font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
            {formatINR(reportData.totalOutstandingInr)}
          </p>
        </div>
      </div>

      {/* Report Body */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-6">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Cash-Flow Breakdown ({range.label})
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} />
                  <YAxis
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={false}
                    tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                  />
                  <Tooltip formatter={(val) => formatINR(Number(val ?? 0))} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="Billed" fill="#B89146" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Received" fill="#064E3B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#DC2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-6 space-y-3 text-xs">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Accounting Verification Statement
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-emerald-950/70">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  Invoices Billed (Excl. Draft &amp; Cancelled)
                </span>
                <span className="font-mono font-medium">
                  {reportData.billedInvoices.length} ({formatINR(reportData.billedRevenueInr)})
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  Recorded Payment Receipts
                </span>
                <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">
                  {reportData.periodPayments.length} ({formatINR(reportData.cashReceivedInr)})
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Logged Operating Expenses</span>
                <span className="font-mono font-medium text-red-600 dark:text-red-400">
                  {reportData.periodExpenses.length} ({formatINR(reportData.totalExpensesInr)})
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  Transfer / Forex Settlement Fees
                </span>
                <span className="font-mono">{formatINR(reportData.transferFeesInr)}</span>
              </div>
              <div className="py-3 flex justify-between font-semibold text-sm">
                <span className="text-slate-900 dark:text-white">Net Cash Flow</span>
                <span className="font-mono text-[#064E3B] dark:text-emerald-400">
                  {formatINR(reportData.netCashFlowInr)}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 pt-2">
              Accounting policy: Unpaid invoices do not inflate cash received. Cancelled invoices
              are excluded from revenue. All foreign currency records convert at their recorded
              manual exchange rates.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl overflow-hidden">
          {reportData.customerIncome.length === 0 ? (
            <p className="p-10 text-center text-xs text-slate-500">
              No customer billing or receipt activity recorded in {range.label}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-emerald-950 text-slate-500 bg-slate-50/70 dark:bg-[#0C1613]">
                    <th className="py-3 px-5 font-medium">Customer</th>
                    <th className="py-3 px-4 font-medium text-right">Invoices</th>
                    <th className="py-3 px-4 font-medium text-right">Billed (INR)</th>
                    <th className="py-3 px-5 font-medium text-right">Cash Received (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-emerald-950/70">
                  {reportData.customerIncome.map((row) => (
                    <tr key={row.customerName}>
                      <td className="py-3 px-5 font-medium text-slate-900 dark:text-white">
                        {row.customerName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {row.invoiceCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatINR(row.billedInr)}
                      </td>
                      <td className="py-3 px-5 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatINR(row.receivedInr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'services' && (
        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl overflow-hidden">
          {reportData.serviceIncome.length === 0 ? (
            <p className="p-10 text-center text-xs text-slate-500">
              No billed service items recorded in {range.label}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-emerald-950 text-slate-500 bg-slate-50/70 dark:bg-[#0C1613]">
                    <th className="py-3 px-5 font-medium">Service / Deliverable</th>
                    <th className="py-3 px-4 font-medium text-right">Units Billed</th>
                    <th className="py-3 px-5 font-medium text-right">Total Billed (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-emerald-950/70">
                  {reportData.serviceIncome.map((row) => (
                    <tr key={row.serviceName}>
                      <td className="py-3 px-5 font-medium text-slate-900 dark:text-white">
                        {row.serviceName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{row.qty}</td>
                      <td className="py-3 px-5 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                        {formatINR(row.billedInr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl overflow-hidden">
          {reportData.expenseByCategory.length === 0 ? (
            <p className="p-10 text-center text-xs text-slate-500">
              No expenses recorded in {range.label}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-emerald-950 text-slate-500 bg-slate-50/70 dark:bg-[#0C1613]">
                    <th className="py-3 px-5 font-medium">Expense Category</th>
                    <th className="py-3 px-4 font-medium text-right">Entries</th>
                    <th className="py-3 px-5 font-medium text-right">Total Spent (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-emerald-950/70">
                  {reportData.expenseByCategory.map((row) => (
                    <tr key={row.category}>
                      <td className="py-3 px-5 font-medium text-slate-900 dark:text-white">
                        {row.category}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{row.count}</td>
                      <td className="py-3 px-5 text-right font-mono font-semibold text-red-600 dark:text-red-400 tabular-nums">
                        {formatINR(row.totalInr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'outstanding' && (
        <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl overflow-hidden">
          {reportData.outstandingInvoices.length === 0 ? (
            <p className="p-10 text-center text-xs text-slate-500">
              All issued invoices are settled. Zero outstanding receivables.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-emerald-950 text-slate-500 bg-slate-50/70 dark:bg-[#0C1613]">
                    <th className="py-3 px-5 font-medium">Invoice No</th>
                    <th className="py-3 px-4 font-medium">Customer</th>
                    <th className="py-3 px-4 font-medium">Due Date</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Billed (INR)</th>
                    <th className="py-3 px-4 font-medium text-right">Paid (INR)</th>
                    <th className="py-3 px-5 font-medium text-right">Balance Due (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-emerald-950/70">
                  {reportData.outstandingInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-3 px-5 font-mono font-semibold text-slate-900 dark:text-white">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                        {inv.customerName}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {formatDisplayDate(inv.dueDate)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusText status={getEffectiveInvoiceStatus(inv)} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatINR(inv.grandTotalInr)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatINR(inv.amountPaidInr)}
                      </td>
                      <td className="py-3 px-5 text-right font-mono font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                        {formatINR(inv.balanceDueInr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
