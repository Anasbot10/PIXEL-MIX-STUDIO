import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { FIELD_LIMITS, type CurrencyCode, type LineItem, type ServiceItem } from '../types/erp';
import { formatCurrency, roundMoney } from '../lib/format';

interface LineItemsEditorProps {
  items: LineItem[];
  services: ServiceItem[];
  currency: CurrencyCode;
  onChange: (items: LineItem[]) => void;
}

export const LineItemsEditor: React.FC<LineItemsEditorProps> = ({
  items,
  services,
  currency,
  onChange,
}) => {
  const activeServices = services.filter((s) => s.isActive);

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    const next = items.map((item, idx) => {
      if (idx !== index) return item;
      const merged = { ...item, ...patch };
      merged.total = roundMoney((Number(merged.quantity) || 0) * (Number(merged.unitPrice) || 0));
      return merged;
    });
    onChange(next);
  };

  const handleServiceSelect = (index: number, serviceId: string) => {
    if (!serviceId) {
      updateItem(index, { serviceId: '' });
      return;
    }
    const srv = services.find((s) => s.id === serviceId);
    if (!srv) return;
    updateItem(index, {
      serviceId: srv.id,
      name: srv.name,
      description: srv.description,
      unitPrice: srv.defaultPrice,
    });
  };

  const addItem = () => {
    if (items.length >= FIELD_LIMITS.maxLineItems) return;
    onChange([
      ...items,
      { serviceId: '', name: '', description: '', quantity: 1, unitPrice: 0, total: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          Services / Line Items ({items.length})
        </label>
        <button
          type="button"
          onClick={addItem}
          disabled={items.length >= FIELD_LIMITS.maxLineItems}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#064E3B] dark:text-emerald-400 hover:underline cursor-pointer disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Line Item
        </button>
      </div>

      <div className="space-y-2.5">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg border border-slate-200 dark:border-emerald-950 bg-slate-50/60 dark:bg-[#0B1512] space-y-2.5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-4">
                <label className="block text-[11px] text-slate-500 mb-1">
                  Preset Service (Optional)
                </label>
                <select
                  value={item.serviceId}
                  onChange={(e) => handleServiceSelect(idx, e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 rounded-md outline-none"
                >
                  <option value="">Custom Item</option>
                  {activeServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatCurrency(s.defaultPrice, s.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] text-slate-500 mb-1">Item / Service Name *</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={item.name}
                  onChange={(e) => updateItem(idx, { name: e.target.value })}
                  placeholder="e.g. Branding Identity Package"
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 rounded-md outline-none focus:border-[#064E3B]"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-[11px] text-slate-500 mb-1">Qty</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-xs font-mono bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 rounded-md outline-none text-right"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] text-slate-500 mb-1">Unit Price ({currency})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={item.unitPrice}
                  onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-xs font-mono bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 rounded-md outline-none text-right"
                />
              </div>

              <div className="sm:col-span-1 flex items-center justify-end gap-1">
                <button
                  type="button"
                  disabled={items.length <= 1}
                  onClick={() => removeItem(idx)}
                  aria-label="Remove line item"
                  className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <input
                type="text"
                maxLength={400}
                value={item.description}
                onChange={(e) => updateItem(idx, { description: e.target.value })}
                placeholder="Optional deliverable note or dimensions..."
                className="flex-1 px-2.5 py-1 text-[11px] bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-900 rounded-md outline-none"
              />
              <span className="font-mono text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                Line Total: {formatCurrency(item.total, currency)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
