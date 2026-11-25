import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  createDefaultSettings,
  FIELD_LIMITS,
  STARTER_SERVICES_CATALOG,
  type BusinessSettings,
  type CurrencyCode,
  type Customer,
  type Expense,
  type Invoice,
  type InvoiceStatus,
  type LineItem,
  type Payment,
  type Project,
  type Quotation,
  type ServiceItem,
} from '../types/erp';
import { db, handleFirestoreError, OperationType } from './firebase';
import { formatSequentialCode, roundMoney, sanitizeText, todayISO } from './format';

function generateSafeId(prefix: string): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}

function sanitizeLineItems(items: LineItem[]): LineItem[] {
  const sliced = items.slice(0, FIELD_LIMITS.maxLineItems).map((item) => {
    const quantity = Math.max(0.01, roundMoney(Number(item.quantity) || 1));
    const unitPrice = Math.max(0, roundMoney(Number(item.unitPrice) || 0));
    return {
      serviceId: sanitizeText(item.serviceId || '', 128),
      name: sanitizeText(item.name || 'Creative Service', 120) || 'Creative Service',
      description: sanitizeText(item.description || '', 400),
      quantity,
      unitPrice,
      total: roundMoney(quantity * unitPrice),
    };
  });
  return sliced.length > 0
    ? sliced
    : [
        {
          serviceId: '',
          name: 'Custom Design',
          description: '',
          quantity: 1,
          unitPrice: 0,
          total: 0,
        },
      ];
}

export function calculateDocumentTotals(
  items: LineItem[],
  discountType: 'fixed' | 'percent',
  discountValue: number,
  currency: CurrencyCode,
  exchangeRate: number,
) {
  const cleanItems = sanitizeLineItems(items);
  const subtotal = roundMoney(cleanItems.reduce((sum, item) => sum + item.total, 0));
  const safeDiscountValue = Math.max(0, roundMoney(Number(discountValue) || 0));
  const rawDiscount =
    discountType === 'percent'
      ? roundMoney((subtotal * Math.min(100, safeDiscountValue)) / 100)
      : Math.min(subtotal, safeDiscountValue);
  const discountAmount = Math.max(0, Math.min(subtotal, rawDiscount));
  const total = roundMoney(Math.max(0, subtotal - discountAmount));
  const effectiveRate = currency === 'INR' ? 1 : Math.max(0.0001, Number(exchangeRate) || 1);
  const totalInr = roundMoney(total * effectiveRate);

  return {
    items: cleanItems,
    subtotal,
    discountValue: safeDiscountValue,
    discountAmount,
    total,
    totalInr,
    exchangeRate: effectiveRate,
  };
}

// ============================================================================
// SETTINGS
// ============================================================================

export async function ensureBusinessSettings(ownerId: string, email = ''): Promise<BusinessSettings> {
  const path = `settings/${ownerId}`;
  const ref = doc(db, 'settings', ownerId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as BusinessSettings;
    }
    const defaults = createDefaultSettings(ownerId, email);
    await setDoc(ref, {
      ...defaults,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return defaults;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveBusinessSettings(
  ownerId: string,
  updates: Omit<BusinessSettings, 'ownerId' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const path = `settings/${ownerId}`;
  const ref = doc(db, 'settings', ownerId);
  try {
    await updateDoc(ref, {
      businessName: sanitizeText(updates.businessName, FIELD_LIMITS.businessName) || 'AM PIXEL STUDIO',
      businessType: sanitizeText(updates.businessType, FIELD_LIMITS.businessType),
      industry: sanitizeText(updates.industry, FIELD_LIMITS.industry),
      country: sanitizeText(updates.country, FIELD_LIMITS.country),
      phone: sanitizeText(updates.phone, FIELD_LIMITS.phone),
      email: sanitizeText(updates.email, FIELD_LIMITS.email),
      instagram: sanitizeText(updates.instagram, FIELD_LIMITS.instagram),
      address: sanitizeText(updates.address, FIELD_LIMITS.address),
      logoDataUrl: (updates.logoDataUrl || '').slice(0, FIELD_LIMITS.logoDataUrl),
      upiId: sanitizeText(updates.upiId, FIELD_LIMITS.upiId),
      bankName: sanitizeText(updates.bankName, FIELD_LIMITS.bankName),
      bankAccountHolder: sanitizeText(updates.bankAccountHolder, FIELD_LIMITS.bankAccountHolder),
      bankAccountNumber: sanitizeText(updates.bankAccountNumber, FIELD_LIMITS.bankAccountNumber),
      bankIfsc: sanitizeText(updates.bankIfsc, FIELD_LIMITS.bankIfsc),
      bankBranch: sanitizeText(updates.bankBranch, FIELD_LIMITS.bankBranch),
      bankSwift: sanitizeText(updates.bankSwift, FIELD_LIMITS.bankSwift),
      defaultCurrency: updates.defaultCurrency,
      invoicePrefix: sanitizeText(updates.invoicePrefix, FIELD_LIMITS.prefix) || 'INV',
      quotationPrefix: sanitizeText(updates.quotationPrefix, FIELD_LIMITS.prefix) || 'QT',
      receiptPrefix: sanitizeText(updates.receiptPrefix, FIELD_LIMITS.prefix) || 'REC',
      nextInvoiceNumber: Math.max(1, Math.min(999999, Math.floor(updates.nextInvoiceNumber || 1))),
      nextQuotationNumber: Math.max(1, Math.min(999999, Math.floor(updates.nextQuotationNumber || 1))),
      nextReceiptNumber: Math.max(1, Math.min(999999, Math.floor(updates.nextReceiptNumber || 1))),
      nextCustomerNumber: Math.max(1, Math.min(999999, Math.floor(updates.nextCustomerNumber || 1))),
      nextProjectNumber: Math.max(1, Math.min(999999, Math.floor(updates.nextProjectNumber || 1))),
      nextExpenseNumber: Math.max(1, Math.min(999999, Math.floor(updates.nextExpenseNumber || 1))),
      defaultTerms: sanitizeText(updates.defaultTerms, FIELD_LIMITS.defaultTerms),
      defaultPaymentInstructions: sanitizeText(
        updates.defaultPaymentInstructions,
        FIELD_LIMITS.defaultPaymentInstructions,
      ),
      pdfAccentColor: sanitizeText(updates.pdfAccentColor, FIELD_LIMITS.pdfAccentColor) || '#064E3B',
      pdfFooterNote: sanitizeText(updates.pdfFooterNote, FIELD_LIMITS.pdfFooterNote),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// CUSTOMERS
// ============================================================================

export type CustomerInput = Omit<Customer, 'id' | 'ownerId' | 'customerCode' | 'createdAt' | 'updatedAt'>;

export async function createCustomer(ownerId: string, input: CustomerInput): Promise<string> {
  const customerId = generateSafeId('cust');
  const settingsRef = doc(db, 'settings', ownerId);
  const customerRef = doc(db, 'customers', customerId);
  try {
    await runTransaction(db, async (tx) => {
      const settingsSnap = await tx.get(settingsRef);
      const seq = settingsSnap.exists()
        ? Number((settingsSnap.data() as BusinessSettings).nextCustomerNumber || 1)
        : 1;
      const customerCode = formatSequentialCode('CUST', seq, false);

      tx.set(customerRef, {
        ownerId,
        customerCode,
        fullName: sanitizeText(input.fullName, FIELD_LIMITS.fullName),
        phone: sanitizeText(input.phone, FIELD_LIMITS.phone),
        email: sanitizeText(input.email, FIELD_LIMITS.email),
        address: sanitizeText(input.address, FIELD_LIMITS.address),
        companyName: sanitizeText(input.companyName, FIELD_LIMITS.companyName),
        customerType: input.customerType,
        notes: sanitizeText(input.notes, FIELD_LIMITS.notes),
        registrationDate: sanitizeText(input.registrationDate || todayISO(), 20),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (settingsSnap.exists()) {
        tx.update(settingsRef, {
          nextCustomerNumber: seq + 1,
          updatedAt: serverTimestamp(),
        });
      }
    });
    return customerId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `customers/${customerId}`);
  }
}

export async function updateCustomer(customerId: string, input: CustomerInput): Promise<void> {
  const path = `customers/${customerId}`;
  try {
    await updateDoc(doc(db, 'customers', customerId), {
      fullName: sanitizeText(input.fullName, FIELD_LIMITS.fullName),
      phone: sanitizeText(input.phone, FIELD_LIMITS.phone),
      email: sanitizeText(input.email, FIELD_LIMITS.email),
      address: sanitizeText(input.address, FIELD_LIMITS.address),
      companyName: sanitizeText(input.companyName, FIELD_LIMITS.companyName),
      customerType: input.customerType,
      notes: sanitizeText(input.notes, FIELD_LIMITS.notes),
      registrationDate: sanitizeText(input.registrationDate || todayISO(), 20),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCustomer(customerId: string): Promise<void> {
  const path = `customers/${customerId}`;
  try {
    await deleteDoc(doc(db, 'customers', customerId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// SERVICES
// ============================================================================

export type ServiceInput = Omit<ServiceItem, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>;

export async function createService(ownerId: string, input: ServiceInput): Promise<string> {
  const serviceId = generateSafeId('srv');
  const path = `services/${serviceId}`;
  try {
    await setDoc(doc(db, 'services', serviceId), {
      ownerId,
      name: sanitizeText(input.name, FIELD_LIMITS.serviceName),
      description: sanitizeText(input.description, FIELD_LIMITS.serviceDescription),
      defaultPrice: Math.max(0, roundMoney(Number(input.defaultPrice) || 0)),
      currency: input.currency,
      estimatedDelivery: sanitizeText(input.estimatedDelivery, FIELD_LIMITS.estimatedDelivery),
      isActive: Boolean(input.isActive),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return serviceId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function seedStarterServices(ownerId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    STARTER_SERVICES_CATALOG.forEach((item, index) => {
      const id = generateSafeId(`srv${index}`);
      batch.set(doc(db, 'services', id), {
        ownerId,
        name: sanitizeText(item.name, FIELD_LIMITS.serviceName),
        description: sanitizeText(item.description, FIELD_LIMITS.serviceDescription),
        defaultPrice: item.defaultPrice,
        currency: item.currency,
        estimatedDelivery: item.estimatedDelivery,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'services');
  }
}

export async function updateService(serviceId: string, input: ServiceInput): Promise<void> {
  const path = `services/${serviceId}`;
  try {
    await updateDoc(doc(db, 'services', serviceId), {
      name: sanitizeText(input.name, FIELD_LIMITS.serviceName),
      description: sanitizeText(input.description, FIELD_LIMITS.serviceDescription),
      defaultPrice: Math.max(0, roundMoney(Number(input.defaultPrice) || 0)),
      currency: input.currency,
      estimatedDelivery: sanitizeText(input.estimatedDelivery, FIELD_LIMITS.estimatedDelivery),
      isActive: Boolean(input.isActive),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteService(serviceId: string): Promise<void> {
  const path = `services/${serviceId}`;
  try {
    await deleteDoc(doc(db, 'services', serviceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// PROJECTS
// ============================================================================

export type ProjectInput = Omit<Project, 'id' | 'ownerId' | 'projectCode' | 'createdAt' | 'updatedAt'>;

export async function createProject(ownerId: string, input: ProjectInput): Promise<string> {
  const projectId = generateSafeId('prj');
  const settingsRef = doc(db, 'settings', ownerId);
  const projectRef = doc(db, 'projects', projectId);
  try {
    await runTransaction(db, async (tx) => {
      const settingsSnap = await tx.get(settingsRef);
      const seq = settingsSnap.exists()
        ? Number((settingsSnap.data() as BusinessSettings).nextProjectNumber || 1)
        : 1;
      const projectCode = formatSequentialCode('PRJ', seq, true);

      tx.set(projectRef, {
        ownerId,
        projectCode,
        customerId: input.customerId,
        customerName: sanitizeText(input.customerName, FIELD_LIMITS.fullName),
        projectName: sanitizeText(input.projectName, FIELD_LIMITS.projectName),
        serviceId: sanitizeText(input.serviceId || '', 128),
        serviceName: sanitizeText(input.serviceName || '', FIELD_LIMITS.serviceName),
        startDate: sanitizeText(input.startDate || todayISO(), 20),
        deadline: sanitizeText(input.deadline || '', 20),
        budget: Math.max(0, roundMoney(Number(input.budget) || 0)),
        currency: input.currency,
        status: input.status,
        progress: Math.max(0, Math.min(100, Math.round(Number(input.progress) || 0))),
        notes: sanitizeText(input.notes, FIELD_LIMITS.projectNotes),
        linkedQuotationId: sanitizeText(input.linkedQuotationId || '', 128),
        linkedInvoiceId: sanitizeText(input.linkedInvoiceId || '', 128),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (settingsSnap.exists()) {
        tx.update(settingsRef, {
          nextProjectNumber: seq + 1,
          updatedAt: serverTimestamp(),
        });
      }
    });
    return projectId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `projects/${projectId}`);
  }
}

export async function updateProject(projectId: string, input: ProjectInput): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      customerId: input.customerId,
      customerName: sanitizeText(input.customerName, FIELD_LIMITS.fullName),
      projectName: sanitizeText(input.projectName, FIELD_LIMITS.projectName),
      serviceId: sanitizeText(input.serviceId || '', 128),
      serviceName: sanitizeText(input.serviceName || '', FIELD_LIMITS.serviceName),
      startDate: sanitizeText(input.startDate || todayISO(), 20),
      deadline: sanitizeText(input.deadline || '', 20),
      budget: Math.max(0, roundMoney(Number(input.budget) || 0)),
      currency: input.currency,
      status: input.status,
      progress: Math.max(0, Math.min(100, Math.round(Number(input.progress) || 0))),
      notes: sanitizeText(input.notes, FIELD_LIMITS.projectNotes),
      linkedQuotationId: sanitizeText(input.linkedQuotationId || '', 128),
      linkedInvoiceId: sanitizeText(input.linkedInvoiceId || '', 128),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// QUOTATIONS
// ============================================================================

export type QuotationInput = Omit<
  Quotation,
  | 'id'
  | 'ownerId'
  | 'quotationNumber'
  | 'subtotal'
  | 'discountAmount'
  | 'total'
  | 'totalInr'
  | 'convertedInvoiceId'
  | 'createdAt'
  | 'updatedAt'
>;

export async function createQuotation(ownerId: string, input: QuotationInput): Promise<string> {
  const quotationId = generateSafeId('qt');
  const settingsRef = doc(db, 'settings', ownerId);
  const qtRef = doc(db, 'quotations', quotationId);

  const totals = calculateDocumentTotals(
    input.items,
    input.discountType,
    input.discountValue,
    input.currency,
    input.exchangeRate,
  );

  try {
    await runTransaction(db, async (tx) => {
      const settingsSnap = await tx.get(settingsRef);
      const settingsData = settingsSnap.exists() ? (settingsSnap.data() as BusinessSettings) : null;
      const prefix = settingsData?.quotationPrefix || 'QT';
      const seq = Number(settingsData?.nextQuotationNumber || 1);
      const quotationNumber = formatSequentialCode(prefix, seq, true);

      tx.set(qtRef, {
        ownerId,
        quotationNumber,
        customerId: input.customerId,
        customerName: sanitizeText(input.customerName, FIELD_LIMITS.fullName),
        customerEmail: sanitizeText(input.customerEmail, FIELD_LIMITS.email),
        customerPhone: sanitizeText(input.customerPhone, FIELD_LIMITS.phone),
        customerAddress: sanitizeText(input.customerAddress, FIELD_LIMITS.address),
        issueDate: sanitizeText(input.issueDate || todayISO(), 20),
        validityDate: sanitizeText(input.validityDate || todayISO(), 20),
        currency: input.currency,
        exchangeRate: totals.exchangeRate,
        exchangeRateSource:
          input.currency === 'INR'
            ? 'Base Currency (INR)'
            : sanitizeText(input.exchangeRateSource || 'Manual Rate Entry', FIELD_LIMITS.exchangeRateSource),
        items: totals.items,
        subtotal: totals.subtotal,
        discountType: input.discountType,
        discountValue: totals.discountValue,
        discountAmount: totals.discountAmount,
        total: totals.total,
        totalInr: totals.totalInr,
        status: input.status,
        notes: sanitizeText(input.notes, FIELD_LIMITS.docNotes),
        terms: sanitizeText(input.terms, FIELD_LIMITS.defaultTerms),
        convertedInvoiceId: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (settingsSnap.exists()) {
        tx.update(settingsRef, {
          nextQuotationNumber: seq + 1,
          updatedAt: serverTimestamp(),
        });
      }
    });
    return quotationId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `quotations/${quotationId}`);
  }
}

export async function updateQuotation(
  quotationId: string,
  input: QuotationInput & { convertedInvoiceId?: string },
): Promise<void> {
  const path = `quotations/${quotationId}`;
  const totals = calculateDocumentTotals(
    input.items,
    input.discountType,
    input.discountValue,
    input.currency,
    input.exchangeRate,
  );
  try {
    await updateDoc(doc(db, 'quotations', quotationId), {
      customerId: input.customerId,
      customerName: sanitizeText(input.customerName, FIELD_LIMITS.fullName),
      customerEmail: sanitizeText(input.customerEmail, FIELD_LIMITS.email),
      customerPhone: sanitizeText(input.customerPhone, FIELD_LIMITS.phone),
      customerAddress: sanitizeText(input.customerAddress, FIELD_LIMITS.address),
      issueDate: sanitizeText(input.issueDate || todayISO(), 20),
      validityDate: sanitizeText(input.validityDate || todayISO(), 20),
      currency: input.currency,
      exchangeRate: totals.exchangeRate,
      exchangeRateSource:
        input.currency === 'INR'
          ? 'Base Currency (INR)'
          : sanitizeText(input.exchangeRateSource || 'Manual Rate Entry', FIELD_LIMITS.exchangeRateSource),
      items: totals.items,
      subtotal: totals.subtotal,
      discountType: input.discountType,
      discountValue: totals.discountValue,
      discountAmount: totals.discountAmount,
      total: totals.total,
      totalInr: totals.totalInr,
      status: input.status,
      notes: sanitizeText(input.notes, FIELD_LIMITS.docNotes),
      terms: sanitizeText(input.terms, FIELD_LIMITS.defaultTerms),
      convertedInvoiceId: sanitizeText(input.convertedInvoiceId ?? '', 128),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteQuotation(quotationId: string): Promise<void> {
  const path = `quotations/${quotationId}`;
  try {
    await deleteDoc(doc(db, 'quotations', quotationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function convertQuotationToInvoice(
  ownerId: string,
  quotation: Quotation,
  dueDate: string,
  paymentInstructions: string,
): Promise<string> {
  const invoiceId = generateSafeId('inv');
  const settingsRef = doc(db, 'settings', ownerId);
  const quotationRef = doc(db, 'quotations', quotation.id);
  const invoiceRef = doc(db, 'invoices', invoiceId);

  try {
    await runTransaction(db, async (tx) => {
      const settingsSnap = await tx.get(settingsRef);
      const settingsData = settingsSnap.exists() ? (settingsSnap.data() as BusinessSettings) : null;
      const prefix = settingsData?.invoicePrefix || 'INV';
      const seq = Number(settingsData?.nextInvoiceNumber || 1);
      const invoiceNumber = formatSequentialCode(prefix, seq, true);

      tx.set(invoiceRef, {
        ownerId,
        invoiceNumber,
        customerId: quotation.customerId,
        customerName: quotation.customerName,
        customerEmail: quotation.customerEmail,
        customerPhone: quotation.customerPhone,
        customerAddress: quotation.customerAddress,
        issueDate: todayISO(),
        dueDate: sanitizeText(dueDate || todayISO(), 20),
        currency: quotation.currency,
        exchangeRate: quotation.exchangeRate,
        exchangeRateSource: quotation.exchangeRateSource,
        items: sanitizeLineItems(quotation.items),
        subtotal: quotation.subtotal,
        discountType: quotation.discountType,
        discountValue: quotation.discountValue,
        discountAmount: quotation.discountAmount,
        grandTotal: quotation.total,
        grandTotalInr: quotation.totalInr,
        amountPaid: 0,
        amountPaidInr: 0,
        balanceDue: quotation.total,
        balanceDueInr: quotation.totalInr,
        status: 'Unpaid',
        notes: quotation.notes,
        paymentInstructions: sanitizeText(paymentInstructions, FIELD_LIMITS.defaultPaymentInstructions),
        sourceQuotationId: quotation.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.update(quotationRef, {
        status: 'Accepted',
        convertedInvoiceId: invoiceId,
        updatedAt: serverTimestamp(),
      });

      if (settingsSnap.exists()) {
        tx.update(settingsRef, {
          nextInvoiceNumber: seq + 1,
          updatedAt: serverTimestamp(),
        });
      }
    });
    return invoiceId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `invoices/${invoiceId}`);
  }
}

// ============================================================================
// INVOICES
// ============================================================================

export type InvoiceInput = Omit<
  Invoice,
  | 'id'
  | 'ownerId'
  | 'invoiceNumber'
  | 'subtotal'
  | 'discountAmount'
  | 'grandTotal'
  | 'grandTotalInr'
  | 'amountPaid'
  | 'amountPaidInr'
  | 'balanceDue'
  | 'balanceDueInr'
  | 'createdAt'
  | 'updatedAt'
>;

export async function createInvoice(ownerId: string, input: InvoiceInput): Promise<string> {
  const invoiceId = generateSafeId('inv');
  const settingsRef = doc(db, 'settings', ownerId);
  const invRef = doc(db, 'invoices', invoiceId);

  const totals = calculateDocumentTotals(
    input.items,
    input.discountType,
    input.discountValue,
    input.currency,
    input.exchangeRate,
  );
  // Accounting rule: Never mark an invoice Paid upon creation without recorded payment
  const initialStatus: InvoiceStatus = input.status === 'Draft' ? 'Draft' : 'Unpaid';

  try {
    await runTransaction(db, async (tx) => {
      const settingsSnap = await tx.get(settingsRef);
      const settingsData = settingsSnap.exists() ? (settingsSnap.data() as BusinessSettings) : null;
      const prefix = settingsData?.invoicePrefix || 'INV';
      const seq = Number(settingsData?.nextInvoiceNumber || 1);
      const invoiceNumber = formatSequentialCode(prefix, seq, true);

      tx.set(invRef, {
        ownerId,
        invoiceNumber,
        customerId: input.customerId,
        customerName: sanitizeText(input.customerName, FIELD_LIMITS.fullName),
        customerEmail: sanitizeText(input.customerEmail, FIELD_LIMITS.email),
        customerPhone: sanitizeText(input.customerPhone, FIELD_LIMITS.phone),
        customerAddress: sanitizeText(input.customerAddress, FIELD_LIMITS.address),
        issueDate: sanitizeText(input.issueDate || todayISO(), 20),
        dueDate: sanitizeText(input.dueDate || todayISO(), 20),
        currency: input.currency,
        exchangeRate: totals.exchangeRate,
        exchangeRateSource:
          input.currency === 'INR'
            ? 'Base Currency (INR)'
            : sanitizeText(input.exchangeRateSource || 'Manual Rate Entry', FIELD_LIMITS.exchangeRateSource),
        items: totals.items,
        subtotal: totals.subtotal,
        discountType: input.discountType,
        discountValue: totals.discountValue,
        discountAmount: totals.discountAmount,
        grandTotal: totals.total,
        grandTotalInr: totals.totalInr,
        amountPaid: 0,
        amountPaidInr: 0,
        balanceDue: totals.total,
        balanceDueInr: totals.totalInr,
        status: initialStatus,
        notes: sanitizeText(input.notes, FIELD_LIMITS.docNotes),
        paymentInstructions: sanitizeText(
          input.paymentInstructions,
          FIELD_LIMITS.defaultPaymentInstructions,
        ),
        sourceQuotationId: sanitizeText(input.sourceQuotationId || '', 128),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (settingsSnap.exists()) {
        tx.update(settingsRef, {
          nextInvoiceNumber: seq + 1,
          updatedAt: serverTimestamp(),
        });
      }
    });
    return invoiceId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `invoices/${invoiceId}`);
  }
}

export async function updateInvoice(existingInvoice: Invoice, input: InvoiceInput): Promise<void> {
  const path = `invoices/${existingInvoice.id}`;
  const totals = calculateDocumentTotals(
    input.items,
    input.discountType,
    input.discountValue,
    input.currency,
    input.exchangeRate,
  );
  const balanceDue = roundMoney(Math.max(0, totals.total - existingInvoice.amountPaid));
  const balanceDueInr = roundMoney(Math.max(0, totals.totalInr - existingInvoice.amountPaidInr));

  // Enforce accounting rule: status can only be Paid if recorded payments cover grandTotal
  let nextStatus: InvoiceStatus = input.status;
  if (nextStatus === 'Paid' && existingInvoice.amountPaid + 0.01 < totals.total) {
    nextStatus = existingInvoice.amountPaid > 0 ? 'Partially Paid' : 'Unpaid';
  } else if (nextStatus !== 'Cancelled' && nextStatus !== 'Draft') {
    if (existingInvoice.amountPaid > 0 && balanceDue <= 0.01) {
      nextStatus = 'Paid';
    } else if (existingInvoice.amountPaid > 0) {
      nextStatus = 'Partially Paid';
    }
  }

  try {
    await updateDoc(doc(db, 'invoices', existingInvoice.id), {
      customerId: input.customerId,
      customerName: sanitizeText(input.customerName, FIELD_LIMITS.fullName),
      customerEmail: sanitizeText(input.customerEmail, FIELD_LIMITS.email),
      customerPhone: sanitizeText(input.customerPhone, FIELD_LIMITS.phone),
      customerAddress: sanitizeText(input.customerAddress, FIELD_LIMITS.address),
      issueDate: sanitizeText(input.issueDate || todayISO(), 20),
      dueDate: sanitizeText(input.dueDate || todayISO(), 20),
      currency: input.currency,
      exchangeRate: totals.exchangeRate,
      exchangeRateSource:
        input.currency === 'INR'
          ? 'Base Currency (INR)'
          : sanitizeText(input.exchangeRateSource || 'Manual Rate Entry', FIELD_LIMITS.exchangeRateSource),
      items: totals.items,
      subtotal: totals.subtotal,
      discountType: input.discountType,
      discountValue: totals.discountValue,
      discountAmount: totals.discountAmount,
      grandTotal: totals.total,
      grandTotalInr: totals.totalInr,
      balanceDue,
      balanceDueInr,
      status: nextStatus,
      notes: sanitizeText(input.notes, FIELD_LIMITS.docNotes),
      paymentInstructions: sanitizeText(
        input.paymentInstructions,
        FIELD_LIMITS.defaultPaymentInstructions,
      ),
      sourceQuotationId: sanitizeText(input.sourceQuotationId || '', 128),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cancelInvoice(invoiceId: string): Promise<void> {
  const path = `invoices/${invoiceId}`;
  try {
    await updateDoc(doc(db, 'invoices', invoiceId), {
      status: 'Cancelled',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  const path = `invoices/${invoiceId}`;
  try {
    await deleteDoc(doc(db, 'invoices', invoiceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// PAYMENTS & RECEIPTS (Atomic Invoice Balance Sync)
// ============================================================================

export type PaymentInput = Omit<
  Payment,
  | 'id'
  | 'ownerId'
  | 'receiptNumber'
  | 'inrEquivalent'
  | 'netAmountReceivedInr'
  | 'createdAt'
  | 'updatedAt'
>;

export async function recordPayment(ownerId: string, input: PaymentInput): Promise<string> {
  const paymentId = generateSafeId('pay');
  const settingsRef = doc(db, 'settings', ownerId);
  const invoiceRef = doc(db, 'invoices', input.invoiceId);
  const paymentRef = doc(db, 'payments', paymentId);

  const originalAmount = Math.max(0.01, roundMoney(Number(input.originalAmount) || 0));
  const exchangeRate =
    input.originalCurrency === 'INR' ? 1 : Math.max(0.0001, Number(input.exchangeRate) || 1);
  const inrEquivalent = roundMoney(originalAmount * exchangeRate);
  const transferFees = Math.max(0, roundMoney(Number(input.transferFees) || 0));
  const netAmountReceivedInr = roundMoney(Math.max(0, inrEquivalent - transferFees));

  try {
    await runTransaction(db, async (tx) => {
      const [settingsSnap, invoiceSnap] = await Promise.all([
        tx.get(settingsRef),
        tx.get(invoiceRef),
      ]);

      if (!invoiceSnap.exists()) {
        throw new Error('Linked invoice does not exist.');
      }

      const invoice = invoiceSnap.data() as Invoice;
      if (invoice.status === 'Cancelled') {
        throw new Error('Cannot record a payment against a cancelled invoice.');
      }

      const settingsData = settingsSnap.exists() ? (settingsSnap.data() as BusinessSettings) : null;
      const prefix = settingsData?.receiptPrefix || 'REC';
      const seq = Number(settingsData?.nextReceiptNumber || 1);
      const receiptNumber = formatSequentialCode(prefix, seq, true);

      // Compute credited amount in invoice's currency
      let creditedInInvoiceCurrency = originalAmount;
      if (input.originalCurrency !== invoice.currency) {
        const invRate = invoice.currency === 'INR' ? 1 : Math.max(0.0001, invoice.exchangeRate || 1);
        creditedInInvoiceCurrency = roundMoney(inrEquivalent / invRate);
      }

      const newAmountPaid = roundMoney(invoice.amountPaid + creditedInInvoiceCurrency);
      const newAmountPaidInr = roundMoney(invoice.amountPaidInr + netAmountReceivedInr);
      const newBalanceDue = roundMoney(Math.max(0, invoice.grandTotal - newAmountPaid));
      const newBalanceDueInr = roundMoney(Math.max(0, invoice.grandTotalInr - newAmountPaidInr));

      let newStatus: InvoiceStatus = 'Partially Paid';
      if (newBalanceDue <= 0.01) {
        newStatus = 'Paid';
      } else if (newAmountPaid <= 0.01) {
        newStatus = 'Unpaid';
      }

      tx.set(paymentRef, {
        ownerId,
        receiptNumber,
        invoiceId: input.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        paymentDate: sanitizeText(input.paymentDate || todayISO(), 20),
        paymentType: input.paymentType,
        paymentMethod: input.paymentMethod,
        originalCurrency: input.originalCurrency,
        originalAmount,
        exchangeRate,
        exchangeRateSource:
          input.originalCurrency === 'INR'
            ? 'Base Currency (INR)'
            : sanitizeText(input.exchangeRateSource || 'Manual Rate Entry', FIELD_LIMITS.exchangeRateSource),
        inrEquivalent,
        transferFees,
        netAmountReceivedInr,
        transactionReference: sanitizeText(input.transactionReference, FIELD_LIMITS.transactionReference),
        notes: sanitizeText(input.notes, FIELD_LIMITS.notes),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.update(invoiceRef, {
        amountPaid: newAmountPaid,
        amountPaidInr: newAmountPaidInr,
        balanceDue: newBalanceDue,
        balanceDueInr: newBalanceDueInr,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      if (settingsSnap.exists()) {
        tx.update(settingsRef, {
          nextReceiptNumber: seq + 1,
          updatedAt: serverTimestamp(),
        });
      }
    });
    return paymentId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `payments/${paymentId}`);
  }
}

export async function deletePaymentAndReverseInvoice(payment: Payment): Promise<void> {
  const paymentRef = doc(db, 'payments', payment.id);
  const invoiceRef = doc(db, 'invoices', payment.invoiceId);
  try {
    await runTransaction(db, async (tx) => {
      const invoiceSnap = await tx.get(invoiceRef);
      tx.delete(paymentRef);

      if (invoiceSnap.exists()) {
        const invoice = invoiceSnap.data() as Invoice;
        if (invoice.status !== 'Cancelled') {
          let deductedInInvoiceCurrency = payment.originalAmount;
          if (payment.originalCurrency !== invoice.currency) {
            const invRate = invoice.currency === 'INR' ? 1 : Math.max(0.0001, invoice.exchangeRate || 1);
            deductedInInvoiceCurrency = roundMoney(payment.inrEquivalent / invRate);
          }

          const newAmountPaid = roundMoney(Math.max(0, invoice.amountPaid - deductedInInvoiceCurrency));
          const newAmountPaidInr = roundMoney(
            Math.max(0, invoice.amountPaidInr - payment.netAmountReceivedInr),
          );
          const newBalanceDue = roundMoney(Math.max(0, invoice.grandTotal - newAmountPaid));
          const newBalanceDueInr = roundMoney(Math.max(0, invoice.grandTotalInr - newAmountPaidInr));

          let newStatus: InvoiceStatus = 'Unpaid';
          if (newBalanceDue <= 0.01 && newAmountPaid > 0) {
            newStatus = 'Paid';
          } else if (newAmountPaid > 0.01) {
            newStatus = 'Partially Paid';
          } else if (invoice.dueDate && invoice.dueDate < todayISO()) {
            newStatus = 'Overdue';
          }

          tx.update(invoiceRef, {
            amountPaid: newAmountPaid,
            amountPaidInr: newAmountPaidInr,
            balanceDue: newBalanceDue,
            balanceDueInr: newBalanceDueInr,
            status: newStatus,
            updatedAt: serverTimestamp(),
          });
        }
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `payments/${payment.id}`);
  }
}

// ============================================================================
// EXPENSES
// ============================================================================

export type ExpenseInput = Omit<
  Expense,
  'id' | 'ownerId' | 'expenseCode' | 'inrEquivalent' | 'netAmountInr' | 'createdAt' | 'updatedAt'
>;

export async function createExpense(ownerId: string, input: ExpenseInput): Promise<string> {
  const expenseId = generateSafeId('exp');
  const settingsRef = doc(db, 'settings', ownerId);
  const expenseRef = doc(db, 'expenses', expenseId);

  const originalAmount = Math.max(0.01, roundMoney(Number(input.originalAmount) || 0));
  const exchangeRate =
    input.originalCurrency === 'INR' ? 1 : Math.max(0.0001, Number(input.exchangeRate) || 1);
  const inrEquivalent = roundMoney(originalAmount * exchangeRate);
  const transferFees = Math.max(0, roundMoney(Number(input.transferFees) || 0));
  const netAmountInr = roundMoney(inrEquivalent + transferFees);

  try {
    await runTransaction(db, async (tx) => {
      const settingsSnap = await tx.get(settingsRef);
      const seq = settingsSnap.exists()
        ? Number((settingsSnap.data() as BusinessSettings).nextExpenseNumber || 1)
        : 1;
      const expenseCode = formatSequentialCode('EXP', seq, true);

      tx.set(expenseRef, {
        ownerId,
        expenseCode,
        date: sanitizeText(input.date || todayISO(), 20),
        category: input.category,
        description: sanitizeText(input.description, FIELD_LIMITS.expenseDescription),
        originalCurrency: input.originalCurrency,
        originalAmount,
        exchangeRate,
        exchangeRateSource:
          input.originalCurrency === 'INR'
            ? 'Base Currency (INR)'
            : sanitizeText(input.exchangeRateSource || 'Manual Rate Entry', FIELD_LIMITS.exchangeRateSource),
        inrEquivalent,
        transferFees,
        netAmountInr,
        paymentMethod: input.paymentMethod,
        vendor: sanitizeText(input.vendor, FIELD_LIMITS.vendor),
        referenceNumber: sanitizeText(input.referenceNumber, FIELD_LIMITS.transactionReference),
        attachmentUrl: (input.attachmentUrl || '').slice(0, FIELD_LIMITS.attachmentUrl),
        attachmentName: sanitizeText(input.attachmentName, FIELD_LIMITS.attachmentName),
        notes: sanitizeText(input.notes, FIELD_LIMITS.notes),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (settingsSnap.exists()) {
        tx.update(settingsRef, {
          nextExpenseNumber: seq + 1,
          updatedAt: serverTimestamp(),
        });
      }
    });
    return expenseId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `expenses/${expenseId}`);
  }
}

export async function updateExpense(expenseId: string, input: ExpenseInput): Promise<void> {
  const path = `expenses/${expenseId}`;
  const originalAmount = Math.max(0.01, roundMoney(Number(input.originalAmount) || 0));
  const exchangeRate =
    input.originalCurrency === 'INR' ? 1 : Math.max(0.0001, Number(input.exchangeRate) || 1);
  const inrEquivalent = roundMoney(originalAmount * exchangeRate);
  const transferFees = Math.max(0, roundMoney(Number(input.transferFees) || 0));
  const netAmountInr = roundMoney(inrEquivalent + transferFees);

  try {
    await updateDoc(doc(db, 'expenses', expenseId), {
      date: sanitizeText(input.date || todayISO(), 20),
      category: input.category,
      description: sanitizeText(input.description, FIELD_LIMITS.expenseDescription),
      originalCurrency: input.originalCurrency,
      originalAmount,
      exchangeRate,
      exchangeRateSource:
        input.originalCurrency === 'INR'
          ? 'Base Currency (INR)'
          : sanitizeText(input.exchangeRateSource || 'Manual Rate Entry', FIELD_LIMITS.exchangeRateSource),
      inrEquivalent,
      transferFees,
      netAmountInr,
      paymentMethod: input.paymentMethod,
      vendor: sanitizeText(input.vendor, FIELD_LIMITS.vendor),
      referenceNumber: sanitizeText(input.referenceNumber, FIELD_LIMITS.transactionReference),
      attachmentUrl: (input.attachmentUrl || '').slice(0, FIELD_LIMITS.attachmentUrl),
      attachmentName: sanitizeText(input.attachmentName, FIELD_LIMITS.attachmentName),
      notes: sanitizeText(input.notes, FIELD_LIMITS.notes),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const path = `expenses/${expenseId}`;
  try {
    await deleteDoc(doc(db, 'expenses', expenseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Helper for getting collection reference with ownerId
export function getOwnerCollectionRef(name: string) {
  return collection(db, name);
}
