import React, { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';
import {
  CUSTOMER_TYPES,
  FIELD_LIMITS,
  type Customer,
  type CustomerType,
} from '../types/erp';
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
  type CustomerInput,
} from '../lib/erpService';
import {
  formatDisplayDate,
  formatINR,
  getEffectiveInvoiceStatus,
  roundMoney,
  todayISO,
} from '../lib/format';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusText } from '../components/StatusText';

const EMPTY_FORM: CustomerInput = {
  fullName: '',
  phone: '',
  email: '',
  address: '',
  companyName: '',
  customerType: 'Individual',
  notes: '',
  registrationDate: todayISO(),
};

export const CustomersPage: React.FC = () => {
  const { user, customers, invoices, payments, notify, quickCreateIntent, openPaymentForInvoice } =
    useErp();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | CustomerType>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (quickCreateIntent?.page === 'customers') {
      setEditing(null);
      setForm({ ...EMPTY_FORM, registrationDate: todayISO() });
      setModalOpen(true);
    }
  }, [quickCreateIntent]);

  // Precompute customer financial rollups from real invoices & payments
  const customerFinancials = useMemo(() => {
    const map = new Map<
      string,
      { billedInr: number; paidInr: number; balanceInr: number; invoiceCount: number }
    >();
    customers.forEach((c) => {
      const custInvoices = invoices.filter(
        (i) => i.customerId === c.id && i.status !== 'Draft' && i.status !== 'Cancelled',
      );
      const billedInr = roundMoney(
        custInvoices.reduce((sum, i) => sum + (i.grandTotalInr || 0), 0),
      );
      const custPayments = payments.filter((p) => p.customerId === c.id);
      const paidInr = roundMoney(
        custPayments.reduce((sum, p) => sum + (p.netAmountReceivedInr || 0), 0),
      );
      const balanceInr = roundMoney(
        custInvoices.reduce((sum, i) => sum + (i.balanceDueInr || 0), 0),
      );
      map.set(c.id, { billedInr, paidInr, balanceInr, invoiceCount: custInvoices.length });
    });
    return map;
  }, [customers, invoices, payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (typeFilter !== 'All' && c.customerType !== typeFilter) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.customerCode.toLowerCase().includes(q) ||
        c.companyName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    });
  }, [customers, search, typeFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, registrationDate: todayISO() });
    setModalOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setForm({
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      companyName: customer.companyName,
      customerType: customer.customerType,
      notes: customer.notes,
      registrationDate: customer.registrationDate,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.fullName.trim()) {
      notify('Customer full name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCustomer(editing.id, form);
        notify(`Updated customer ${form.fullName}.`);
      } else {
        await createCustomer(user.uid, form);
        notify(`Added customer ${form.fullName}.`);
      }
      setModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save customer.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCustomer(deleteTarget.id);
      notify(`Deleted customer ${deleteTarget.fullName}.`, 'info');
      if (detailCustomer?.id === deleteTarget.id) setDetailCustomer(null);
      setDeleteTarget(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete customer.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const detailInvoices = useMemo(
    () => (detailCustomer ? invoices.filter((i) => i.customerId === detailCustomer.id) : []),
    [detailCustomer, invoices],
  );
  const detailPayments = useMemo(
    () => (detailCustomer ? payments.filter((p) => p.customerId === detailCustomer.id) : []),
    [detailCustomer, payments],
  );

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Customer Directory &amp; CRM
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {customers.length} registered client{customers.length === 1 ? '' : 's'} with live
            billing and balance history
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, company, phone, or email..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-lg outline-none focus:border-[#064E3B] dark:focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0F1B17] rounded-lg overflow-x-auto">
          {(['All', ...CUSTOMER_TYPES] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                typeFilter === type
                  ? 'bg-white dark:bg-[#162922] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-8 h-8 text-slate-300 dark:text-emerald-900 mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {customers.length === 0
                ? 'No customers yet. Add your first client to start creating quotations, projects, and invoices.'
                : 'No customers match your current search or filter.'}
            </p>
            {customers.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add First Customer
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-emerald-950 text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0C1613]">
                  <th className="py-3 px-5 font-medium">Customer ID</th>
                  <th className="py-3 px-4 font-medium">Name / Company</th>
                  <th className="py-3 px-4 font-medium">Contact</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium text-right">Total Billed</th>
                  <th className="py-3 px-4 font-medium text-right">Total Paid</th>
                  <th className="py-3 px-4 font-medium text-right">Outstanding</th>
                  <th className="py-3 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-emerald-950/70">
                {filtered.map((cust) => {
                  const fin = customerFinancials.get(cust.id) || {
                    billedInr: 0,
                    paidInr: 0,
                    balanceInr: 0,
                    invoiceCount: 0,
                  };
                  return (
                    <tr
                      key={cust.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#13221D]/60 transition-colors"
                    >
                      <td className="py-3.5 px-5 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {cust.customerCode}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => setDetailCustomer(cust)}
                          className="text-left group cursor-pointer"
                        >
                          <p className="font-semibold text-slate-900 dark:text-white group-hover:text-[#064E3B] dark:group-hover:text-emerald-400">
                            {cust.fullName}
                          </p>
                          {cust.companyName && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {cust.companyName}
                            </p>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        <p className="font-mono text-[11px]">{cust.phone || '—'}</p>
                        {cust.email && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                            {cust.email}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {cust.customerType}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {formatINR(fin.billedInr)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatINR(fin.paidInr)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                        {formatINR(fin.balanceInr)}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailCustomer(cust)}
                            aria-label="View customer ledger"
                            className="p-1.5 rounded-md text-slate-500 hover:text-[#064E3B] dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#172A23] cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(cust)}
                            aria-label="Edit customer"
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#172A23] cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(cust)}
                            aria-label="Delete customer"
                            className="p-1.5 rounded-md text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Add / Edit Customer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl shadow-xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {editing ? `Edit Customer (${editing.customerCode})` : 'Add New Customer'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.fullName}
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="e.g. Rahul Menon"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Company Name (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.companyName}
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    placeholder="e.g. Malabar Roasters"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.phone}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    maxLength={FIELD_LIMITS.email}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="client@example.com"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Customer Type
                  </label>
                  <select
                    value={form.customerType}
                    onChange={(e) =>
                      setForm({ ...form, customerType: e.target.value as CustomerType })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                  >
                    {CUSTOMER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Registration Date
                  </label>
                  <input
                    type="date"
                    value={form.registrationDate}
                    onChange={(e) => setForm({ ...form, registrationDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Address
                </label>
                <textarea
                  rows={2}
                  maxLength={FIELD_LIMITS.address}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="City, District, Kerala, India"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                />
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
                  placeholder="Brand preferences, preferred delivery channels, billing notes..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-emerald-950">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#162721] rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer 360° Ledger Drawer */}
      {detailCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex justify-end">
          <div className="w-full max-w-2xl bg-white dark:bg-[#101C18] border-l border-slate-200 dark:border-emerald-950 h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-emerald-950">
              <div>
                <p className="font-mono text-xs text-[#B89146]">{detailCustomer.customerCode}</p>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {detailCustomer.fullName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {detailCustomer.companyName ? `${detailCustomer.companyName} · ` : ''}
                  {detailCustomer.customerType} · Registered{' '}
                  {formatDisplayDate(detailCustomer.registrationDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Summary */}
            {(() => {
              const fin = customerFinancials.get(detailCustomer.id) || {
                billedInr: 0,
                paidInr: 0,
                balanceInr: 0,
                invoiceCount: 0,
              };
              return (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-emerald-950 bg-slate-50/70 dark:bg-[#0C1613]">
                    <p className="text-[11px] text-slate-500">Total Billed</p>
                    <p className="font-mono text-base font-semibold tabular-nums mt-1">
                      {formatINR(fin.billedInr)}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-emerald-950 bg-slate-50/70 dark:bg-[#0C1613]">
                    <p className="text-[11px] text-slate-500">Total Paid</p>
                    <p className="font-mono text-base font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                      {formatINR(fin.paidInr)}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-emerald-950 bg-slate-50/70 dark:bg-[#0C1613]">
                    <p className="text-[11px] text-slate-500">Outstanding</p>
                    <p className="font-mono text-base font-semibold text-amber-700 dark:text-amber-400 tabular-nums mt-1">
                      {formatINR(fin.balanceInr)}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Contact Info */}
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              {detailCustomer.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono">{detailCustomer.phone}</span>
                </p>
              )}
              {detailCustomer.email && (
                <p className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{detailCustomer.email}</span>
                </p>
              )}
              {detailCustomer.address && (
                <p className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span>{detailCustomer.address}</span>
                </p>
              )}
              {detailCustomer.notes && (
                <p className="pt-2 text-slate-500 dark:text-slate-400">{detailCustomer.notes}</p>
              )}
            </div>

            {/* Customer Invoices */}
            <div className="space-y-2.5">
              <h4 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Invoice History ({detailInvoices.length})
              </h4>
              {detailInvoices.length === 0 ? (
                <p className="text-xs text-slate-500">No invoices recorded for this customer.</p>
              ) : (
                <div className="border border-slate-200 dark:border-emerald-950 rounded-lg divide-y divide-slate-100 dark:divide-emerald-950/70">
                  {detailInvoices.map((inv) => {
                    const eff = getEffectiveInvoiceStatus(inv);
                    return (
                      <div
                        key={inv.id}
                        className="p-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-mono font-semibold text-slate-900 dark:text-white">
                            {inv.invoiceNumber}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {formatDisplayDate(inv.issueDate)} · Due {formatDisplayDate(inv.dueDate)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-semibold tabular-nums">
                            {formatINR(inv.grandTotalInr)}
                          </p>
                          <div className="flex items-center justify-end gap-2 mt-0.5">
                            <StatusText status={eff} />
                            {inv.balanceDueInr > 0.01 && inv.status !== 'Cancelled' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDetailCustomer(null);
                                  openPaymentForInvoice(inv.id);
                                }}
                                className="text-[11px] font-semibold text-[#064E3B] dark:text-emerald-400 hover:underline cursor-pointer"
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Customer Payments */}
            <div className="space-y-2.5">
              <h4 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Payment Transaction History ({detailPayments.length})
              </h4>
              {detailPayments.length === 0 ? (
                <p className="text-xs text-slate-500">No payments recorded for this customer.</p>
              ) : (
                <div className="border border-slate-200 dark:border-emerald-950 rounded-lg divide-y divide-slate-100 dark:divide-emerald-950/70">
                  {detailPayments.map((pay) => (
                    <div
                      key={pay.id}
                      className="p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-mono font-medium text-slate-900 dark:text-white">
                          {pay.receiptNumber} · {pay.invoiceNumber}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {formatDisplayDate(pay.paymentDate)} · {pay.paymentMethod} ({pay.paymentType})
                        </p>
                      </div>
                      <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        + {formatINR(pay.netAmountReceivedInr)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Customer"
        description={`Are you sure you want to remove ${deleteTarget?.fullName}? Existing invoices and payments will keep their saved customer snapshot, but this CRM record will be permanently removed.`}
        confirmLabel="Delete Customer"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
