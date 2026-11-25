import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
  details: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', details: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let message = error.message || 'An unexpected application error occurred.';
    let details = '';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.operationType && parsed.error) {
        message = `Database ${parsed.operationType} error on ${parsed.path || 'record'}: ${parsed.error}`;
        details = JSON.stringify(parsed, null, 2);
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message, details };
  }

  componentDidCatch(error: Error) {
    console.error('Application ErrorBoundary caught:', error);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '', details: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F9F8] dark:bg-[#08100D] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="font-display text-lg font-semibold">Something went wrong</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {this.state.message}
            </p>
            {this.state.details && (
              <pre className="text-xs font-mono bg-slate-50 dark:bg-[#09120F] border border-slate-200 dark:border-emerald-950 rounded-lg p-3 overflow-x-auto max-h-48 text-slate-700 dark:text-slate-300">
                {this.state.details}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
