import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CreditCard,
  Download,
  Eye,
  FileText,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';
import {
  CURRENCIES,
  FIELD_LIMITS,
  INVOICE_STATUSES,
  type CurrencyCode,
  type Invoice,
  type InvoiceStatus,
} from '../types/erp';
import {
  calculateDocumentTotals,
  cancelInvoice,
  createInvoice,
  deleteInvoice,
  updateInvoice,
  type InvoiceInput,
} from '../lib/erpService';
import {
  addDaysISO,
  buildWhatsAppInvoiceUrl,
  formatCurrency,
  formatDisplayDate,
  formatINR,
  getEffectiveInvoiceStatus,
  todayISO,
} from '../lib/format';
import { downloadInvoicePdf } from '../lib/pdfGenerator';
import { LineItemsEditor } from '../components/LineItemsEditor';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusText } from '../components/StatusText';

export const InvoicesPage: React.FC = () => {
  const {
    user,
    invoices,
    customers,
    services,
    settings,
    notify,
    setActivePage,
    openPaymentForInvoice,
    quickCreateIntent,
  } = useErp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | InvoiceStatus>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Invoice | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState<InvoiceInput>({
    customerId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    issueDate: todayISO(),
    dueDate: addDaysISO(todayISO(), 14),
    currency: 'INR',
    exchangeRate: 1,
    exchangeRateSource: 'Base Currency (INR)',
    items: [{ serviceId: '', name: '', description: '', quantity: 1, unitPrice: 0, total: 0 }],
    discountType: 'fixed',
    discountValue: 0,
    status: 'Unpaid',
    notes: '',
    paymentInstructions: '',
    sourceQuotationId: '',
  });

  const openCreate = () => {
    if (customers.length === 0) {
      notify('Please add a customer first before creating an invoice.', 'info');
      setActivePage('customers');
      return;
    }
    const c = customers[0];
    setEditing(null);
    setForm({
      customerId: c.id,
      customerName: c.fullName,
      customerEmail: c.email,
      customerPhone: c.phone,
      customerAddress: c.address,
      issueDate: todayISO(),
      dueDate: addDaysISO(todayISO(), 14),
      currency: settings.defaultCurrency || 'INR',
      exchangeRate: 1,
      exchangeRateSource: 'Base Currency (INR)',
      items: [{ serviceId: '', name: '', description: '', quantity: 1, unitPrice: 0, total: 0 }],
      discountType: 'fixed',
      discountValue: 0,
      status: 'Unpaid',
      notes: '',
      paymentInstructions: settings.defaultPaymentInstructions,
      sourceQuotationId: '',
    });
    setModalOpen(true);
  };

  useEffect(() => {
    if (quickCreateIntent?.page === 'invoices') {
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCreateIntent]);

  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setForm({
      customerId: inv.customerId,
      customerName: inv.customerName,
      customerEmail: inv.customerEmail,
      customerPhone: inv.customerPhone,
      customerAddress: inv.customerAddress,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      currency: inv.currency,
      exchangeRate: inv.exchangeRate,
      exchangeRateSource: inv.exchangeRateSource,
      items: inv.items.map((x) => ({ ...x })),
      discountType: inv.discountType,
      discountValue: inv.discountValue,
      status: inv.status,
      notes: inv.notes,
      paymentInstructions: inv.paymentInstructions,
      sourceQuotationId: inv.sourceQuotationId,
    });
    setModalOpen(true);
  };

  const handleCustomerChange = (customerId: string) => {
    const c = customers.find((x) => x.id === customerId);
    if (!c) return;
    setForm((prev) => ({
      ...prev,
      customerId: c.id,
      customerName: c.fullName,
      customerEmail: c.email,
      customerPhone: c.phone,
      customerAddress: c.address,
    }));
  };

  const totals = useMemo(
    () =>
      calculateDocumentTotals(
        form.items,
        form.discountType,
        form.discountValue,
        form.currency,
        form.exchangeRate,
      ),
    [form.items, form.discountType, form.discountValue, form.currency, form.exchangeRate],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      const eff = getEffectiveInvoiceStatus(inv);
      if (statusFilter !== 'All' && eff !== statusFilter) return false;
      if (dateFrom && inv.issueDate < dateFrom) return false;
      if (dateTo && inv.issueDate > dateTo) return false;
      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, statusFilter, dateFrom, dateTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.customerId) {
      notify('Please select a customer.', 'error');
      return;
    }
    if (form.currency !== 'INR' && (!form.exchangeRate || form.exchangeRate <= 0)) {
      notify('Please enter a valid manual exchange rate for foreign currency.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateInvoice(editing, form);
        notify(`Updated commercial invoice ${editing.invoiceNumber}.`);
      } else {
        await createInvoice(user.uid, form);
        notify('Commercial invoice created successfully.');
      }
      setModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save invoice.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelInvoice(cancelTarget.id);
      notify(`Invoice ${cancelTarget.invoiceNumber} marked Cancelled (excluded from revenue).`, 'info');
      setCancelTarget(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to cancel invoice.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteInvoice(deleteTarget.id);
      notify(`Deleted invoice ${deleteTarget.invoiceNumber}.`, 'info');
      setDeleteTarget(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete invoice.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Commercial Invoices (Non-GST)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Invoices automatically calculate balances from recorded payments. Never marked Paid
            without an actual receipt.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice number or customer..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-lg outline-none focus:border-[#064E3B]"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Filter from date"
              className="px-2.5 py-2 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-lg outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Filter to date"
              className="px-2.5 py-2 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-lg outline-none"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0F1B17] rounded-lg overflow-x-auto w-fit max-w-full">
          {(['All', ...INVOICE_STATUSES] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === status
                  ? 'bg-white dark:bg-[#162922] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-8 h-8 text-slate-300 dark:text-emerald-900 mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {invoices.length === 0
                ? 'No commercial invoices created yet. Create your first invoice or convert an accepted quotation.'
                : 'No invoices match your current search or filters.'}
            </p>
            {invoices.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Invoice
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-emerald-950 text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0C1613]">
                  <th className="py-3 px-5 font-medium">Invoice No</th>
                  <th className="py-3 px-4 font-medium">Customer</th>
                  <th className="py-3 px-4 font-medium">Issue / Due</th>
                  <th className="py-3 px-4 font-medium text-right">Grand Total</th>
                  <th className="py-3 px-4 font-medium text-right">Paid</th>
                  <th className="py-3 px-4 font-medium text-right">Balance Due</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-emerald-950/70">
                {filtered.map((inv) => {
                  const eff = getEffectiveInvoiceStatus(inv);
                  const canRecordPay =
                    eff !== 'Cancelled' && eff !== 'Paid' && inv.balanceDue > 0.01;
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#13221D]/60 transition-colors"
                    >
                      <td className="py-3.5 px-5 font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {inv.customerName}
                        </p>
                        <p className="text-[11px] text-slate-500">{inv.currency}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <p>{formatDisplayDate(inv.issueDate)}</p>
                        <p className="text-slate-400">Due: {formatDisplayDate(inv.dueDate)}</p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(inv.grandTotal, inv.currency)}
                        </p>
                        {inv.currency !== 'INR' && (
                          <p className="text-[11px] text-slate-500">
                            {formatINR(inv.grandTotalInr)}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        {formatCurrency(inv.amountPaid, inv.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(inv.balanceDue, inv.currency)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusText status={eff} />
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {canRecordPay && (
                            <button
                              type="button"
                              onClick={() => openPaymentForInvoice(inv.id)}
                              title="Record Payment"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#064E3B] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md cursor-pointer"
                            >
                              <CreditCard className="w-3 h-3" />
                              Pay
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(inv)}
                            aria-label="Preview / Print invoice"
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#172A23] cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadInvoicePdf(inv, settings)}
                            aria-label="Download Invoice PDF"
                            className="p-1.5 rounded-md text-slate-500 hover:text-[#064E3B] dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#172A23] cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
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
                            aria-label="Share on WhatsApp"
                            title="Share via WhatsApp"
                            className="p-1.5 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-[#172A23]"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                          {inv.status !== 'Cancelled' && (
                            <button
                              type="button"
                              onClick={() => openEdit(inv)}
                              aria-label="Edit invoice"
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#172A23] cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {inv.status !== 'Cancelled' && inv.amountPaid === 0 && (
                            <button
                              type="button"
                              onClick={() => setCancelTarget(inv)}
                              aria-label="Cancel invoice"
                              title="Cancel Invoice"
                              className="p-1.5 rounded-md text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {inv.amountPaid === 0 && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(inv)}
                              aria-label="Delete invoice"
                              className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Create / Edit Invoice Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl shadow-xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  {editing
                    ? `Edit Commercial Invoice (${editing.invoiceNumber})`
                    : 'New Commercial Invoice'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Non-GST commercial invoice — no GST/CGST/SGST/IGST lines applied.
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

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Customer *
                  </label>
                  <select
                    required
                    value={form.customerId}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.customerCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={form.currency}
                    onChange={(e) => {
                      const nextCurr = e.target.value as CurrencyCode;
                      setForm({
                        ...form,
                        currency: nextCurr,
                        exchangeRate: nextCurr === 'INR' ? 1 : form.exchangeRate,
                        exchangeRateSource:
                          nextCurr === 'INR' ? 'Base Currency (INR)' : form.exchangeRateSource,
                      });
                    }}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Invoice State
                  </label>
                  <select
                    value={form.status === 'Paid' ? 'Unpaid' : form.status}
                    disabled={Boolean(editing && editing.amountPaid > 0)}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as InvoiceStatus })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none disabled:opacity-60"
                  >
                    <option value="Draft">Draft (Not billed yet)</option>
                    <option value="Unpaid">Unpaid (Issued)</option>
                    {editing && <option value="Cancelled">Cancelled</option>}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Status updates to Partially Paid / Paid automatically via Payments.
                  </p>
                </div>

                {form.currency !== 'INR' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Manual Rate (1 {form.currency} → INR) *
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
                        className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                        placeholder="e.g. HDFC Forex / Wise Rate"
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none"
                      />
                    </div>
                  </>
                )}
              </div>

              <LineItemsEditor
                items={form.items}
                services={services}
                currency={form.currency}
                onChange={(items) => setForm({ ...form, items })}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-100 dark:border-emerald-950">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Discount Type
                      </label>
                      <select
                        value={form.discountType}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            discountType: e.target.value as 'fixed' | 'percent',
                          })
                        }
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                      >
                        <option value="fixed">Fixed ({form.currency})</option>
                        <option value="percent">Percentage (%)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Discount Value
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.discountValue}
                        onChange={(e) =>
                          setForm({ ...form, discountValue: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Payment Instructions
                    </label>
                    <textarea
                      rows={2}
                      maxLength={FIELD_LIMITS.defaultPaymentInstructions}
                      value={form.paymentInstructions}
                      onChange={(e) => setForm({ ...form, paymentInstructions: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Invoice Notes
                    </label>
                    <textarea
                      rows={2}
                      maxLength={FIELD_LIMITS.docNotes}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0C1613] border border-slate-200 dark:border-emerald-950 space-y-2.5 text-xs h-fit">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(totals.subtotal, form.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Discount</span>
                    <span className="font-mono tabular-nums text-red-600">
                      - {formatCurrency(totals.discountAmount, form.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2.5 border-t border-slate-200 dark:border-emerald-900 text-sm font-semibold">
                    <span className="text-slate-900 dark:text-white">Grand Total</span>
                    <span className="font-mono tabular-nums text-[#064E3B] dark:text-emerald-400">
                      {formatCurrency(totals.total, form.currency)}
                    </span>
                  </div>
                  {form.currency !== 'INR' && (
                    <div className="flex justify-between text-slate-500">
                      <span>INR Equivalent (@ {totals.exchangeRate})</span>
                      <span className="font-mono tabular-nums">{formatINR(totals.totalInr)}</span>
                    </div>
                  )}
                  <p className="pt-2 text-[11px] text-slate-500 border-t border-slate-200/70 dark:border-emerald-950">
                    Non-GST Commercial Invoice · AM PIXEL STUDIO is not GST registered.
                  </p>
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
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DocumentPreviewModal
        doc={previewDoc ? { type: 'invoice', data: previewDoc } : null}
        settings={settings}
        onClose={() => setPreviewDoc(null)}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel Invoice"
        description={`Mark ${cancelTarget?.invoiceNumber} as Cancelled? Cancelled invoices are excluded from revenue and pending balances.`}
        confirmLabel="Cancel Invoice"
        danger
        loading={cancelling}
        onConfirm={handleCancelInvoice}
        onCancel={() => setCancelTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Invoice"
        description={`Permanently delete invoice ${deleteTarget?.invoiceNumber}? Only invoices with zero recorded payments can be deleted.`}
        confirmLabel="Delete Invoice"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
