import type { Timestamp } from 'firebase/firestore';

export type CurrencyCode = 'INR' | 'USD' | 'AED' | 'SAR' | 'GBP' | 'EUR';

export const CURRENCIES: CurrencyCode[] = ['INR', 'USD', 'AED', 'SAR', 'GBP', 'EUR'];

export type PaymentMethod =
  | 'UPI'
  | 'Google Pay'
  | 'PhonePe'
  | 'Bank Transfer'
  | 'Cash'
  | 'International Transfer'
  | 'Other';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'UPI',
  'Google Pay',
  'PhonePe',
  'Bank Transfer',
  'Cash',
  'International Transfer',
  'Other',
];

export type CustomerType = 'Individual' | 'Business' | 'Agency' | 'Startup' | 'Organization';

export const CUSTOMER_TYPES: CustomerType[] = [
  'Individual',
  'Business',
  'Agency',
  'Startup',
  'Organization',
];

export type ProjectStatus =
  | 'New'
  | 'In Progress'
  | 'Waiting for Customer'
  | 'Completed'
  | 'Cancelled';

export const PROJECT_STATUSES: ProjectStatus[] = [
  'New',
  'In Progress',
  'Waiting for Customer',
  'Completed',
  'Cancelled',
];

export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';

export const QUOTATION_STATUSES: QuotationStatus[] = [
  'Draft',
  'Sent',
  'Accepted',
  'Rejected',
  'Expired',
];

export type InvoiceStatus =
  | 'Draft'
  | 'Unpaid'
  | 'Partially Paid'
  | 'Paid'
  | 'Overdue'
  | 'Cancelled';

export const INVOICE_STATUSES: InvoiceStatus[] = [
  'Draft',
  'Unpaid',
  'Partially Paid',
  'Paid',
  'Overdue',
  'Cancelled',
];

export type PaymentType = 'Advance' | 'Partial' | 'Full';

export const PAYMENT_TYPES: PaymentType[] = ['Advance', 'Partial', 'Full'];

export type ExpenseCategory =
  | 'Software Subscriptions'
  | 'Internet'
  | 'Equipment'
  | 'Marketing'
  | 'Advertising'
  | 'Travel'
  | 'Printing'
  | 'Office Expenses'
  | 'Other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Software Subscriptions',
  'Internet',
  'Equipment',
  'Marketing',
  'Advertising',
  'Travel',
  'Printing',
  'Office Expenses',
  'Other',
];

export type NavPage =
  | 'dashboard'
  | 'customers'
  | 'projects'
  | 'services'
  | 'quotations'
  | 'invoices'
  | 'payments'
  | 'expenses'
  | 'reports'
  | 'settings';

export interface LineItem {
  serviceId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface BusinessSettings {
  ownerId: string;
  businessName: string;
  businessType: string;
  industry: string;
  country: string;
  phone: string;
  email: string;
  instagram: string;
  address: string;
  logoDataUrl: string;
  upiId: string;
  bankName: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBranch: string;
  bankSwift: string;
  defaultCurrency: CurrencyCode;
  invoicePrefix: string;
  quotationPrefix: string;
  receiptPrefix: string;
  nextInvoiceNumber: number;
  nextQuotationNumber: number;
  nextReceiptNumber: number;
  nextCustomerNumber: number;
  nextProjectNumber: number;
  nextExpenseNumber: number;
  defaultTerms: string;
  defaultPaymentInstructions: string;
  pdfAccentColor: string;
  pdfFooterNote: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Customer {
  id: string;
  ownerId: string;
  customerCode: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  companyName: string;
  customerType: CustomerType;
  notes: string;
  registrationDate: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ServiceItem {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  defaultPrice: number;
  currency: CurrencyCode;
  estimatedDelivery: string;
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Project {
  id: string;
  ownerId: string;
  projectCode: string;
  customerId: string;
  customerName: string;
  projectName: string;
  serviceId: string;
  serviceName: string;
  startDate: string;
  deadline: string;
  budget: number;
  currency: CurrencyCode;
  status: ProjectStatus;
  progress: number;
  notes: string;
  linkedQuotationId: string;
  linkedInvoiceId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Quotation {
  id: string;
  ownerId: string;
  quotationNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  issueDate: string;
  validityDate: string;
  currency: CurrencyCode;
  exchangeRate: number;
  exchangeRateSource: string;
  items: LineItem[];
  subtotal: number;
  discountType: 'fixed' | 'percent';
  discountValue: number;
  discountAmount: number;
  total: number;
  totalInr: number;
  status: QuotationStatus;
  notes: string;
  terms: string;
  convertedInvoiceId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Invoice {
  id: string;
  ownerId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  issueDate: string;
  dueDate: string;
  currency: CurrencyCode;
  exchangeRate: number;
  exchangeRateSource: string;
  items: LineItem[];
  subtotal: number;
  discountType: 'fixed' | 'percent';
  discountValue: number;
  discountAmount: number;
  grandTotal: number;
  grandTotalInr: number;
  amountPaid: number;
  amountPaidInr: number;
  balanceDue: number;
  balanceDueInr: number;
  status: InvoiceStatus;
  notes: string;
  paymentInstructions: string;
  sourceQuotationId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Payment {
  id: string;
  ownerId: string;
  receiptNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  paymentDate: string;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  originalCurrency: CurrencyCode;
  originalAmount: number;
  exchangeRate: number;
  exchangeRateSource: string;
  inrEquivalent: number;
  transferFees: number;
  netAmountReceivedInr: number;
  transactionReference: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Expense {
  id: string;
  ownerId: string;
  expenseCode: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  originalCurrency: CurrencyCode;
  originalAmount: number;
  exchangeRate: number;
  exchangeRateSource: string;
  inrEquivalent: number;
  transferFees: number;
  netAmountInr: number;
  paymentMethod: PaymentMethod;
  vendor: string;
  referenceNumber: string;
  attachmentUrl: string;
  attachmentName: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Verbatim maxLength limits synchronized with firebase-blueprint.json & firestore.rules.
 */
export const FIELD_LIMITS = {
  businessName: 120,
  businessType: 80,
  industry: 200,
  country: 80,
  phone: 40,
  email: 120,
  instagram: 200,
  address: 400,
  logoDataUrl: 120000,
  upiId: 120,
  bankName: 120,
  bankAccountHolder: 120,
  bankAccountNumber: 60,
  bankIfsc: 40,
  bankBranch: 120,
  bankSwift: 40,
  prefix: 16,
  defaultTerms: 2000,
  defaultPaymentInstructions: 1000,
  pdfAccentColor: 20,
  pdfFooterNote: 300,
  fullName: 120,
  companyName: 120,
  notes: 1000,
  projectNotes: 1500,
  docNotes: 1500,
  serviceName: 120,
  serviceDescription: 600,
  estimatedDelivery: 80,
  projectName: 160,
  exchangeRateSource: 120,
  transactionReference: 120,
  expenseDescription: 300,
  vendor: 120,
  attachmentUrl: 150000,
  attachmentName: 160,
  maxLineItems: 50,
} as const;

export function createDefaultSettings(ownerId: string, email = ''): BusinessSettings {
  return {
    ownerId,
    businessName: 'AM PIXEL STUDIO',
    businessType: 'Individual Freelancer',
    industry:
      'Graphic Design, Branding, Digital Marketing, Advertising, Publication, AI Video Production',
    country: 'Kerala, India',
    phone: '9400527450',
    email,
    instagram: 'https://www.instagram.com/_am_pixel_studio/',
    address: 'Kerala, India',
    logoDataUrl: '',
    upiId: '',
    bankName: '',
    bankAccountHolder: 'AM PIXEL STUDIO',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBranch: '',
    bankSwift: '',
    defaultCurrency: 'INR',
    invoicePrefix: 'INV',
    quotationPrefix: 'QT',
    receiptPrefix: 'REC',
    nextInvoiceNumber: 1,
    nextQuotationNumber: 1,
    nextReceiptNumber: 1,
    nextCustomerNumber: 1,
    nextProjectNumber: 1,
    nextExpenseNumber: 1,
    defaultTerms:
      '1. 50% advance payment is required to initiate work; remaining balance is due upon final delivery.\n2. Quotation is valid until the date stated above.\n3. Revisions beyond the agreed scope will be billed separately.\n4. Source files are handed over after full settlement.',
    defaultPaymentInstructions:
      'Please settle via UPI or Bank Transfer using the details provided. Share the transaction reference on WhatsApp (+91 9400527450) for receipt issuance.',
    pdfAccentColor: '#064E3B',
    pdfFooterNote:
      'AM PIXEL STUDIO is not registered under GST. This is a commercial invoice, not a GST tax invoice.',
  };
}

export const STARTER_SERVICES_CATALOG: Array<{
  name: string;
  description: string;
  defaultPrice: number;
  currency: CurrencyCode;
  estimatedDelivery: string;
}> = [
  {
    name: 'Poster Design',
    description: 'High-impact print and digital promotional poster design (editable baseline rate).',
    defaultPrice: 1500,
    currency: 'INR',
    estimatedDelivery: '2–3 days',
  },
  {
    name: 'Logo Design',
    description: 'Custom brand mark concepts with vector delivery and color guidelines.',
    defaultPrice: 5000,
    currency: 'INR',
    estimatedDelivery: '5–7 days',
  },
  {
    name: 'Branding',
    description: 'Complete visual identity kit: logo, typography, color palette, and stationery.',
    defaultPrice: 15000,
    currency: 'INR',
    estimatedDelivery: '10–14 days',
  },
  {
    name: 'Social Media Design',
    description: 'Cohesive social media post & story creatives tailored to brand voice.',
    defaultPrice: 3500,
    currency: 'INR',
    estimatedDelivery: '3–4 days',
  },
  {
    name: 'AI Video Advertisement',
    description: 'Concept-to-edit AI-assisted commercial video ad with motion and sound design.',
    defaultPrice: 8000,
    currency: 'INR',
    estimatedDelivery: '5–7 days',
  },
  {
    name: 'Motion Graphics',
    description: 'Animated title cards, kinetic typography, reels, and product showcase animations.',
    defaultPrice: 6000,
    currency: 'INR',
    estimatedDelivery: '4–6 days',
  },
  {
    name: 'Invitation Design',
    description: 'Bespoke event & wedding invitation suite for print and WhatsApp sharing.',
    defaultPrice: 2000,
    currency: 'INR',
    estimatedDelivery: '2–3 days',
  },
  {
    name: 'Publication Design',
    description: 'Brochures, magazines, catalogs, and print-ready editorial layouts.',
    defaultPrice: 7500,
    currency: 'INR',
    estimatedDelivery: '7–10 days',
  },
  {
    name: 'Custom Design',
    description: 'Tailored creative direction and bespoke design deliverable scoped per project.',
    defaultPrice: 2500,
    currency: 'INR',
    estimatedDelivery: 'Flexible',
  },
];
