import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  PauseCircle,
  Send,
  XCircle,
} from 'lucide-react';

interface StatusTextProps {
  status: string;
}

export const StatusText: React.FC<StatusTextProps> = ({ status }) => {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    Paid: {
      color: 'text-emerald-700 dark:text-emerald-400',
      icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
    },
    Accepted: {
      color: 'text-emerald-700 dark:text-emerald-400',
      icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
    },
    Completed: {
      color: 'text-emerald-700 dark:text-emerald-400',
      icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
    },
    Active: {
      color: 'text-emerald-700 dark:text-emerald-400',
      icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
    },
    'Partially Paid': {
      color: 'text-amber-700 dark:text-amber-400',
      icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
    },
    'In Progress': {
      color: 'text-emerald-800 dark:text-emerald-300',
      icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
    },
    'Waiting for Customer': {
      color: 'text-amber-700 dark:text-amber-400',
      icon: <PauseCircle className="w-3.5 h-3.5 shrink-0" />,
    },
    Sent: {
      color: 'text-sky-700 dark:text-sky-400',
      icon: <Send className="w-3.5 h-3.5 shrink-0" />,
    },
    Unpaid: {
      color: 'text-amber-700 dark:text-amber-400',
      icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
    },
    New: {
      color: 'text-sky-700 dark:text-sky-400',
      icon: <FileText className="w-3.5 h-3.5 shrink-0" />,
    },
    Overdue: {
      color: 'text-red-600 dark:text-red-400',
      icon: <AlertCircle className="w-3.5 h-3.5 shrink-0" />,
    },
    Rejected: {
      color: 'text-red-600 dark:text-red-400',
      icon: <XCircle className="w-3.5 h-3.5 shrink-0" />,
    },
    Expired: {
      color: 'text-red-600 dark:text-red-400',
      icon: <AlertCircle className="w-3.5 h-3.5 shrink-0" />,
    },
    Cancelled: {
      color: 'text-slate-500 dark:text-slate-400',
      icon: <XCircle className="w-3.5 h-3.5 shrink-0" />,
    },
    Inactive: {
      color: 'text-slate-500 dark:text-slate-400',
      icon: <PauseCircle className="w-3.5 h-3.5 shrink-0" />,
    },
    Draft: {
      color: 'text-slate-600 dark:text-slate-400',
      icon: <FileText className="w-3.5 h-3.5 shrink-0" />,
    },
  };

  const style = map[status] || {
    color: 'text-slate-600 dark:text-slate-300',
    icon: <FileText className="w-3.5 h-3.5 shrink-0" />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${style.color}`}>
      {style.icon}
      <span>{status}</span>
    </span>
  );
};
