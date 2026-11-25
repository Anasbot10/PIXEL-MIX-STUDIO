import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Bell,
  Briefcase,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Search,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';
import type { NavPage } from '../types/erp';
import { formatDisplayDate, formatINR, getEffectiveInvoiceStatus, todayISO } from '../lib/format';

const NAV_ITEMS: Array<{ id: NavPage; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'projects', label: 'Projects', icon: Briefcase },
  { id: 'services', label: 'Services', icon: Layers },
  { id: 'quotations', label: 'Quotations', icon: FileSpreadsheet },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'payments', label: 'Payments & Receipts', icon: CreditCard },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    logout,
    settings,
    activePage,
    setActivePage,
    theme,
    toggleTheme,
    toasts,
    dismissToast,
    customers,
    projects,
    quotations,
    invoices,
    payments,
    expenses,
    openPaymentForInvoice,
  } = useErp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const currentNav = NAV_ITEMS.find((n) => n.id === activePage) || NAV_ITEMS[0];

  // Real notifications derived exclusively from saved Firestore records
  const notifications = useMemo(() => {
    const today = todayISO();
    const list: Array<{
      id: string;
      title: string;
      subtitle: string;
      severity: 'high' | 'medium';
      actionLabel: string;
      onAction: () => void;
    }> = [];

    invoices.forEach((inv) => {
      const eff = getEffectiveInvoiceStatus(inv);
      if (eff === 'Overdue') {
        list.push({
          id: `inv-${inv.id}`,
          title: `Overdue Invoice ${inv.invoiceNumber}`,
          subtitle: `${inv.customerName} · Due ${formatDisplayDate(inv.dueDate)} · ${formatINR(inv.balanceDueInr)}`,
          severity: 'high',
          actionLabel: 'Record Payment',
          onAction: () => {
            setNotifOpen(false);
            openPaymentForInvoice(inv.id);
          },
        });
      }
    });

    projects.forEach((p) => {
      if (
        p.status !== 'Completed' &&
        p.status !== 'Cancelled' &&
        p.deadline &&
        p.deadline <= today
      ) {
        list.push({
          id: `prj-${p.id}`,
          title: `Project Deadline Reached: ${p.projectName}`,
          subtitle: `${p.customerName} · Due ${formatDisplayDate(p.deadline)} · ${p.progress}%`,
          severity: 'medium',
          actionLabel: 'View Projects',
          onAction: () => {
            setNotifOpen(false);
            setActivePage('projects');
          },
        });
      }
    });

    quotations.forEach((q) => {
      if ((q.status === 'Draft' || q.status === 'Sent') && q.validityDate && q.validityDate < today) {
        list.push({
          id: `qt-${q.id}`,
          title: `Quotation Validity Passed: ${q.quotationNumber}`,
          subtitle: `${q.customerName} · Expired ${formatDisplayDate(q.validityDate)}`,
          severity: 'medium',
          actionLabel: 'Review',
          onAction: () => {
            setNotifOpen(false);
            setActivePage('quotations');
          },
        });
      }
    });

    return list.slice(0, 10);
  }, [invoices, projects, quotations, openPaymentForInvoice, setActivePage]);

  // Global search across all modules
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{ id: string; category: string; title: string; meta: string; page: NavPage }> = [];

    customers
      .filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.customerCode.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q),
      )
      .slice(0, 4)
      .forEach((c) =>
        results.push({
          id: `c-${c.id}`,
          category: 'Customer',
          title: c.fullName,
          meta: `${c.customerCode}${c.companyName ? ` · ${c.companyName}` : ''}`,
          page: 'customers',
        }),
      );

    invoices
      .filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q),
      )
      .slice(0, 4)
      .forEach((i) =>
        results.push({
          id: `i-${i.id}`,
          category: 'Invoice',
          title: i.invoiceNumber,
          meta: `${i.customerName} · ${formatINR(i.grandTotalInr)}`,
          page: 'invoices',
        }),
      );

    quotations
      .filter(
        (qt) =>
          qt.quotationNumber.toLowerCase().includes(q) ||
          qt.customerName.toLowerCase().includes(q),
      )
      .slice(0, 3)
      .forEach((qt) =>
        results.push({
          id: `q-${qt.id}`,
          category: 'Quotation',
          title: qt.quotationNumber,
          meta: `${qt.customerName} · ${formatINR(qt.totalInr)}`,
          page: 'quotations',
        }),
      );

    projects
      .filter(
        (p) =>
          p.projectName.toLowerCase().includes(q) ||
          p.projectCode.toLowerCase().includes(q) ||
          p.customerName.toLowerCase().includes(q),
      )
      .slice(0, 3)
      .forEach((p) =>
        results.push({
          id: `p-${p.id}`,
          category: 'Project',
          title: p.projectName,
          meta: `${p.projectCode} · ${p.customerName}`,
          page: 'projects',
        }),
      );

    payments
      .filter(
        (p) =>
          p.receiptNumber.toLowerCase().includes(q) ||
          p.customerName.toLowerCase().includes(q) ||
          p.invoiceNumber.toLowerCase().includes(q),
      )
      .slice(0, 3)
      .forEach((p) =>
        results.push({
          id: `pay-${p.id}`,
          category: 'Receipt',
          title: p.receiptNumber,
          meta: `${p.customerName} · ${formatINR(p.netAmountReceivedInr)}`,
          page: 'payments',
        }),
      );

    expenses
      .filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.expenseCode.toLowerCase().includes(q) ||
          e.vendor.toLowerCase().includes(q),
      )
      .slice(0, 3)
      .forEach((e) =>
        results.push({
          id: `exp-${e.id}`,
          category: 'Expense',
          title: e.description,
          meta: `${e.expenseCode} · ${formatINR(e.netAmountInr)}`,
          page: 'expenses',
        }),
      );

    return results.slice(0, 12);
  }, [searchQuery, customers, invoices, quotations, projects, payments, expenses]);

  const handleSelectNav = (page: NavPage) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#06392B] dark:bg-[#0A1713] text-emerald-50 border-r border-emerald-950/50">
      {/* Brand Logo Area */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => handleSelectNav('dashboard')}
          className="flex items-center gap-3 text-left min-w-0 cursor-pointer"
        >
          {settings.logoDataUrl ? (
            <img
              src={settings.logoDataUrl}
              alt={settings.businessName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-[#D4B068]/40 text-[#E6C983] font-display font-bold text-sm flex items-center justify-center shrink-0">
              AM
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display font-bold text-sm tracking-tight text-white truncate">
              {settings.businessName || 'AM PIXEL STUDIO'}
            </p>
            <p className="text-[11px] text-[#D4B068] truncate">Business Manager</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 text-emerald-200 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-white/12 text-white shadow-xs'
                  : 'text-emerald-100/75 hover:text-white hover:bg-white/6'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-[#E6C983]' : 'text-emerald-300/70'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom User & Sign Out */}
      <div className="p-4 border-t border-white/10 space-y-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#B89146]/25 border border-[#D4B068]/40 text-[#E6C983] font-display font-semibold text-xs flex items-center justify-center shrink-0">
            {(user?.displayName || user?.email || 'A').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate">
              {user?.displayName || 'Studio Admin'}
            </p>
            <p className="text-[11px] text-emerald-200/70 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-emerald-100/85 hover:text-white bg-white/6 hover:bg-white/12 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F9F8] dark:bg-[#08100D] text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{renderSidebarContent()}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-30 h-16 bg-white/95 dark:bg-[#0C1613]/95 backdrop-blur-sm border-b border-slate-200 dark:border-emerald-950 px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Left: Mobile Trigger + Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13231D] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {currentNav.label}
              </h1>
            </div>
          </div>

          {/* Center: Global Search */}
          <div className="relative flex-1 max-w-md hidden sm:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 180)}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients, invoices, projects, receipts..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-100/80 dark:bg-[#12201B] border border-transparent focus:border-[#064E3B] dark:focus:border-emerald-600 focus:bg-white dark:focus:bg-[#101C18] rounded-lg outline-none transition-colors text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {searchFocused && searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl shadow-lg overflow-hidden z-40">
                {searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    No matching records found for &ldquo;{searchQuery}&rdquo;.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-emerald-950/70 max-h-80 overflow-y-auto">
                    {searchResults.map((res) => (
                      <li key={res.id}>
                        <button
                          type="button"
                          onMouseDown={() => {
                            setActivePage(res.page);
                            setSearchQuery('');
                            setSearchFocused(false);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-[#152620] flex items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                              {res.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {res.meta}
                            </p>
                          </div>
                          <span className="text-[11px] font-medium text-[#064E3B] dark:text-emerald-400 shrink-0">
                            {res.category}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Right: Notification Center + Theme Switch */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Notifications"
                className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13231D] transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-mono font-semibold flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl shadow-xl z-40 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-emerald-950 flex items-center justify-between">
                      <span className="font-display text-xs font-semibold text-slate-900 dark:text-white">
                        Alerts &amp; Reminders ({notifications.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        All caught up. No overdue invoices or urgent deadlines.
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-emerald-950/70 max-h-80 overflow-y-auto">
                        {notifications.map((n) => (
                          <li key={n.id} className="p-3.5 hover:bg-slate-50 dark:hover:bg-[#14241E]">
                            <div className="flex items-start gap-2.5">
                              <AlertCircle
                                className={`w-4 h-4 mt-0.5 shrink-0 ${
                                  n.severity === 'high' ? 'text-red-500' : 'text-amber-500'
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                                  {n.title}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {n.subtitle}
                                </p>
                                <button
                                  type="button"
                                  onClick={n.onAction}
                                  className="mt-1.5 text-[11px] font-semibold text-[#064E3B] dark:text-emerald-400 hover:underline cursor-pointer"
                                >
                                  {n.actionLabel}
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle dark or light theme"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13231D] transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Toasts */}
      {toasts.length > 0 && (
        <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium ${
                t.type === 'error'
                  ? 'bg-red-600 text-white border-red-700'
                  : t.type === 'info'
                    ? 'bg-slate-900 text-white border-slate-800'
                    : 'bg-[#064E3B] text-white border-emerald-800'
              }`}
            >
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss message"
                className="opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
