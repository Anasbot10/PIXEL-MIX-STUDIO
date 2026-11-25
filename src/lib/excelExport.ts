import * as XLSX from 'xlsx';
import type {
  BusinessSettings,
  Customer,
  Expense,
  Invoice,
  Payment,
  Project,
  Quotation,
  ServiceItem,
} from '../types/erp';

export function exportReportToExcel(
  sheetName: string,
  rows: Record<string, string | number>[],
  filename: string,
): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Message: 'No records in selected period' }]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportFullDatabaseExcel(data: {
  settings: BusinessSettings;
  customers: Customer[];
  services: ServiceItem[];
  projects: Project[];
  quotations: Quotation[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
}): void {
  const wb = XLSX.utils.book_new();

  const appendSheet = (name: string, rows: Record<string, unknown>[]) => {
    const safeRows = rows.length > 0 ? rows : [{ Info: 'No records' }];
    const ws = XLSX.utils.json_to_sheet(safeRows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };

  appendSheet(
    'Customers',
    data.customers.map((c) => ({
      Code: c.customerCode,
      Name: c.fullName,
      Company: c.companyName,
      Type: c.customerType,
      Phone: c.phone,
      Email: c.email,
      Address: c.address,
      Registered: c.registrationDate,
      Notes: c.notes,
    })),
  );

  appendSheet(
    'Services',
    data.services.map((s) => ({
      Service: s.name,
      Description: s.description,
      DefaultPrice: s.defaultPrice,
      Currency: s.currency,
      Delivery: s.estimatedDelivery,
      Active: s.isActive ? 'Yes' : 'No',
    })),
  );

  appendSheet(
    'Projects',
    data.projects.map((p) => ({
      Code: p.projectCode,
      ProjectName: p.projectName,
      Customer: p.customerName,
      Service: p.serviceName,
      StartDate: p.startDate,
      Deadline: p.deadline,
      Budget: p.budget,
      Currency: p.currency,
      Status: p.status,
      ProgressPercent: p.progress,
    })),
  );

  appendSheet(
    'Quotations',
    data.quotations.map((q) => ({
      QuotationNo: q.quotationNumber,
      Customer: q.customerName,
      IssueDate: q.issueDate,
      ValidUntil: q.validityDate,
      Currency: q.currency,
      Total: q.total,
      TotalINR: q.totalInr,
      Status: q.status,
    })),
  );

  appendSheet(
    'Invoices',
    data.invoices.map((i) => ({
      InvoiceNo: i.invoiceNumber,
      Customer: i.customerName,
      IssueDate: i.issueDate,
      DueDate: i.dueDate,
      Currency: i.currency,
      ExchangeRate: i.exchangeRate,
      GrandTotal: i.grandTotal,
      GrandTotalINR: i.grandTotalInr,
      AmountPaidINR: i.amountPaidInr,
      BalanceDueINR: i.balanceDueInr,
      Status: i.status,
    })),
  );

  appendSheet(
    'Payments',
    data.payments.map((p) => ({
      ReceiptNo: p.receiptNumber,
      Date: p.paymentDate,
      InvoiceNo: p.invoiceNumber,
      Customer: p.customerName,
      Type: p.paymentType,
      Method: p.paymentMethod,
      OriginalCurrency: p.originalCurrency,
      OriginalAmount: p.originalAmount,
      ExchangeRate: p.exchangeRate,
      RateSource: p.exchangeRateSource,
      INREquivalent: p.inrEquivalent,
      TransferFeesINR: p.transferFees,
      NetReceivedINR: p.netAmountReceivedInr,
      Reference: p.transactionReference,
    })),
  );

  appendSheet(
    'Expenses',
    data.expenses.map((e) => ({
      Code: e.expenseCode,
      Date: e.date,
      Category: e.category,
      Description: e.description,
      Vendor: e.vendor,
      Method: e.paymentMethod,
      OriginalCurrency: e.originalCurrency,
      OriginalAmount: e.originalAmount,
      ExchangeRate: e.exchangeRate,
      NetAmountINR: e.netAmountInr,
      Reference: e.referenceNumber,
    })),
  );

  const dateStamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `AM_PIXEL_STUDIO_Backup_${dateStamp}.xlsx`);
}

export function exportFullDatabaseJson(data: Record<string, unknown>): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AM_PIXEL_STUDIO_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
