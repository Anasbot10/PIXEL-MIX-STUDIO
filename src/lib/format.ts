import type { CurrencyCode, Invoice, InvoiceStatus } from '../types/erp';

export const CURRENCY_META: Record<CurrencyCode, { symbol: string; locale: string; label: string }> = {
  INR: { symbol: '₹', locale: 'en-IN', label: 'Indian Rupee (INR)' },
  USD: { symbol: '$', locale: 'en-US', label: 'US Dollar (USD)' },
  AED: { symbol: 'AED ', locale: 'en-AE', label: 'UAE Dirham (AED)' },
  SAR: { symbol: 'SAR ', locale: 'en-SA', label: 'Saudi Riyal (SAR)' },
  GBP: { symbol: '£', locale: 'en-GB', label: 'British Pound (GBP)' },
  EUR: { symbol: '€', locale: 'de-DE', label: 'Euro (EUR)' },
};

export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatCurrency(amount: number, currency: CurrencyCode = 'INR'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  if (currency === 'INR') return formatINR(safe);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
  return `${CURRENCY_META[currency].symbol}${formatted}`;
}

export function formatPdfCurrency(amount: number, currency: CurrencyCode = 'INR'): string {
  // jsPDF standard Helvetica font does not include the ₹ glyph cleanly, so use INR / symbol-safe prefixes
  const safe = Number.isFinite(amount) ? amount : 0;
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
  const prefixMap: Record<CurrencyCode, string> = {
    INR: 'INR ',
    USD: 'USD $',
    AED: 'AED ',
    SAR: 'SAR ',
    GBP: 'GBP ',
    EUR: 'EUR ',
  };
  return `${prefixMap[currency]}${formatted}`;
}

export function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function addDaysISO(dateStr: string, days: number): string {
  const d = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getMonthKey(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return '';
  return dateStr.slice(0, 7); // YYYY-MM
}

export function getMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

export function formatSequentialCode(prefix: string, seq: number, includeYear = true): string {
  const cleanPrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '') || 'DOC';
  const padded = String(Math.max(1, Math.floor(seq))).padStart(3, '0');
  if (!includeYear) {
    return `${cleanPrefix}-${padded}`;
  }
  const year = new Date().getFullYear();
  return `${cleanPrefix}-${year}-${padded}`;
}

export function getEffectiveInvoiceStatus(invoice: Invoice): InvoiceStatus {
  if (invoice.status === 'Cancelled' || invoice.status === 'Draft' || invoice.status === 'Paid') {
    return invoice.status;
  }
  if (invoice.balanceDue <= 0.01 && invoice.amountPaid > 0) {
    return 'Paid';
  }
  if (invoice.dueDate && invoice.dueDate < todayISO() && invoice.balanceDue > 0.01) {
    return 'Overdue';
  }
  if (invoice.amountPaid > 0.01) {
    return 'Partially Paid';
  }
  return 'Unpaid';
}

export function buildWhatsAppInvoiceUrl(
  phone: string,
  invoice: Invoice,
  businessName: string,
  upiId: string,
): string {
  const digits = phone.replace(/[^0-9]/g, '');
  const normalizedPhone = digits.length === 10 ? `91${digits}` : digits;
  const lines = [
    `Hello ${invoice.customerName},`,
    ``,
    `Here are the commercial invoice details from *${businessName}*:`,
    `• Invoice No: ${invoice.invoiceNumber}`,
    `• Issue Date: ${formatDisplayDate(invoice.issueDate)}`,
    `• Due Date: ${formatDisplayDate(invoice.dueDate)}`,
    `• Total Amount: ${formatCurrency(invoice.grandTotal, invoice.currency)}`,
    invoice.amountPaid > 0
      ? `• Paid So Far: ${formatCurrency(invoice.amountPaid, invoice.currency)}`
      : null,
    `• Balance Due: *${formatCurrency(invoice.balanceDue, invoice.currency)}*`,
    upiId ? `\nUPI ID: ${upiId}` : null,
    ``,
    `Note: ${businessName} is not GST registered. This is a commercial invoice.`,
    `Thank you for your business!`,
  ].filter((x): x is string => x !== null);

  const text = encodeURIComponent(lines.join('\n'));
  return normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function sanitizeText(value: string, maxLength: number): string {
  return (value ?? '').trim().slice(0, maxLength);
}

/**
 * Resizes and compresses an uploaded image file to a lightweight data URL
 * strictly under the Firestore blueprint byte cap.
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxWidth: number,
  maxChars: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / Math.max(img.width, img.height, 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        while (dataUrl.length > maxChars && quality > 0.25) {
          quality -= 0.15;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        if (dataUrl.length > maxChars) {
          reject(new Error('Image is too large even after compression. Please choose a smaller image.'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
