import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  createDefaultSettings,
  type BusinessSettings,
  type Customer,
  type Expense,
  type Invoice,
  type NavPage,
  type Payment,
  type Project,
  type Quotation,
  type ServiceItem,
} from '../types/erp';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { ensureBusinessSettings } from '../lib/erpService';
import { getEffectiveInvoiceStatus, roundMoney } from '../lib/format';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface DashboardMetrics {
  totalRevenueInr: number;
  totalPaymentsReceivedInr: number;
  pendingPaymentsInr: number;
  totalExpensesInr: number;
  netCashFlowInr: number;
  outstandingInvoicesCount: number;
  totalCustomersCount: number;
  activeProjectsCount: number;
}

interface ErpContextValue {
  user: User | null;
  authLoading: boolean;
  dataLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  settings: BusinessSettings;
  customers: Customer[];
  services: ServiceItem[];
  projects: Project[];
  quotations: Quotation[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  metrics: DashboardMetrics;
  activePage: NavPage;
  setActivePage: (page: NavPage) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  toasts: ToastMessage[];
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  // Cross-page quick navigation triggers
  pendingPaymentInvoiceId: string | null;
  openPaymentForInvoice: (invoiceId: string) => void;
  clearPendingPaymentInvoice: () => void;
  quickCreateIntent: { page: NavPage; nonce: number } | null;
  triggerQuickCreate: (page: NavPage) => void;
}

const ErpContext = createContext<ErpContextValue | null>(null);

export const ErpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [settings, setSettings] = useState<BusinessSettings>(() => createDefaultSettings(''));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [pendingPaymentInvoiceId, setPendingPaymentInvoiceId] = useState<string | null>(null);
  const [quickCreateIntent, setQuickCreateIntent] = useState<{ page: NavPage; nonce: number } | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem('am_pixel_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('am_pixel_theme', theme);
    } catch {
      // Ignore storage restrictions
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Firestore real-time subscriptions strictly gated on authenticated user
  useEffect(() => {
    if (!user) {
      setCustomers([]);
      setServices([]);
      setProjects([]);
      setQuotations([]);
      setInvoices([]);
      setPayments([]);
      setExpenses([]);
      setSettings(createDefaultSettings(''));
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    void ensureBusinessSettings(user.uid, user.email || '');

    const loadedFlags = new Set<string>();
    const markLoaded = (key: string) => {
      loadedFlags.add(key);
      if (loadedFlags.size >= 8) {
        setDataLoading(false);
      }
    };

    const unsubscribers: Array<() => void> = [];

    // 1. Settings
    const settingsPath = `settings/${user.uid}`;
    unsubscribers.push(
      onSnapshot(
        doc(db, 'settings', user.uid),
        (snap) => {
          if (snap.exists()) {
            setSettings(snap.data() as BusinessSettings);
          } else {
            setSettings(createDefaultSettings(user.uid, user.email || ''));
          }
          markLoaded('settings');
        },
        (error) => handleFirestoreError(error, OperationType.GET, settingsPath),
      ),
    );

    // Helper for owner-scoped collection queries (enforced by firestore.rules allow list)
    const subscribeCollection = <T extends { id: string }>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      sortFn: (a: T, b: T) => number,
    ) => {
      const q = query(collection(db, colName), where('ownerId', '==', user.uid));
      unsubscribers.push(
        onSnapshot(
          q,
          (snapshot) => {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<T, 'id'>) }) as T);
            list.sort(sortFn);
            setter(list);
            markLoaded(colName);
          },
          (error) => handleFirestoreError(error, OperationType.LIST, colName),
        ),
      );
    };

    subscribeCollection<Customer>('customers', setCustomers, (a, b) =>
      (b.registrationDate || '').localeCompare(a.registrationDate || '') ||
      b.customerCode.localeCompare(a.customerCode),
    );
    subscribeCollection<ServiceItem>('services', setServices, (a, b) =>
      a.name.localeCompare(b.name),
    );
    subscribeCollection<Project>('projects', setProjects, (a, b) =>
      (b.startDate || '').localeCompare(a.startDate || '') ||
      b.projectCode.localeCompare(a.projectCode),
    );
    subscribeCollection<Quotation>('quotations', setQuotations, (a, b) =>
      (b.issueDate || '').localeCompare(a.issueDate || '') ||
      b.quotationNumber.localeCompare(a.quotationNumber),
    );
    subscribeCollection<Invoice>('invoices', setInvoices, (a, b) =>
      (b.issueDate || '').localeCompare(a.issueDate || '') ||
      b.invoiceNumber.localeCompare(a.invoiceNumber),
    );
    subscribeCollection<Payment>('payments', setPayments, (a, b) =>
      (b.paymentDate || '').localeCompare(a.paymentDate || '') ||
      b.receiptNumber.localeCompare(a.receiptNumber),
    );
    subscribeCollection<Expense>('expenses', setExpenses, (a, b) =>
      (b.date || '').localeCompare(a.date || '') ||
      b.expenseCode.localeCompare(a.expenseCode),
    );

    return () => {
      unsubscribers.forEach((fn) => fn());
    };
  }, [user]);

  const loginWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      notify('Signed in to AM PIXEL STUDIO – Business Manager', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sign-in failed.';
      if (!msg.includes('popup-closed-by-user')) {
        notify(msg, 'error');
      }
    }
  }, [notify]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setActivePage('dashboard');
    notify('Signed out safely.', 'info');
  }, [notify]);

  const openPaymentForInvoice = useCallback((invoiceId: string) => {
    setPendingPaymentInvoiceId(invoiceId);
    setActivePage('payments');
  }, []);

  const clearPendingPaymentInvoice = useCallback(() => {
    setPendingPaymentInvoiceId(null);
  }, []);

  const triggerQuickCreate = useCallback((page: NavPage) => {
    setActivePage(page);
    setQuickCreateIntent({ page, nonce: Date.now() });
  }, []);

  // Live Accounting Calculations — 100% derived from saved Firestore records
  const metrics = useMemo<DashboardMetrics>(() => {
    // 1. Total Revenue = billed invoices excluding Draft and Cancelled
    const activeRevenueInvoices = invoices.filter(
      (inv) => inv.status !== 'Draft' && inv.status !== 'Cancelled',
    );
    const totalRevenueInr = roundMoney(
      activeRevenueInvoices.reduce((sum, inv) => sum + (inv.grandTotalInr || 0), 0),
    );

    // 2. Total Payments Received = strictly actual recorded receipts (avoid double-counting)
    const totalPaymentsReceivedInr = roundMoney(
      payments.reduce((sum, p) => sum + (p.netAmountReceivedInr || 0), 0),
    );

    // 3. Pending Payments = remaining balance on unpaid / partially paid / overdue invoices
    const outstandingInvoices = activeRevenueInvoices.filter((inv) => {
      const eff = getEffectiveInvoiceStatus(inv);
      return (eff === 'Unpaid' || eff === 'Partially Paid' || eff === 'Overdue') && inv.balanceDueInr > 0.01;
    });
    const pendingPaymentsInr = roundMoney(
      outstandingInvoices.reduce((sum, inv) => sum + (inv.balanceDueInr || 0), 0),
    );

    // 4. Total Expenses = actual saved expenses
    const totalExpensesInr = roundMoney(
      expenses.reduce((sum, exp) => sum + (exp.netAmountInr || 0), 0),
    );

    // 5. Net Cash Flow = Actual Cash Received - Actual Expenses
    const netCashFlowInr = roundMoney(totalPaymentsReceivedInr - totalExpensesInr);

    // 6. Active Projects
    const activeProjectsCount = projects.filter(
      (p) => p.status === 'New' || p.status === 'In Progress' || p.status === 'Waiting for Customer',
    ).length;

    return {
      totalRevenueInr,
      totalPaymentsReceivedInr,
      pendingPaymentsInr,
      totalExpensesInr,
      netCashFlowInr,
      outstandingInvoicesCount: outstandingInvoices.length,
      totalCustomersCount: customers.length,
      activeProjectsCount,
    };
  }, [invoices, payments, expenses, customers, projects]);

  const value: ErpContextValue = {
    user,
    authLoading,
    dataLoading,
    loginWithGoogle,
    logout,
    settings,
    customers,
    services,
    projects,
    quotations,
    invoices,
    payments,
    expenses,
    metrics,
    activePage,
    setActivePage,
    theme,
    toggleTheme,
    toasts,
    notify,
    dismissToast,
    pendingPaymentInvoiceId,
    openPaymentForInvoice,
    clearPendingPaymentInvoice,
    quickCreateIntent,
    triggerQuickCreate,
  };

  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
};

export function useErp(): ErpContextValue {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error('useErp must be used within ErpProvider');
  return ctx;
}
