import React, { useMemo, useState } from 'react';
import { Briefcase, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import {
  CURRENCIES,
  FIELD_LIMITS,
  PROJECT_STATUSES,
  type CurrencyCode,
  type Project,
  type ProjectStatus,
} from '../types/erp';
import {
  createProject,
  deleteProject,
  updateProject,
  type ProjectInput,
} from '../lib/erpService';
import { addDaysISO, formatCurrency, formatDisplayDate, todayISO } from '../lib/format';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusText } from '../components/StatusText';

export const ProjectsPage: React.FC = () => {
  const { user, projects, customers, services, quotations, invoices, settings, notify, setActivePage } =
    useErp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ProjectStatus>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState<ProjectInput>({
    customerId: '',
    customerName: '',
    projectName: '',
    serviceId: '',
    serviceName: '',
    startDate: todayISO(),
    deadline: addDaysISO(todayISO(), 10),
    budget: 0,
    currency: 'INR',
    status: 'New',
    progress: 0,
    notes: '',
    linkedQuotationId: '',
    linkedInvoiceId: '',
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.projectName.toLowerCase().includes(q) ||
        p.projectCode.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        p.serviceName.toLowerCase().includes(q)
      );
    });
  }, [projects, search, statusFilter]);

  const openCreate = () => {
    if (customers.length === 0) {
      notify('Please add at least one customer before creating a project.', 'info');
      setActivePage('customers');
      return;
    }
    const firstCustomer = customers[0];
    setEditing(null);
    setForm({
      customerId: firstCustomer.id,
      customerName: firstCustomer.fullName,
      projectName: '',
      serviceId: '',
      serviceName: '',
      startDate: todayISO(),
      deadline: addDaysISO(todayISO(), 10),
      budget: 0,
      currency: settings.defaultCurrency || 'INR',
      status: 'New',
      progress: 0,
      notes: '',
      linkedQuotationId: '',
      linkedInvoiceId: '',
    });
    setModalOpen(true);
  };

  const openEdit = (prj: Project) => {
    setEditing(prj);
    setForm({
      customerId: prj.customerId,
      customerName: prj.customerName,
      projectName: prj.projectName,
      serviceId: prj.serviceId,
      serviceName: prj.serviceName,
      startDate: prj.startDate,
      deadline: prj.deadline,
      budget: prj.budget,
      currency: prj.currency,
      status: prj.status,
      progress: prj.progress,
      notes: prj.notes,
      linkedQuotationId: prj.linkedQuotationId,
      linkedInvoiceId: prj.linkedInvoiceId,
    });
    setModalOpen(true);
  };

  const handleCustomerChange = (customerId: string) => {
    const c = customers.find((x) => x.id === customerId);
    setForm((prev) => ({
      ...prev,
      customerId,
      customerName: c?.fullName || '',
    }));
  };

  const handleServiceChange = (serviceId: string) => {
    const s = services.find((x) => x.id === serviceId);
    setForm((prev) => ({
      ...prev,
      serviceId,
      serviceName: s?.name || '',
      budget: prev.budget === 0 && s ? s.defaultPrice : prev.budget,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.customerId || !form.projectName.trim()) {
      notify('Customer and project name are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const normalized: ProjectInput = {
        ...form,
        progress: form.status === 'Completed' ? 100 : form.progress,
      };
      if (editing) {
        await updateProject(editing.id, normalized);
        notify(`Updated project "${form.projectName}".`);
      } else {
        await createProject(user.uid, normalized);
        notify(`Created project "${form.projectName}".`);
      }
      setModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save project.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProject(deleteTarget.id);
      notify(`Deleted project "${deleteTarget.projectName}".`, 'info');
      setDeleteTarget(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete project.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const customerQuotations = useMemo(
    () => quotations.filter((q) => q.customerId === form.customerId),
    [quotations, form.customerId],
  );
  const customerInvoices = useMemo(
    () => invoices.filter((i) => i.customerId === form.customerId),
    [invoices, form.customerId],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Creative Project Tracker
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track deliverables, deadlines, budgets, progress, and linked commercial documents.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Search & Status Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by title, ID, customer, or service..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-lg outline-none focus:border-[#064E3B]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0F1B17] rounded-lg overflow-x-auto">
          {(['All', ...PROJECT_STATUSES] as const).map((status) => (
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
            <Briefcase className="w-8 h-8 text-slate-300 dark:text-emerald-900 mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {projects.length === 0
                ? 'No creative projects tracked yet. Start a new project linked to a client and service.'
                : 'No projects match your current search or filter.'}
            </p>
            {projects.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Project
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-emerald-950 text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0C1613]">
                  <th className="py-3 px-5 font-medium">Project</th>
                  <th className="py-3 px-4 font-medium">Customer &amp; Service</th>
                  <th className="py-3 px-4 font-medium">Timeline</th>
                  <th className="py-3 px-4 font-medium text-right">Budget</th>
                  <th className="py-3 px-4 font-medium">Progress</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Linked Docs</th>
                  <th className="py-3 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-emerald-950/70">
                {filtered.map((prj) => {
                  const linkedQt = quotations.find((q) => q.id === prj.linkedQuotationId);
                  const linkedInv = invoices.find((i) => i.id === prj.linkedInvoiceId);
                  return (
                    <tr
                      key={prj.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#13221D]/60 transition-colors"
                    >
                      <td className="py-3.5 px-5">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {prj.projectName}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500">{prj.projectCode}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-slate-800 dark:text-slate-200 font-medium">
                          {prj.customerName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {prj.serviceName || 'Custom Scope'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <p>Start: {formatDisplayDate(prj.startDate)}</p>
                        <p className="text-slate-500">Due: {formatDisplayDate(prj.deadline)}</p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                        {formatCurrency(prj.budget, prj.currency)}
                      </td>
                      <td className="py-3.5 px-4 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-200 dark:bg-emerald-950 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#064E3B] dark:bg-emerald-400 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, prj.progress))}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] tabular-nums text-slate-600 dark:text-slate-400">
                            {prj.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusText status={prj.status} />
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {linkedQt || linkedInv ? (
                          <div className="space-y-0.5">
                            {linkedQt && <p>{linkedQt.quotationNumber}</p>}
                            {linkedInv && (
                              <p className="text-[#064E3B] dark:text-emerald-400">
                                {linkedInv.invoiceNumber}
                              </p>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(prj)}
                            aria-label="Edit project"
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#172A23] cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(prj)}
                            aria-label="Delete project"
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

      {/* Add/Edit Project Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl shadow-xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {editing ? `Edit Project (${editing.projectCode})` : 'New Creative Project'}
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
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.projectName}
                    value={form.projectName}
                    onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                    placeholder="e.g. Onam Brand Campaign & AI Video Ad"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                  />
                </div>

                <div>
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
                    Service Category
                  </label>
                  <select
                    value={form.serviceId}
                    onChange={(e) => handleServiceChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                  >
                    <option value="">Custom / Multiple Services</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Project Budget
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={form.currency}
                      onChange={(e) =>
                        setForm({ ...form, currency: e.target.value as CurrencyCode })
                      }
                      className="w-24 px-2 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.budget}
                      onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
                      className="flex-1 px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as ProjectStatus })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
                  >
                    {PROJECT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <span>Progress Percentage</span>
                    <span className="font-mono">{form.progress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={form.progress}
                    onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
                    className="w-full accent-[#064E3B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Linked Quotation (Optional)
                  </label>
                  <select
                    value={form.linkedQuotationId}
                    onChange={(e) => setForm({ ...form, linkedQuotationId: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none"
                  >
                    <option value="">None</option>
                    {customerQuotations.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.quotationNumber} ({formatCurrency(q.total, q.currency)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Linked Invoice (Optional)
                  </label>
                  <select
                    value={form.linkedInvoiceId}
                    onChange={(e) => setForm({ ...form, linkedInvoiceId: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none"
                  >
                    <option value="">None</option>
                    {customerInvoices.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.invoiceNumber} ({formatCurrency(i.grandTotal, i.currency)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Project Notes &amp; Brief
                </label>
                <textarea
                  rows={3}
                  maxLength={FIELD_LIMITS.projectNotes}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Deliverable specs, dimensions, brand references, feedback milestones..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg outline-none focus:border-[#064E3B]"
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
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Project"
        description={`Delete project "${deleteTarget?.projectName}" (${deleteTarget?.projectCode})? Linked quotations and invoices will not be deleted.`}
        confirmLabel="Delete Project"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
