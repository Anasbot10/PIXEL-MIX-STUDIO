import React, { useEffect, useState } from 'react';
import { Database, Download, FileSpreadsheet, Save, Trash2, Upload } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import {
  CURRENCIES,
  FIELD_LIMITS,
  type BusinessSettings,
  type CurrencyCode,
} from '../types/erp';
import { saveBusinessSettings } from '../lib/erpService';
import { compressImageFileToDataUrl } from '../lib/format';
import { exportFullDatabaseExcel, exportFullDatabaseJson } from '../lib/excelExport';

export const SettingsPage: React.FC = () => {
  const {
    user,
    settings,
    customers,
    services,
    projects,
    quotations,
    invoices,
    payments,
    expenses,
    notify,
  } = useErp();

  const [form, setForm] = useState<Omit<BusinessSettings, 'ownerId' | 'createdAt' | 'updatedAt'>>({
    businessName: settings.businessName,
    businessType: settings.businessType,
    industry: settings.industry,
    country: settings.country,
    phone: settings.phone,
    email: settings.email,
    instagram: settings.instagram,
    address: settings.address,
    logoDataUrl: settings.logoDataUrl,
    upiId: settings.upiId,
    bankName: settings.bankName,
    bankAccountHolder: settings.bankAccountHolder,
    bankAccountNumber: settings.bankAccountNumber,
    bankIfsc: settings.bankIfsc,
    bankBranch: settings.bankBranch,
    bankSwift: settings.bankSwift,
    defaultCurrency: settings.defaultCurrency,
    invoicePrefix: settings.invoicePrefix,
    quotationPrefix: settings.quotationPrefix,
    receiptPrefix: settings.receiptPrefix,
    nextInvoiceNumber: settings.nextInvoiceNumber,
    nextQuotationNumber: settings.nextQuotationNumber,
    nextReceiptNumber: settings.nextReceiptNumber,
    nextCustomerNumber: settings.nextCustomerNumber,
    nextProjectNumber: settings.nextProjectNumber,
    nextExpenseNumber: settings.nextExpenseNumber,
    defaultTerms: settings.defaultTerms,
    defaultPaymentInstructions: settings.defaultPaymentInstructions,
    pdfAccentColor: settings.pdfAccentColor,
    pdfFooterNote: settings.pdfFooterNote,
  });

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    setForm({
      businessName: settings.businessName,
      businessType: settings.businessType,
      industry: settings.industry,
      country: settings.country,
      phone: settings.phone,
      email: settings.email,
      instagram: settings.instagram,
      address: settings.address,
      logoDataUrl: settings.logoDataUrl,
      upiId: settings.upiId,
      bankName: settings.bankName,
      bankAccountHolder: settings.bankAccountHolder,
      bankAccountNumber: settings.bankAccountNumber,
      bankIfsc: settings.bankIfsc,
      bankBranch: settings.bankBranch,
      bankSwift: settings.bankSwift,
      defaultCurrency: settings.defaultCurrency,
      invoicePrefix: settings.invoicePrefix,
      quotationPrefix: settings.quotationPrefix,
      receiptPrefix: settings.receiptPrefix,
      nextInvoiceNumber: settings.nextInvoiceNumber,
      nextQuotationNumber: settings.nextQuotationNumber,
      nextReceiptNumber: settings.nextReceiptNumber,
      nextCustomerNumber: settings.nextCustomerNumber,
      nextProjectNumber: settings.nextProjectNumber,
      nextExpenseNumber: settings.nextExpenseNumber,
      defaultTerms: settings.defaultTerms,
      defaultPaymentInstructions: settings.defaultPaymentInstructions,
      pdfAccentColor: settings.pdfAccentColor,
      pdfFooterNote: settings.pdfFooterNote,
    });
  }, [settings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Please select a PNG, JPG, or WebP logo image.', 'error');
      return;
    }
    setUploadingLogo(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 360, FIELD_LIMITS.logoDataUrl - 1000);
      setForm((prev) => ({ ...prev, logoDataUrl: dataUrl }));
      notify('Logo processed. Click "Save Settings" to apply across the app and PDFs.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Logo upload failed.', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await saveBusinessSettings(user.uid, form);
      notify('Studio settings saved to Cloud Firestore.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExcelBackup = () => {
    exportFullDatabaseExcel({
      settings,
      customers,
      services,
      projects,
      quotations,
      invoices,
      payments,
      expenses,
    });
    notify('Full multi-sheet Excel backup downloaded.', 'success');
  };

  const handleJsonBackup = () => {
    exportFullDatabaseJson({
      exportedAt: new Date().toISOString(),
      business: settings.businessName,
      settings,
      customers,
      services,
      projects,
      quotations,
      invoices,
      payments,
      expenses,
    });
    notify('Full JSON database archive downloaded.', 'success');
  };

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Studio Settings &amp; Configuration
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure business profile, logo, payment coordinates, document numbering, PDF styling,
            and database backups.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving || uploadingLogo}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* 1. Business Profile & Logo */}
      <section className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-6 space-y-5">
        <div className="border-b border-slate-100 dark:border-emerald-950 pb-3">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Business Profile &amp; Brand Logo
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            GST Registration Status: Not Registered (Commercial Invoices only — zero GST fields).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          {form.logoDataUrl ? (
            <img
              src={form.logoDataUrl}
              alt={form.businessName}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-xl object-contain border border-slate-200 dark:border-emerald-900 bg-white p-1"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-[#064E3B] text-[#E6C983] font-display font-bold text-xl flex items-center justify-center">
              AM
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162721] hover:bg-slate-200 rounded-lg cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingLogo ? 'Processing...' : 'Upload Studio Logo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
              {form.logoDataUrl && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, logoDataUrl: '' })}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Use Text Logo
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              If no logo image is uploaded, the clean AM PIXEL STUDIO text monogram is used on the
              sidebar and PDF documents.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Business Name *
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.businessName}
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Business Type
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.businessType}
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Contact Phone / WhatsApp
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.phone}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              maxLength={FIELD_LIMITS.email}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Instagram URL
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.instagram}
              value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Location / Country
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.country}
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Business Address
            </label>
            <textarea
              rows={2}
              maxLength={FIELD_LIMITS.address}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
        </div>
      </section>

      {/* 2. UPI & Bank Payment Details */}
      <section className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-6 space-y-4">
        <div className="border-b border-slate-100 dark:border-emerald-950 pb-3">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            UPI &amp; Bank Payment Coordinates
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatically printed on Commercial Invoices and shared in WhatsApp billing messages.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              UPI ID (GPay / PhonePe)
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.upiId}
              value={form.upiId}
              onChange={(e) => setForm({ ...form, upiId: e.target.value })}
              placeholder="ampixelstudio@okaxis"
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Account Holder Name
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.bankAccountHolder}
              value={form.bankAccountHolder}
              onChange={(e) => setForm({ ...form, bankAccountHolder: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Bank Name
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.bankName}
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              placeholder="e.g. Federal Bank / SBI"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Account Number
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.bankAccountNumber}
              value={form.bankAccountNumber}
              onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              IFSC Code
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.bankIfsc}
              value={form.bankIfsc}
              onChange={(e) => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Branch
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.bankBranch}
              value={form.bankBranch}
              onChange={(e) => setForm({ ...form, bankBranch: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              SWIFT / BIC (International)
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.bankSwift}
              value={form.bankSwift}
              onChange={(e) => setForm({ ...form, bankSwift: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
        </div>
      </section>

      {/* 3. Sequential Numbering & PDF Customization */}
      <section className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-6 space-y-4">
        <div className="border-b border-slate-100 dark:border-emerald-950 pb-3">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Document Numbering, Defaults &amp; PDF Styling
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Default Currency
            </label>
            <select
              value={form.defaultCurrency}
              onChange={(e) =>
                setForm({ ...form, defaultCurrency: e.target.value as CurrencyCode })
              }
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
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
              Invoice Prefix
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.prefix}
              value={form.invoicePrefix}
              onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Quotation Prefix
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.prefix}
              value={form.quotationPrefix}
              onChange={(e) => setForm({ ...form, quotationPrefix: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Receipt Prefix
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.prefix}
              value={form.receiptPrefix}
              onChange={(e) => setForm({ ...form, receiptPrefix: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Next Invoice No
            </label>
            <input
              type="number"
              min="1"
              max="999999"
              value={form.nextInvoiceNumber}
              onChange={(e) => setForm({ ...form, nextInvoiceNumber: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Next Quotation No
            </label>
            <input
              type="number"
              min="1"
              max="999999"
              value={form.nextQuotationNumber}
              onChange={(e) => setForm({ ...form, nextQuotationNumber: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Next Receipt No
            </label>
            <input
              type="number"
              min="1"
              max="999999"
              value={form.nextReceiptNumber}
              onChange={(e) => setForm({ ...form, nextReceiptNumber: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              PDF Brand Accent Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.pdfAccentColor}
                onChange={(e) => setForm({ ...form, pdfAccentColor: e.target.value })}
                className="w-10 h-9 rounded cursor-pointer border border-slate-200 dark:border-emerald-900"
              />
              <input
                type="text"
                maxLength={FIELD_LIMITS.pdfAccentColor}
                value={form.pdfAccentColor}
                onChange={(e) => setForm({ ...form, pdfAccentColor: e.target.value })}
                className="flex-1 px-2.5 py-2 text-xs font-mono bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Default Quotation Terms &amp; Conditions
            </label>
            <textarea
              rows={4}
              maxLength={FIELD_LIMITS.defaultTerms}
              value={form.defaultTerms}
              onChange={(e) => setForm({ ...form, defaultTerms: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
            />
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Default Invoice Payment Instructions
              </label>
              <textarea
                rows={2}
                maxLength={FIELD_LIMITS.defaultPaymentInstructions}
                value={form.defaultPaymentInstructions}
                onChange={(e) => setForm({ ...form, defaultPaymentInstructions: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                PDF Footer Note (Non-GST Commercial Disclaimer)
              </label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.pdfFooterNote}
                value={form.pdfFooterNote}
                onChange={(e) => setForm({ ...form, pdfFooterNote: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0B1512] border border-slate-200 dark:border-emerald-900 rounded-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Database Backup & Export */}
      <section className="bg-white dark:bg-[#101C18] border border-slate-200 dark:border-emerald-950 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-emerald-950 pb-3">
          <Database className="w-4 h-4 text-[#064E3B] dark:text-emerald-400" />
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Database Backup &amp; Export
          </h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Download a complete offline backup of all customers ({customers.length}), services (
          {services.length}), projects ({projects.length}), quotations ({quotations.length}),
          invoices ({invoices.length}), receipts ({payments.length}), and expenses (
          {expenses.length}).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExcelBackup}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#064E3B] hover:bg-[#047857] rounded-lg cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download Full Excel Workbook (.xlsx)
          </button>
          <button
            type="button"
            onClick={handleJsonBackup}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162721] hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download Full JSON Archive (.json)
          </button>
        </div>
      </section>
    </form>
  );
};
