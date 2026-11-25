import React, { useMemo, useState } from 'react';
import { Layers, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import {
  CURRENCIES,
  FIELD_LIMITS,
  type CurrencyCode,
  type ServiceItem,
} from '../types/erp';
import {
  createService,
  deleteService,
  seedStarterServices,
  updateService,
  type ServiceInput,
} from '../lib/erpService';
import { formatCurrency } from '../lib/format';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusText } from '../components/StatusText';

const EMPTY_SERVICE: ServiceInput = {
  name: '',
  description: '',
  defaultPrice: 0,
  currency: 'INR',
  estimatedDelivery: '3–5 days',
  isActive: true,
};

export const ServicesPage: React.FC = () => {
  const { user, services, settings, notify } = useErp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState<ServiceInput>(EMPTY_SERVICE);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (statusFilter === 'active' && !s.isActive) return false;
      if (statusFilter === 'inactive' && s.isActive) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.estimatedDelivery.toLowerCase().includes(q)
      );
    });
  }, [services, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_SERVICE, currency: settings.defaultCurrency || 'INR' });
    setModalOpen(true);
  };

  const openEdit = (item: ServiceItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description,
      defaultPrice: item.defaultPrice,
      currency: item.currency,
      estimatedDelivery: item.estimatedDelivery,
      isActive: item.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) {
      notify('Service name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateService(editing.id, form);
        notify(`Updated service "${form.name}".`);
      } else {
        await createService(user.uid, form);
        notify(`Added service "${form.name}".`);
      }
      setModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save service.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: ServiceItem) => {
    try {
      await updateService(item.id, {
        name: item.name,
        description: item.description,
        defaultPrice: item.defaultPrice,
        currency: item.currency,
        estimatedDelivery: item.estimatedDelivery,
        isActive: !item.isActive,
      });
      notify(`Marked "${item.name}" as ${!item.isActive ? 'Active' : 'Inactive'}.`, 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update status.', 'error');
    }
  };

  const handleSeedStarter = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedStarterServices(user.uid);
      notify('Loaded 9 editable studio service templates. Customize prices anytime.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load templates.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteService(deleteTarget.id);
      notify(`Deleted service "${deleteTarget.name}".`, 'info');
      setDeleteTarget(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete service.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Services &amp; Price List
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Default rates are editable studio baselines — you can always override prices on any
            quotation or invoice.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {services.length === 0 && (
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedStarter}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#064E3B] dark:text-emerald-400 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {seeding ? 'Loading...' : 'Load Studio Starter Services'}
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services or delivery timelines..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-lg outline-none focus:border-[#064E3B]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0F1B17] rounded-lg">
          {(['all', 'active', 'inactive'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                statusFilter === tab
                  ? 'bg-white dark:bg-[#162922] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Layers className="w-8 h-8 text-slate-300 dark:text-emerald-900 mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              {services.length === 0
                ? 'Your service catalog is empty. Add services manually or load the 9 studio starter templates (editable anytime).'
                : 'No services match your search or status filter.'}
            </p>
            {services.length === 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={seeding}
                  onClick={handleSeedStarter}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg cursor-pointer"
                >
                  {seeding ? 'Loading...' : 'Load Studio Starter Services'}
                </button>
                <button
                  type="button"
                  onClick={openCreate}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162721] rounded-lg cursor-pointer"
                >
                  Create Custom Service
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-emerald-950 text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0C1613]">
                  <th className="py-3 px-5 font-medium">Service Name</th>
                  <th className="py-3 px-4 font-medium">Description</th>
                  <th className="py-3 px-4 font-medium text-right">Default Price</th>
                  <th className="py-3 px-4 font-medium">Est. Delivery</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-emerald-950/70">
                {filtered.map((srv) => (
                  <tr
                    key={srv.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#13221D]/60 transition-colors"
                  >
                    <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {srv.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-md">
                      <p className="line-clamp-2">{srv.description || '—'}</p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(srv.defaultPrice, srv.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {srv.estimatedDelivery || '—'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(srv)}
                        title="Click to toggle Active / Inactive"
                        className="cursor-pointer"
                      >
                        <StatusText status={srv.isActive ? 'Active' : 'Inactive'} />
                      </button>
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(srv)}
                          aria-label="Edit service"
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#172A23] cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(srv)}
                          aria-label="Delete service"
                          className="p-1.5 rounded-md text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
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

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {editing ? 'Edit Service' : 'Add New Service'}
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
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Service Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.serviceName}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. AI Video Advertisement"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  maxLength={FIELD_LIMITS.serviceDescription}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Scope, deliverables, and revision policy..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Default Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.defaultPrice}
                    onChange={(e) => setForm({ ...form, defaultPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={form.currency}
                    onChange={(e) =>
                      setForm({ ...form, currency: e.target.value as CurrencyCode })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
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
                    Est. Delivery
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.estimatedDelivery}
                    value={form.estimatedDelivery}
                    onChange={(e) => setForm({ ...form, estimatedDelivery: e.target.value })}
                    placeholder="3–5 days"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded accent-[#064E3B]"
                />
                Service is active and selectable in Quotations &amp; Invoices
              </label>

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
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Service"
        description={`Remove "${deleteTarget?.name}" from your service catalog? Existing quotations and invoices will remain unaffected.`}
        confirmLabel="Delete Service"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
