import React from 'react';
import { ErpProvider, useErp } from './context/ErpContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthScreen } from './components/AuthScreen';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ServicesPage } from './pages/ServicesPage';
import { QuotationsPage } from './pages/QuotationsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

const ErpAppContent: React.FC = () => {
  const { user, authLoading, activePage } = useErp();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F7F9F8] dark:bg-[#08100D] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-11 h-11 rounded-xl bg-[#064E3B] text-[#E6C983] font-display font-bold text-base flex items-center justify-center mx-auto animate-pulse">
            AM
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Loading AM PIXEL STUDIO – Business Manager...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'customers':
        return <CustomersPage />;
      case 'projects':
        return <ProjectsPage />;
      case 'services':
        return <ServicesPage />;
      case 'quotations':
        return <QuotationsPage />;
      case 'invoices':
        return <InvoicesPage />;
      case 'payments':
        return <PaymentsPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return <Layout>{renderPage()}</Layout>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <ErpProvider>
        <ErpAppContent />
      </ErpProvider>
    </ErrorBoundary>
  );
}
