import React from 'react';
import { Download, Printer, X } from 'lucide-react';
import type { BusinessSettings, Invoice, Payment, Quotation } from '../types/erp';
import {
  formatCurrency,
  formatDisplayDate,
  formatINR,
  getEffectiveInvoiceStatus,
} from '../lib/format';
import {
  downloadInvoicePdf,
  downloadQuotationPdf,
  downloadReceiptPdf,
} from '../lib/pdfGenerator';

type PreviewDoc =
  | { type: 'invoice'; data: Invoice }
  | { type: 'quotation'; data: Quotation }
  | { type: 'receipt'; data: Payment; remainingBalanceInr?: number };

interface DocumentPreviewModalProps {
  doc: PreviewDoc | null;
  settings: BusinessSettings;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  doc,
  settings,
  onClose,
}) => {
  if (!doc) return null;

  const handleDownloadPdf = () => {
    if (doc.type === 'invoice') {
      downloadInvoicePdf(doc.data, settings);
    } else if (doc.type === 'quotation') {
      downloadQuotationPdf(doc.data, settings);
    } else {
      downloadReceiptPdf(doc.data, settings, doc.remainingBalanceInr);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const docTitle =
    doc.type === 'invoice'
      ? 'COMMERCIAL INVOICE'
      : doc.type === 'quotation'
        ? 'QUOTATION'
        : 'PAYMENT RECEIPT';

  const docNumber =
    doc.type === 'invoice'
      ? doc.data.invoiceNumber
      : doc.type === 'quotation'
        ? doc.data.quotationNumber
        : doc.data.receiptNumber;

  const statusText =
    doc.type === 'invoice'
      ? getEffectiveInvoiceStatus(doc.data)
      : doc.type === 'quotation'
        ? doc.data.status
        : `${doc.data.paymentType} Payment`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Toolbar (hidden on print) */}
        <div className="no-print flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-200 dark:border-emerald-950 bg-slate-50 dark:bg-[#0B1512]">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
            <span className="font-display font-semibold">{docTitle}</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-xs text-[#064E3B] dark:text-emerald-400">
              {docNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#13231D] border border-slate-200 dark:border-emerald-900 rounded-lg hover:bg-slate-50 dark:hover:bg-[#192F27] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Paper */}
        <div className="overflow-y-auto p-6 sm:p-8 bg-slate-100/70 dark:bg-[#08100D]">
          <div className="print-only-container mx-auto max-w-[794px] bg-white text-slate-900 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            {/* Top Brand Accent Bar */}
            <div className="h-2 bg-[#064E3B]" />
            <div className="h-[3px] bg-[#B89146]" />

            <div className="p-6 sm:p-8 space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="flex items-start gap-4">
                  {settings.logoDataUrl ? (
                    <img
                      src={settings.logoDataUrl}
                      alt={settings.businessName}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 object-contain rounded-md border border-slate-100"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#064E3B] text-[#E6C983] font-display font-bold text-base flex items-center justify-center shrink-0">
                      AM
                    </div>
                  )}
                  <div className="space-y-1">
                    <h2 className="font-display text-xl font-bold tracking-tight text-[#064E3B]">
                      {settings.businessName}
                    </h2>
                    <p className="text-xs text-slate-600 max-w-xs">{settings.address}</p>
                    <p className="text-xs text-slate-600">
                      Phone: {settings.phone}
                      {settings.email ? ` · ${settings.email}` : ''}
                    </p>
                    {settings.instagram && (
                      <p className="text-xs text-slate-500">{settings.instagram}</p>
                    )}
                  </div>
                </div>

                <div className="sm:text-right space-y-1">
                  <p className="font-display text-lg font-bold tracking-tight text-[#064E3B]">
                    {docTitle}
                  </p>
                  <p className="font-mono text-sm font-semibold text-slate-900">{docNumber}</p>
                  <p className="text-xs text-slate-600">Status: {statusText}</p>
                </div>
              </div>

              {/* Invoice or Quotation Body */}
              {(doc.type === 'invoice' || doc.type === 'quotation') && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-500">
                        {doc.type === 'invoice' ? 'Billed To' : 'Prepared For'}
                      </p>
                      <p className="font-display text-sm font-semibold text-slate-900">
                        {doc.data.customerName}
                      </p>
                      {doc.data.customerAddress && (
                        <p className="text-xs text-slate-600 whitespace-pre-line">
                          {doc.data.customerAddress}
                        </p>
                      )}
                      {doc.data.customerPhone && (
                        <p className="text-xs text-slate-600">Phone: {doc.data.customerPhone}</p>
                      )}
                      {doc.data.customerEmail && (
                        <p className="text-xs text-slate-600">Email: {doc.data.customerEmail}</p>
                      )}
                    </div>

                    <div className="space-y-1.5 sm:text-right text-xs">
                      <div className="flex sm:justify-end gap-3">
                        <span className="text-slate-500">Issue Date:</span>
                        <span className="font-mono font-medium">
                          {formatDisplayDate(doc.data.issueDate)}
                        </span>
                      </div>
                      <div className="flex sm:justify-end gap-3">
                        <span className="text-slate-500">
                          {doc.type === 'invoice' ? 'Due Date:' : 'Valid Until:'}
                        </span>
                        <span className="font-mono font-medium">
                          {formatDisplayDate(
                            doc.type === 'invoice' ? doc.data.dueDate : doc.data.validityDate,
                          )}
                        </span>
                      </div>
                      <div className="flex sm:justify-end gap-3">
                        <span className="text-slate-500">Currency:</span>
                        <span className="font-mono font-medium">{doc.data.currency}</span>
                      </div>
                      {doc.data.currency !== 'INR' && (
                        <div className="flex sm:justify-end gap-3">
                          <span className="text-slate-500">Exchange Rate:</span>
                          <span className="font-mono">
                            1 {doc.data.currency} = ₹{doc.data.exchangeRate} (
                            {doc.data.exchangeRateSource || 'Manual'})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#064E3B] text-white">
                          <th className="py-2.5 px-3 font-medium w-10">#</th>
                          <th className="py-2.5 px-3 font-medium">Service / Deliverable</th>
                          <th className="py-2.5 px-3 font-medium text-right w-16">Qty</th>
                          <th className="py-2.5 px-3 font-medium text-right w-32">Unit Price</th>
                          <th className="py-2.5 px-3 font-medium text-right w-32">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {doc.data.items.map((item, idx) => (
                          <tr key={`${item.name}-${idx}`}>
                            <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <p className="font-medium text-slate-900">{item.name}</p>
                              {item.description && (
                                <p className="text-slate-500 mt-0.5">{item.description}</p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {formatCurrency(item.unitPrice, doc.data.currency)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium tabular-nums">
                              {formatCurrency(item.total, doc.data.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary + Payment Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2 text-xs text-slate-600">
                      {doc.type === 'invoice' ? (
                        <>
                          <p className="font-semibold text-[#064E3B]">Payment Instructions</p>
                          {settings.upiId && <p>UPI ID: {settings.upiId}</p>}
                          {settings.bankName && (
                            <p>
                              Bank: {settings.bankName}
                              {settings.bankBranch ? ` (${settings.bankBranch})` : ''}
                            </p>
                          )}
                          {settings.bankAccountHolder && (
                            <p>Account Holder: {settings.bankAccountHolder}</p>
                          )}
                          {settings.bankAccountNumber && (
                            <p className="font-mono">A/C No: {settings.bankAccountNumber}</p>
                          )}
                          {settings.bankIfsc && (
                            <p className="font-mono">IFSC: {settings.bankIfsc}</p>
                          )}
                          {settings.bankSwift && (
                            <p className="font-mono">SWIFT: {settings.bankSwift}</p>
                          )}
                          {doc.data.paymentInstructions && (
                            <p className="pt-1 whitespace-pre-line">
                              {doc.data.paymentInstructions}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-[#064E3B]">Terms &amp; Conditions</p>
                          <p className="whitespace-pre-line leading-relaxed">{doc.data.terms}</p>
                        </>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(doc.data.subtotal, doc.data.currency)}
                        </span>
                      </div>
                      {doc.data.discountAmount > 0 && (
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">
                            Discount
                            {doc.data.discountType === 'percent'
                              ? ` (${doc.data.discountValue}%)`
                              : ''}
                          </span>
                          <span className="font-mono tabular-nums text-red-600">
                            - {formatCurrency(doc.data.discountAmount, doc.data.currency)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 px-2.5 bg-emerald-50/70 rounded font-semibold text-sm">
                        <span className="text-[#064E3B]">
                          {doc.type === 'invoice' ? 'Grand Total' : 'Estimated Total'}
                        </span>
                        <span className="font-mono tabular-nums text-slate-900">
                          {formatCurrency(
                            doc.type === 'invoice' ? doc.data.grandTotal : doc.data.total,
                            doc.data.currency,
                          )}
                        </span>
                      </div>
                      {doc.data.currency !== 'INR' && (
                        <div className="flex justify-between py-1 text-slate-600">
                          <span>INR Equivalent</span>
                          <span className="font-mono tabular-nums">
                            {formatINR(
                              doc.type === 'invoice' ? doc.data.grandTotalInr : doc.data.totalInr,
                            )}
                          </span>
                        </div>
                      )}
                      {doc.type === 'invoice' && (
                        <>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500">Amount Paid</span>
                            <span className="font-mono tabular-nums text-emerald-700">
                              {formatCurrency(doc.data.amountPaid, doc.data.currency)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1.5 font-semibold text-sm">
                            <span className="text-slate-900">Balance Due</span>
                            <span className="font-mono tabular-nums text-slate-900">
                              {formatCurrency(doc.data.balanceDue, doc.data.currency)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {doc.data.notes && (
                    <div className="pt-3 border-t border-slate-100 text-xs text-slate-600">
                      <p className="font-semibold text-slate-800 mb-1">Notes</p>
                      <p className="whitespace-pre-line">{doc.data.notes}</p>
                    </div>
                  )}
                </>
              )}

              {/* Payment Receipt Body */}
              {doc.type === 'receipt' && (
                <div className="space-y-5">
                  <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <p className="font-semibold">Studio-Generated Payment Receipt</p>
                    <p className="mt-0.5 text-amber-800">
                      Issued by {settings.businessName} as an acknowledgement of a recorded payment.
                      This receipt is distinct from bank-issued settlement advices or UPI/SWIFT
                      transaction proof.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border border-slate-200 rounded-lg p-4">
                    <div>
                      <p className="text-slate-500">Received From</p>
                      <p className="font-semibold text-sm text-slate-900 mt-0.5">
                        {doc.data.customerName}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-slate-500">Payment Date</p>
                      <p className="font-mono font-medium text-sm text-slate-900 mt-0.5">
                        {formatDisplayDate(doc.data.paymentDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Linked Invoice</p>
                      <p className="font-mono font-medium text-slate-900 mt-0.5">
                        {doc.data.invoiceNumber}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-slate-500">Payment Method &amp; Type</p>
                      <p className="font-medium text-slate-900 mt-0.5">
                        {doc.data.paymentMethod} · {doc.data.paymentType}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Transaction Reference</p>
                      <p className="font-mono text-slate-900 mt-0.5">
                        {doc.data.transactionReference || 'Not recorded'}
                      </p>
                    </div>
                    {doc.data.originalCurrency !== 'INR' && (
                      <div className="sm:text-right">
                        <p className="text-slate-500">Manual Exchange Rate</p>
                        <p className="font-mono text-slate-900 mt-0.5">
                          1 {doc.data.originalCurrency} = ₹{doc.data.exchangeRate} (
                          {doc.data.exchangeRateSource || 'Manual'})
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 text-xs">
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600">Original Amount Paid</span>
                      <span className="font-mono font-medium tabular-nums">
                        {formatCurrency(doc.data.originalAmount, doc.data.originalCurrency)}
                      </span>
                    </div>
                    {doc.data.originalCurrency !== 'INR' && (
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-slate-600">Gross INR Equivalent</span>
                        <span className="font-mono tabular-nums">
                          {formatINR(doc.data.inrEquivalent)}
                        </span>
                      </div>
                    )}
                    {doc.data.transferFees > 0 && (
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-slate-600">Transfer / Bank Fees</span>
                        <span className="font-mono tabular-nums text-red-600">
                          - {formatINR(doc.data.transferFees)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between px-4 py-3 bg-emerald-50/70 font-semibold text-sm">
                      <span className="text-[#064E3B]">Net Amount Received (INR)</span>
                      <span className="font-mono tabular-nums text-slate-900">
                        {formatINR(doc.data.netAmountReceivedInr)}
                      </span>
                    </div>
                    {typeof doc.remainingBalanceInr === 'number' && (
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-slate-600">Remaining Invoice Balance (INR)</span>
                        <span className="font-mono font-medium tabular-nums">
                          {formatINR(doc.remainingBalanceInr)}
                        </span>
                      </div>
                    )}
                  </div>

                  {doc.data.notes && (
                    <div className="text-xs text-slate-600">
                      <p className="font-semibold text-slate-800 mb-1">Notes</p>
                      <p className="whitespace-pre-line">{doc.data.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Footer Non-GST Compliance Note */}
              <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {settings.pdfFooterNote ||
                    `${settings.businessName} is not registered under GST. This is a commercial document, not a GST tax invoice.`}
                </span>
                <span className="font-mono">{settings.phone}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
