import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Download,
  Eye,
  FileSpreadsheet,
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
  QUOTATION_STATUSES,
  type CurrencyCode,
  type Quotation,
  type QuotationStatus,
} from '../types/erp';
import {
  calculateDocumentTotals,
  convertQuotationToInvoice,
  createQuotation,
  deleteQuotation,
  updateQuotation,
  type QuotationInput,
} from '../lib/erpService';
import {
  addDaysISO,
  formatCurrency,
  formatDisplayDate,
  formatINR,
  todayISO,
} from '../lib/format';
import { downloadQuotationPdf } from '../lib/pdfGenerator';
import { LineItemsEditor } from '../components/LineItemsEditor';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusText } from '../components/StatusText';

export const QuotationsPage: React.FC = () => {
  const {
    user,
    quotations,
    customers,
    services,
    settings,
    notify,
    setActivePage,
    quickCreateIntent,
  } = useErp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | QuotationStatus>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Quotation | null>(null);
  const [convertTarget, setConvertTarget] = useState<Quotation | null>(null);
  const [converting, setConverting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState<QuotationInput>({
    customerId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    issueDate: todayISO(),
    validityDate: addDaysISO(todayISO(), 15),
    currency: 'INR',
    exchangeRate: 1,
    exchangeRateSource: 'Base Currency (INR)',
    items: [{ serviceId: '', name: '', description: '', quantity: 1, unitPrice: 0, total: 0 }],
    discountType: 'fixed',
    discountValue: 0,
    status: 'Draft',
    notes: '',
    terms: '',
  });

  const openCreate = () => {
    if (customers.length === 0) {
      notify('Please add a customer first before creating a quotation.', 'info');
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
      validityDate: addDaysISO(todayISO(), 15),
      currency: settings.defaultCurrency || 'INR',
      exchangeRate: 1,
      exchangeRateSource: 'Base Currency (INR)',
      items: [{ serviceId: '', name: '', description: '', quantity: 1, unitPrice: 0, total: 0 }],
      discountType: 'fixed',
      discountValue: 0,
      status: 'Draft',
      notes: '',
      terms: settings.defaultTerms,
    });
    setModalOpen(true);
  };

  useEffect(() => {
    if (quickCreateIntent?.page === 'quotations') {
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCreateIntent]);

  const openEdit = (qt: Quotation) => {
    setEditing(qt);
    setForm({
      customerId: qt.customerId,
      customerName: qt.customerName,
      customerEmail: qt.customerEmail,
      customerPhone: qt.customerPhone,
      customerAddress: qt.customerAddress,
      issueDate: qt.issueDate,
      validityDate: qt.validityDate,
      currency: qt.currency,
      exchangeRate: qt.exchangeRate,
      exchangeRateSource: qt.exchangeRateSource,
      items: qt.items.map((x) => ({ ...x })),
      discountType: qt.discountType,
      discountValue: qt.discountValue,
      status: qt.status,
      notes: qt.notes,
      terms: qt.terms,
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
    return quotations.filter((qt) => {
      if (statusFilter !== 'All' && qt.status !== statusFilter) return false;
      if (!q) return true;
      return (
        qt.quotationNumber.toLowerCase().includes(q) ||
        qt.customerName.toLowerCase().includes(q)
      );
    });
  }, [quotations, search, statusFilter]);

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
        await updateQuotation(editing.id, {
          ...form,
          convertedInvoiceId: editing.convertedInvoiceId,
        });
        notify(`Updated quotation ${editing.quotationNumber}.`);
      } else {
        await createQuotation(user.uid, form);
        notify('Quotation created successfully.');
      }
      setModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save quotation.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async () => {
    if (!user || !convertTarget) return;
    setConverting(true);
    try {
      await convertQuotationToInvoice(
        user.uid,
        convertTarget,
        addDaysISO(todayISO(), 14),
        settings.defaultPaymentInstructions,
      );
      notify(`Converted ${convertTarget.quotationNumber} into a Commercial Invoice.`, 'success');
      setConvertTarget(null);
      setActivePage('invoices');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to convert quotation.', 'error');
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteQuotation(deleteTarget.id);
      notify(`Deleted quotation ${deleteTarget.quotationNumber}.`, 'info');
      setDeleteTarget(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete quotation.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Quotation Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Create itemized studio estimates, download PDFs, and convert accepted quotes to invoices.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Quotation
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by quotation number or customer..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-lg outline-none focus:border-[#064E3B]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0F1B17] rounded-lg overflow-x-auto">
          {(['All', ...QUOTATION_STATUSES] as const).map((status) => (
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

      {/* Quotations Table */}
      <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileSpreadsheet className="w-8 h-8 text-slate-300 dark:text-emerald-900 mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {quotations.length === 0
                ? 'No quotations created yet. Build your first client estimate in seconds.'
                : 'No quotations match your current search or filter.'}
            </p>
            {quotations.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Quotation
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-emerald-950 text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0C1613]">
                  <th className="py-3 px-5 font-medium">Quotation No</th>
                  <th className="py-3 px-4 font-medium">Customer</th>
                  <th className="py-3 px-4 font-medium">Issue / Valid Until</th>
                  <th className="py-3 px-4 font-medium text-right">Total</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-emerald-950/70">
                {filtered.map((qt) => (
                  <tr
                    key={qt.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#13221D]/60 transition-colors"
                  >
                    <td className="py-3.5 px-5 font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {qt.quotationNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {qt.customerName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {qt.items.length} item{qt.items.length === 1 ? '' : 's'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      <p>{formatDisplayDate(qt.issueDate)}</p>
                      <p className="text-slate-400">Valid: {formatDisplayDate(qt.validityDate)}</p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(qt.total, qt.currency)}
                      </p>
                      {qt.currency !== 'INR' && (
                        <p className="text-[11px] text-slate-500">{formatINR(qt.totalInr)}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusText status={qt.status} />
                      {qt.convertedInvoiceId && (
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                          Converted to Invoice
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {!qt.convertedInvoiceId && (
                          <button
                            type="button"
                            onClick={() => setConvertTarget(qt)}
                            title="Convert to Commercial Invoice"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#064E3B] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            To Invoice
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(qt)}
                          aria-label="Preview quotation"
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#172A23] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadQuotationPdf(qt, settings)}
                          aria-label="Download PDF"
                          className="p-1.5 rounded-md text-slate-500 hover:text-[#064E3B] dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#172A23] cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(qt)}
                          aria-label="Edit quotation"
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#172A23] cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(qt)}
                          aria-label="Delete quotation"
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

      {/* Create/Edit Quotation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl shadow-xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950 flex items-center justify-between shrink-0">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {editing ? `Edit Quotation (${editing.quotationNumber})` : 'Create Quotation'}
              </h3>
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
                    Issue Date
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
                    Validity Date
                  </label>
                  <input
                    type="date"
                    value={form.validityDate}
                    onChange={(e) => setForm({ ...form, validityDate: e.target.value })}
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
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as QuotationStatus })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none"
                  >
                    {QUOTATION_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
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
                        placeholder="e.g. RBI Reference / Bank Quote"
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

              {/* Discount + Totals */}
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
                      Terms &amp; Conditions
                    </label>
                    <textarea
                      rows={3}
                      maxLength={FIELD_LIMITS.defaultTerms}
                      value={form.terms}
                      onChange={(e) => setForm({ ...form, terms: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Notes
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
                    <span className="text-slate-900 dark:text-white">Estimated Total</span>
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
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Save Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DocumentPreviewModal
        doc={previewDoc ? { type: 'quotation', data: previewDoc } : null}
        settings={settings}
        onClose={() => setPreviewDoc(null)}
      />

      <ConfirmDialog
        open={Boolean(convertTarget)}
        title="Convert Quotation to Commercial Invoice"
        description={`Convert ${convertTarget?.quotationNumber} (${convertTarget?.customerName}) into a new Unpaid Non-GST Commercial Invoice? The quotation will be marked Accepted and linked automatically.`}
        confirmLabel="Convert to Invoice"
        loading={converting}
        onConfirm={handleConvert}
        onCancel={() => setConvertTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Quotation"
        description={`Permanently delete quotation ${deleteTarget?.quotationNumber}?`}
        confirmLabel="Delete Quotation"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
