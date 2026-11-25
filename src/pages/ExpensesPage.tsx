import React, { useEffect, useMemo, useState } from 'react';
import {
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useErp } from '../context/ErpContext';
import {
  CURRENCIES,
  EXPENSE_CATEGORIES,
  FIELD_LIMITS,
  PAYMENT_METHODS,
  type CurrencyCode,
  type Expense,
  type ExpenseCategory,
  type PaymentMethod,
} from '../types/erp';
import {
  createExpense,
  deleteExpense,
  updateExpense,
  type ExpenseInput,
} from '../lib/erpService';
import {
  compressImageFileToDataUrl,
  formatCurrency,
  formatDisplayDate,
  formatINR,
  getMonthKey,
  roundMoney,
  todayISO,
} from '../lib/format';
import { ConfirmDialog } from '../components/ConfirmDialog';

const EMPTY_EXPENSE: ExpenseInput = {
  date: todayISO(),
  category: 'Software Subscriptions',
  description: '',
  originalCurrency: 'INR',
  originalAmount: 0,
  exchangeRate: 1,
  exchangeRateSource: 'Base Currency (INR)',
  transferFees: 0,
  paymentMethod: 'UPI',
  vendor: '',
  referenceNumber: '',
  attachmentUrl: '',
  attachmentName: '',
  notes: '',
};

export const ExpensesPage: React.FC = () => {
  const { user, expenses, settings, notify, quickCreateIntent, theme } = useErp();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ExpenseCategory>('All');
  const [monthFilter, setMonthFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseInput>(EMPTY_EXPENSE);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [attachmentPreview, setAttachmentPreview] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_EXPENSE,
      date: todayISO(),
      originalCurrency: settings.defaultCurrency || 'INR',
    });
    setModalOpen(true);
  };

  useEffect(() => {
    if (quickCreateIntent?.page === 'expenses') {
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCreateIntent]);

  const openEdit = (exp: Expense) => {
    setEditing(exp);
    setForm({
      date: exp.date,
      category: exp.category,
      description: exp.description,
      originalCurrency: exp.originalCurrency,
      originalAmount: exp.originalAmount,
      exchangeRate: exp.exchangeRate,
      exchangeRateSource: exp.exchangeRateSource,
      transferFees: exp.transferFees,
      paymentMethod: exp.paymentMethod,
      vendor: exp.vendor,
      referenceNumber: exp.referenceNumber,
      attachmentUrl: exp.attachmentUrl,
      attachmentName: exp.attachmentName,
      notes: exp.notes,
    });
    setModalOpen(true);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryFilter !== 'All' && e.category !== categoryFilter) return false;
      if (monthFilter && getMonthKey(e.date) !== monthFilter) return false;
      if (!q) return true;
      return (
        e.description.toLowerCase().includes(q) ||
        e.expenseCode.toLowerCase().includes(q) ||
        e.vendor.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.referenceNumber.toLowerCase().includes(q)
      );
    });
  }, [expenses, search, categoryFilter, monthFilter]);

  const summary = useMemo(() => {
    const thisMonthKey = getMonthKey(todayISO());
    const thisMonthTotal = roundMoney(
      expenses
        .filter((e) => getMonthKey(e.date) === thisMonthKey)
        .reduce((sum, e) => sum + (e.netAmountInr || 0), 0),
    );
    const filteredTotal = roundMoney(
      filtered.reduce((sum, e) => sum + (e.netAmountInr || 0), 0),
    );
    const allTimeTotal = roundMoney(
      expenses.reduce((sum, e) => sum + (e.netAmountInr || 0), 0),
    );

    const byCategoryMap = new Map<ExpenseCategory, number>();
    filtered.forEach((e) => {
      byCategoryMap.set(
        e.category,
        roundMoney((byCategoryMap.get(e.category) || 0) + (e.netAmountInr || 0)),
      );
    });
    const categoryData = Array.from(byCategoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return { thisMonthTotal, filteredTotal, allTimeTotal, categoryData };
  }, [expenses, filtered]);

  const formCalculated = useMemo(() => {
    const rate =
      form.originalCurrency === 'INR' ? 1 : Math.max(0.0001, Number(form.exchangeRate) || 1);
    const inrEq = roundMoney((Number(form.originalAmount) || 0) * rate);
    const fees = Math.max(0, roundMoney(Number(form.transferFees) || 0));
    return { inrEq, totalInr: roundMoney(inrEq + fees) };
  }, [form.originalAmount, form.originalCurrency, form.exchangeRate, form.transferFees]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Please upload a JPG, PNG, or WebP receipt image (or paste a link below).', 'error');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 900, FIELD_LIMITS.attachmentUrl - 1000);
      setForm((prev) => ({
        ...prev,
        attachmentUrl: dataUrl,
        attachmentName: file.name.slice(0, FIELD_LIMITS.attachmentName),
      }));
      notify('Receipt image attached and compressed.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to process image.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.description.trim() || form.originalAmount <= 0) {
      notify('Description and a positive amount are required.', 'error');
      return;
    }
    if (form.originalCurrency !== 'INR' && (!form.exchangeRate || form.exchangeRate <= 0)) {
      notify('Enter a valid manual exchange rate for foreign currency expenses.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateExpense(editing.id, form);
        notify(`Updated expense ${editing.expenseCode}.`);
      } else {
        await createExpense(user.uid, form);
        notify('Expense recorded in ledger.');
      }
      setModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save expense.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteTarget.id);
      notify(`Deleted expense ${deleteTarget.expenseCode}.`, 'info');
      setDeleteTarget(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete expense.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const gridStroke = theme === 'dark' ? '#1A2E27' : '#E2E8F0';
  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Expense Tracker
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track studio subscriptions, software, equipment, marketing, and operating costs in INR
            and foreign currencies.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {/* Summary Cards + Category Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-4 grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-4">
          <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-5">
            <p className="text-xs text-slate-500">This Month&apos;s Expenses</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold text-red-600 dark:text-red-400 tabular-nums">
              {formatINR(summary.thisMonthTotal)}
            </p>
          </div>
          <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-5">
            <p className="text-xs text-slate-500">Filtered Selection Total</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {formatINR(summary.filteredTotal)}
            </p>
          </div>
          <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-5">
            <p className="text-xs text-slate-500">All-Time Total Expenses</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {formatINR(summary.allTimeTotal)}
            </p>
          </div>
        </div>

        <div className="xl:col-span-8 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-5">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Category-wise Expense Analysis (INR)
          </h3>
          {summary.categoryData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500">
              Category chart updates automatically as expenses are logged.
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.categoryData}
                  layout="vertical"
                  margin={{ top: 4, right: 18, left: 16, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={140}
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(val) => formatINR(Number(val ?? 0))}
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#101C18' : '#FFFFFF',
                      borderColor: theme === 'dark' ? '#1E352D' : '#E2E8F0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="amount" name="Spent (INR)" fill="#064E3B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, vendor, code, or ref..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-lg outline-none focus:border-[#064E3B]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'All' | ExpenseCategory)}
          className="px-3 py-2 text-xs bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-lg outline-none"
        >
          <option value="All">All Categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          aria-label="Filter by month"
          className="px-3 py-2 text-xs bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-lg outline-none"
        />
        {monthFilter && (
          <button
            type="button"
            onClick={() => setMonthFilter('')}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            All Months
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Receipt className="w-8 h-8 text-slate-300 dark:text-emerald-900 mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {expenses.length === 0
                ? 'No business expenses recorded yet. Log software subscriptions, equipment, or studio costs.'
                : 'No expenses match your search or filters.'}
            </p>
            {expenses.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Log First Expense
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-emerald-950 text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0C1613]">
                  <th className="py-3 px-5 font-medium">ID / Date</th>
                  <th className="py-3 px-4 font-medium">Category &amp; Description</th>
                  <th className="py-3 px-4 font-medium">Vendor / Method</th>
                  <th className="py-3 px-4 font-medium text-right">Original</th>
                  <th className="py-3 px-4 font-medium text-right">Total (INR)</th>
                  <th className="py-3 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-emerald-950/70">
                {filtered.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#13221D]/60 transition-colors"
                  >
                    <td className="py-3.5 px-5 font-mono whitespace-nowrap">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {exp.expenseCode}
                      </p>
                      <p className="text-[11px] text-slate-500">{formatDisplayDate(exp.date)}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {exp.description}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {exp.category}
                        {exp.referenceNumber ? ` · Ref: ${exp.referenceNumber}` : ''}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-slate-800 dark:text-slate-200">{exp.vendor || '—'}</p>
                      <p className="text-[11px] text-slate-500">{exp.paymentMethod}</p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      <p>{formatCurrency(exp.originalAmount, exp.originalCurrency)}</p>
                      {exp.originalCurrency !== 'INR' && (
                        <p className="text-[10px] text-slate-500">@ ₹{exp.exchangeRate}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-red-600 dark:text-red-400 whitespace-nowrap">
                      {formatINR(exp.netAmountInr)}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {exp.attachmentUrl && (
                          <button
                            type="button"
                            onClick={() => setAttachmentPreview(exp)}
                            aria-label="View receipt attachment"
                            title="View Receipt Attachment"
                            className="p-1.5 rounded-md text-[#064E3B] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(exp)}
                          aria-label="Edit expense"
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#172A23] cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(exp)}
                          aria-label="Delete expense"
                          className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl shadow-xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950 flex items-center justify-between shrink-0">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {editing ? `Edit Expense (${editing.expenseCode})` : 'Log Business Expense'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as ExpenseCategory })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) =>
                      setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.expenseDescription}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Adobe Creative Cloud Monthly Plan"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0C1613] border border-slate-200 dark:border-emerald-950 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                      Currency
                    </label>
                    <select
                      value={form.originalCurrency}
                      onChange={(e) => {
                        const c = e.target.value as CurrencyCode;
                        setForm({
                          ...form,
                          originalCurrency: c,
                          exchangeRate: c === 'INR' ? 1 : form.exchangeRate,
                          exchangeRateSource:
                            c === 'INR' ? 'Base Currency (INR)' : form.exchangeRateSource,
                        });
                      }}
                      className="w-full px-2.5 py-2 text-xs bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 rounded-lg"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                      Amount ({form.originalCurrency}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={form.originalAmount}
                      onChange={(e) =>
                        setForm({ ...form, originalAmount: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-2 text-xs font-mono bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                      Forex / Bank Fee (INR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.transferFees}
                      onChange={(e) => setForm({ ...form, transferFees: Number(e.target.value) })}
                      className="w-full px-2.5 py-2 text-xs font-mono bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 rounded-lg"
                    />
                  </div>
                </div>

                {form.originalCurrency !== 'INR' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                        Manual Exchange Rate (1 {form.originalCurrency} → INR) *
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        min="0.01"
                        required
                        value={form.exchangeRate}
                        onChange={(e) =>
                          setForm({ ...form, exchangeRate: Number(e.target.value) })
                        }
                        className="w-full px-2.5 py-2 text-xs font-mono bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                        Rate Source *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={FIELD_LIMITS.exchangeRateSource}
                        value={form.exchangeRateSource}
                        onChange={(e) =>
                          setForm({ ...form, exchangeRateSource: e.target.value })
                        }
                        placeholder="e.g. Credit Card Statement"
                        className="w-full px-2.5 py-2 text-xs bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <div className="text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Net Expense (INR):{' '}
                  <span className="font-mono text-red-600 dark:text-red-400">
                    {formatINR(formCalculated.totalInr)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Vendor / Payee
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.vendor}
                    value={form.vendor}
                    onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                    placeholder="e.g. Adobe, JioFiber, Local Print Hub"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Reference / Bill Number
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.transactionReference}
                    value={form.referenceNumber}
                    onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                    placeholder="Invoice or UPI Ref"
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                  />
                </div>
              </div>

              {/* Attachment Upload */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Receipt Attachment (Image Upload)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162721] hover:bg-slate-200 rounded-lg cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploading ? 'Compressing...' : 'Upload Receipt Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {form.attachmentUrl && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[200px]">
                        {form.attachmentName || 'Receipt attached'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, attachmentUrl: '', attachmentName: '' })
                        }
                        className="text-red-500 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  maxLength={FIELD_LIMITS.notes}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-emerald-950">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#162721] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {attachmentPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl overflow-hidden shadow-2xl">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-emerald-950 flex items-center justify-between">
              <span className="text-xs font-semibold">
                {attachmentPreview.expenseCode} — {attachmentPreview.attachmentName || 'Receipt'}
              </span>
              <button
                type="button"
                onClick={() => setAttachmentPreview(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex justify-center bg-slate-100 dark:bg-[#08100D] max-h-[75vh] overflow-auto">
              <img
                src={attachmentPreview.attachmentUrl}
                alt={attachmentPreview.description}
                referrerPolicy="no-referrer"
                className="max-w-full rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Expense"
        description={`Permanently delete expense ${deleteTarget?.expenseCode} (${deleteTarget?.description})? Cash flow and expense reports will recalculate immediately.`}
        confirmLabel="Delete Expense"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
