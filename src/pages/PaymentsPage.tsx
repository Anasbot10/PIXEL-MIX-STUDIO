import React, { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Download,
  Eye,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';
import {
  CURRENCIES,
  FIELD_LIMITS,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  type CurrencyCode,
  type Payment,
  type PaymentMethod,
  type PaymentType,
} from '../types/erp';
import {
  deletePaymentAndReverseInvoice,
  recordPayment,
  type PaymentInput,
} from '../lib/erpService';
import {
  formatCurrency,
  formatDisplayDate,
  formatINR,
  getEffectiveInvoiceStatus,
  roundMoney,
  todayISO,
} from '../lib/format';
import { downloadReceiptPdf } from '../lib/pdfGenerator';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const PaymentsPage: React.FC = () => {
  const {
    user,
    payments,
    invoices,
    settings,
    notify,
    pendingPaymentInvoiceId,
    clearPendingPaymentInvoice,
    quickCreateIntent,
    setActivePage,
  } = useErp();

  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<'All' | PaymentMethod>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<Payment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const payableInvoices = useMemo(
    () =>
      invoices.filter((inv) => {
        const eff = getEffectiveInvoiceStatus(inv);
        return eff !== 'Cancelled' && inv.balanceDue > 0.01;
      }),
    [invoices],
  );

  const [form, setForm] = useState<PaymentInput>({
    invoiceId: '',
    invoiceNumber: '',
    customerId: '',
    customerName: '',
    paymentDate: todayISO(),
    paymentType: 'Full',
    paymentMethod: 'UPI',
    originalCurrency: 'INR',
    originalAmount: 0,
    exchangeRate: 1,
    exchangeRateSource: 'Base Currency (INR)',
    transferFees: 0,
    transactionReference: '',
    notes: '',
  });

  const openModalForInvoice = (invoiceId?: string) => {
    const targetInv =
      (invoiceId ? invoices.find((i) => i.id === invoiceId) : payableInvoices[0]) ||
      payableInvoices[0];
    if (!targetInv) {
      notify('No unpaid invoices available to record a payment against.', 'info');
      setActivePage('invoices');
      return;
    }
    setForm({
      invoiceId: targetInv.id,
      invoiceNumber: targetInv.invoiceNumber,
      customerId: targetInv.customerId,
      customerName: targetInv.customerName,
      paymentDate: todayISO(),
      paymentType: targetInv.amountPaid > 0 ? 'Partial' : 'Full',
      paymentMethod: targetInv.currency === 'INR' ? 'UPI' : 'International Transfer',
      originalCurrency: targetInv.currency,
      originalAmount: targetInv.balanceDue,
      exchangeRate: targetInv.currency === 'INR' ? 1 : targetInv.exchangeRate,
      exchangeRateSource:
        targetInv.currency === 'INR'
          ? 'Base Currency (INR)'
          : targetInv.exchangeRateSource || 'Bank Settlement Slip',
      transferFees: 0,
      transactionReference: '',
      notes: '',
    });
    setModalOpen(true);
  };

  useEffect(() => {
    if (pendingPaymentInvoiceId) {
      openModalForInvoice(pendingPaymentInvoiceId);
      clearPendingPaymentInvoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPaymentInvoiceId]);

  useEffect(() => {
    if (quickCreateIntent?.page === 'payments') {
      openModalForInvoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCreateIntent]);

  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === form.invoiceId) || null,
    [invoices, form.invoiceId],
  );

  const handleInvoiceChange = (invId: string) => {
    const inv = invoices.find((i) => i.id === invId);
    if (!inv) return;
    setForm((prev) => ({
      ...prev,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerId: inv.customerId,
      customerName: inv.customerName,
      originalCurrency: inv.currency,
      originalAmount: inv.balanceDue,
      exchangeRate: inv.currency === 'INR' ? 1 : inv.exchangeRate,
      exchangeRateSource:
        inv.currency === 'INR'
          ? 'Base Currency (INR)'
          : inv.exchangeRateSource || 'Bank Settlement Slip',
      paymentMethod: inv.currency === 'INR' ? prev.paymentMethod : 'International Transfer',
    }));
  };

  const calculatedInr = useMemo(() => {
    const rate = form.originalCurrency === 'INR' ? 1 : Math.max(0.0001, Number(form.exchangeRate) || 1);
    const gross = roundMoney((Number(form.originalAmount) || 0) * rate);
    const fees = Math.max(0, roundMoney(Number(form.transferFees) || 0));
    const net = roundMoney(Math.max(0, gross - fees));
    return { gross, fees, net };
  }, [form.originalAmount, form.originalCurrency, form.exchangeRate, form.transferFees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (methodFilter !== 'All' && p.paymentMethod !== methodFilter) return false;
      if (!q) return true;
      return (
        p.receiptNumber.toLowerCase().includes(q) ||
        p.invoiceNumber.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        p.transactionReference.toLowerCase().includes(q)
      );
    });
  }, [payments, search, methodFilter]);

  const totalReceivedInr = useMemo(
    () => roundMoney(filtered.reduce((sum, p) => sum + (p.netAmountReceivedInr || 0), 0)),
    [filtered],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.invoiceId || form.originalAmount <= 0) {
      notify('Please choose an invoice and enter a positive payment amount.', 'error');
      return;
    }
    if (form.originalCurrency !== 'INR' && (!form.exchangeRate || form.exchangeRate <= 0)) {
      notify('Please enter the actual manual exchange rate for this foreign currency payment.', 'error');
      return;
    }
    setSaving(true);
    try {
      await recordPayment(user.uid, form);
      notify('Payment recorded and studio receipt issued. Invoice balance updated.', 'success');
      setModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to record payment.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePaymentAndReverseInvoice(deleteTarget);
      notify(
        `Deleted receipt ${deleteTarget.receiptNumber} and reversed invoice balance.`,
        'info',
      );
      setDeleteTarget(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to reverse payment.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const getInvoiceBalance = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    return inv ? inv.balanceDueInr : undefined;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Payments &amp; Studio Receipts
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Receipts are issued strictly for recorded payments and clearly distinguished from
            bank-issued transaction proofs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModalForInvoice()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Record Payment
        </button>
      </div>

      {/* Filters & Live Filtered Total */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search receipt no, invoice no, client, or UTR ref..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-lg outline-none focus:border-[#064E3B]"
            />
          </div>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as 'All' | PaymentMethod)}
            className="px-3 py-2 text-xs bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-lg outline-none"
          >
            <option value="All">All Payment Methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
          Filtered Net Received:{' '}
          <span className="font-mono font-semibold text-[#064E3B] dark:text-emerald-400 tabular-nums">
            {formatINR(totalReceivedInr)}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <CreditCard className="w-8 h-8 text-slate-300 dark:text-emerald-900 mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {payments.length === 0
                ? 'No payments recorded yet. Record an advance, partial, or full payment against an issued invoice.'
                : 'No receipts match your search or payment method filter.'}
            </p>
            {payments.length === 0 && payableInvoices.length > 0 && (
              <button
                type="button"
                onClick={() => openModalForInvoice()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Record First Payment
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-emerald-950 text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0C1613]">
                  <th className="py-3 px-5 font-medium">Receipt No</th>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Customer &amp; Invoice</th>
                  <th className="py-3 px-4 font-medium">Method / Ref</th>
                  <th className="py-3 px-4 font-medium text-right">Original Amount</th>
                  <th className="py-3 px-4 font-medium text-right">Net Received (INR)</th>
                  <th className="py-3 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-emerald-950/70">
                {filtered.map((pay) => (
                  <tr
                    key={pay.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#13221D]/60 transition-colors"
                  >
                    <td className="py-3.5 px-5 font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {pay.receiptNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDisplayDate(pay.paymentDate)}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {pay.customerName}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {pay.invoiceNumber} · {pay.paymentType}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-slate-800 dark:text-slate-200">{pay.paymentMethod}</p>
                      <p className="font-mono text-[11px] text-slate-500 truncate max-w-[160px]">
                        {pay.transactionReference || 'No ref logged'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      <p className="text-slate-800 dark:text-slate-200">
                        {formatCurrency(pay.originalAmount, pay.originalCurrency)}
                      </p>
                      {pay.originalCurrency !== 'INR' && (
                        <p className="text-[10px] text-slate-500">
                          @ ₹{pay.exchangeRate} ({pay.exchangeRateSource})
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      <p>{formatINR(pay.netAmountReceivedInr)}</p>
                      {pay.transferFees > 0 && (
                        <p className="text-[10px] text-slate-500 font-normal">
                          Fees: {formatINR(pay.transferFees)}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewReceipt(pay)}
                          aria-label="Preview / Print receipt"
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#172A23] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadReceiptPdf(pay, settings, getInvoiceBalance(pay.invoiceId))
                          }
                          aria-label="Download Receipt PDF"
                          className="p-1.5 rounded-md text-slate-500 hover:text-[#064E3B] dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#172A23] cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(pay)}
                          aria-label="Delete and reverse payment"
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

      {/* Record Payment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl shadow-xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Record Payment &amp; Issue Receipt
                </h3>
                <p className="text-[11px] text-slate-500">
                  Atomically updates linked invoice paid balance and generates a studio receipt.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Linked Invoice *
                </label>
                <select
                  required
                  value={form.invoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                >
                  {payableInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.customerName} (Balance:{' '}
                      {formatCurrency(inv.balanceDue, inv.currency)})
                    </option>
                  ))}
                </select>
                {selectedInvoice && (
                  <p className="mt-1 text-[11px] text-slate-500 font-mono">
                    Total: {formatCurrency(selectedInvoice.grandTotal, selectedInvoice.currency)} ·
                    Paid: {formatCurrency(selectedInvoice.amountPaid, selectedInvoice.currency)} ·
                    Remaining: {formatCurrency(selectedInvoice.balanceDue, selectedInvoice.currency)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.paymentDate}
                    onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Payment Type
                  </label>
                  <select
                    value={form.paymentType}
                    onChange={(e) =>
                      setForm({ ...form, paymentType: e.target.value as PaymentType })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                  >
                    {PAYMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t} Payment
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

              {/* Currency & Forex Accounting */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0C1613] border border-slate-200 dark:border-emerald-950 space-y-3">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Currency &amp; Settlement Accounting
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                      Original Currency
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
                      Original Amount ({form.originalCurrency}) *
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
                      Transfer / Bank Fees (INR)
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                        Actual Exchange Rate (1 {form.originalCurrency} → INR) *
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
                        Exchange Rate Source *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={FIELD_LIMITS.exchangeRateSource}
                        value={form.exchangeRateSource}
                        onChange={(e) =>
                          setForm({ ...form, exchangeRateSource: e.target.value })
                        }
                        placeholder="e.g. Wise Transfer Slip / SBI Forex Advice"
                        className="w-full px-2.5 py-2 text-xs bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 dark:border-emerald-900 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500">
                    Gross INR Equivalent:{' '}
                    <strong className="font-mono text-slate-800 dark:text-slate-200">
                      {formatINR(calculatedInr.gross)}
                    </strong>
                  </span>
                  <span className="text-[#064E3B] dark:text-emerald-400 font-semibold">
                    Net Amount Received (INR):{' '}
                    <span className="font-mono">{formatINR(calculatedInr.net)}</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Transaction Reference (UTR / UPI Ref / SWIFT)
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.transactionReference}
                    value={form.transactionReference}
                    onChange={(e) => setForm({ ...form, transactionReference: e.target.value })}
                    placeholder="e.g. UPI/428391029384"
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.notes}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Optional acknowledgement note..."
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                  />
                </div>
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
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Recording...' : 'Record Payment & Issue Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DocumentPreviewModal
        doc={
          previewReceipt
            ? {
                type: 'receipt',
                data: previewReceipt,
                remainingBalanceInr: getInvoiceBalance(previewReceipt.invoiceId),
              }
            : null
        }
        settings={settings}
        onClose={() => setPreviewReceipt(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Payment & Reverse Invoice Balance"
        description={`Deleting receipt ${deleteTarget?.receiptNumber} (${formatINR(deleteTarget?.netAmountReceivedInr || 0)}) will automatically restore the unpaid balance on invoice ${deleteTarget?.invoiceNumber}.`}
        confirmLabel="Reverse Payment"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
