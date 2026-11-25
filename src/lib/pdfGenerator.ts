import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { BusinessSettings, Invoice, Payment, Quotation } from '../types/erp';
import { formatDisplayDate, formatPdfCurrency, getEffectiveInvoiceStatus } from './format';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [6, 78, 59];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return [6, 78, 59];
  return [r, g, b];
}

function renderStudioHeader(
  pdf: jsPDF,
  settings: BusinessSettings,
  documentTitle: string,
  documentNumber: string,
  statusLabel: string,
): number {
  const accent = hexToRgb(settings.pdfAccentColor || '#064E3B');
  const gold: [number, number, number] = [184, 145, 70];
  const pageWidth = pdf.internal.pageSize.getWidth();

  // Top emerald accent bar + thin gold hairline
  pdf.setFillColor(...accent);
  pdf.rect(0, 0, pageWidth, 8, 'F');
  pdf.setFillColor(...gold);
  pdf.rect(0, 8, pageWidth, 1.2, 'F');

  let leftX = 14;
  if (settings.logoDataUrl && settings.logoDataUrl.startsWith('data:image/')) {
    try {
      const format = settings.logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      pdf.addImage(settings.logoDataUrl, format, 14, 15, 18, 18);
      leftX = 36;
    } catch {
      leftX = 14;
    }
  }

  pdf.setTextColor(...accent);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.text(settings.businessName || 'AM PIXEL STUDIO', leftX, 22);

  pdf.setTextColor(71, 85, 105);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  const subLines: string[] = [];
  if (settings.address) subLines.push(settings.address);
  const contactParts = [
    settings.phone ? `Phone / WhatsApp: ${settings.phone}` : '',
    settings.email ? `Email: ${settings.email}` : '',
  ].filter(Boolean);
  if (contactParts.length > 0) subLines.push(contactParts.join('  |  '));
  if (settings.instagram) subLines.push(`Instagram: ${settings.instagram}`);

  let yPos = 27;
  subLines.forEach((line) => {
    const wrapped = pdf.splitTextToSize(line, 100);
    pdf.text(wrapped, leftX, yPos);
    yPos += wrapped.length * 4;
  });

  // Right document title & number
  pdf.setTextColor(...accent);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(documentTitle, pageWidth - 14, 22, { align: 'right' });

  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(documentNumber, pageWidth - 14, 28, { align: 'right' });

  pdf.setTextColor(100, 116, 139);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Status: ${statusLabel}`, pageWidth - 14, 33.5, { align: 'right' });

  const dividerY = Math.max(yPos + 4, 42);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.4);
  pdf.line(14, dividerY, pageWidth - 14, dividerY);

  return dividerY + 6;
}

function renderFooter(pdf: jsPDF, text: string) {
  const pageCount = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i += 1) {
    pdf.setPage(i);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.8);
    pdf.setTextColor(100, 116, 139);
    const wrapped = pdf.splitTextToSize(text, pageWidth - 50);
    pdf.text(wrapped, 14, pageHeight - 11.5);
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 11.5, { align: 'right' });
  }
}

export function downloadInvoicePdf(invoice: Invoice, settings: BusinessSettings): void {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const accent = hexToRgb(settings.pdfAccentColor || '#064E3B');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const status = getEffectiveInvoiceStatus(invoice);

  let y = renderStudioHeader(pdf, settings, 'COMMERCIAL INVOICE', invoice.invoiceNumber, status);

  // Bill To & Invoice Metadata
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('BILLED TO', 14, y);
  pdf.text('INVOICE DETAILS', pageWidth - 78, y);

  y += 5;
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.text(invoice.customerName, 14, y);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  let leftY = y + 5;
  if (invoice.customerAddress) {
    const addr = pdf.splitTextToSize(invoice.customerAddress, 95);
    pdf.text(addr, 14, leftY);
    leftY += addr.length * 4.2;
  }
  if (invoice.customerPhone) {
    pdf.text(`Phone: ${invoice.customerPhone}`, 14, leftY);
    leftY += 4.5;
  }
  if (invoice.customerEmail) {
    pdf.text(`Email: ${invoice.customerEmail}`, 14, leftY);
    leftY += 4.5;
  }

  let rightY = y;
  const metaRows: Array<[string, string]> = [
    ['Invoice Date:', formatDisplayDate(invoice.issueDate)],
    ['Due Date:', formatDisplayDate(invoice.dueDate)],
    ['Currency:', invoice.currency],
  ];
  if (invoice.currency !== 'INR') {
    metaRows.push(['Exchange Rate:', `1 ${invoice.currency} = INR ${invoice.exchangeRate}`]);
    if (invoice.exchangeRateSource) {
      metaRows.push(['Rate Source:', invoice.exchangeRateSource]);
    }
  }
  metaRows.forEach(([label, val]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(100, 116, 139);
    pdf.text(label, pageWidth - 78, rightY);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(15, 23, 42);
    pdf.text(val, pageWidth - 14, rightY, { align: 'right' });
    rightY += 5;
  });

  const tableStartY = Math.max(leftY, rightY) + 6;

  autoTable(pdf, {
    startY: tableStartY,
    head: [['#', 'Service / Description', 'Qty', 'Unit Price', 'Amount']],
    body: invoice.items.map((item, idx) => [
      String(idx + 1),
      item.description ? `${item.name}\n${item.description}` : item.name,
      String(item.quantity),
      formatPdfCurrency(item.unitPrice, invoice.currency),
      formatPdfCurrency(item.total, invoice.currency),
    ]),
    theme: 'striped',
    headStyles: {
      fillColor: accent,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 18, halign: 'right' },
      3: { cellWidth: 36, halign: 'right' },
      4: { cellWidth: 38, halign: 'right' },
    },
  });

  const finalY = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? tableStartY + 30;
  let summaryY = finalY + 8;

  const summaryX = pageWidth - 88;
  const addSummaryRow = (label: string, value: string, bold = false, highlight = false) => {
    if (highlight) {
      pdf.setFillColor(240, 253, 244);
      pdf.rect(summaryX - 4, summaryY - 4.5, 78, 7.5, 'F');
    }
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(bold ? 10 : 9);
    pdf.setTextColor(bold ? accent[0] : 71, bold ? accent[1] : 85, bold ? accent[2] : 105);
    pdf.text(label, summaryX, summaryY);
    pdf.setTextColor(15, 23, 42);
    pdf.text(value, pageWidth - 14, summaryY, { align: 'right' });
    summaryY += 6.2;
  };

  addSummaryRow('Subtotal', formatPdfCurrency(invoice.subtotal, invoice.currency));
  if (invoice.discountAmount > 0) {
    const discLabel =
      invoice.discountType === 'percent' ? `Discount (${invoice.discountValue}%)` : 'Discount';
    addSummaryRow(discLabel, `- ${formatPdfCurrency(invoice.discountAmount, invoice.currency)}`);
  }
  addSummaryRow('Grand Total', formatPdfCurrency(invoice.grandTotal, invoice.currency), true, true);
  if (invoice.currency !== 'INR') {
    addSummaryRow('INR Equivalent', formatPdfCurrency(invoice.grandTotalInr, 'INR'));
  }
  addSummaryRow('Amount Paid', formatPdfCurrency(invoice.amountPaid, invoice.currency));
  addSummaryRow('Balance Due', formatPdfCurrency(invoice.balanceDue, invoice.currency), true);

  // Payment Instructions & Bank / UPI Details
  let infoY = finalY + 8;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...accent);
  pdf.text('PAYMENT DETAILS', 14, infoY);
  infoY += 5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.2);
  pdf.setTextColor(51, 65, 85);

  const bankLines: string[] = [];
  if (settings.upiId) bankLines.push(`UPI ID: ${settings.upiId}`);
  if (settings.bankAccountHolder) bankLines.push(`Account Name: ${settings.bankAccountHolder}`);
  if (settings.bankName) bankLines.push(`Bank: ${settings.bankName}${settings.bankBranch ? ` (${settings.bankBranch})` : ''}`);
  if (settings.bankAccountNumber) bankLines.push(`Account No: ${settings.bankAccountNumber}`);
  if (settings.bankIfsc) bankLines.push(`IFSC: ${settings.bankIfsc}`);
  if (settings.bankSwift) bankLines.push(`SWIFT / BIC: ${settings.bankSwift}`);

  bankLines.forEach((line) => {
    pdf.text(line, 14, infoY);
    infoY += 4.3;
  });

  if (invoice.paymentInstructions) {
    infoY += 2;
    const wrappedInstr = pdf.splitTextToSize(invoice.paymentInstructions, 95);
    pdf.text(wrappedInstr, 14, infoY);
    infoY += wrappedInstr.length * 4;
  }

  let notesY = Math.max(summaryY, infoY) + 6;
  if (invoice.notes && notesY < 260) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...accent);
    pdf.text('NOTES', 14, notesY);
    notesY += 4.5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.2);
    pdf.setTextColor(71, 85, 105);
    const wrappedNotes = pdf.splitTextToSize(invoice.notes, pageWidth - 28);
    pdf.text(wrappedNotes, 14, notesY);
  }

  const nonGstDisclaimer =
    settings.pdfFooterNote ||
    `${settings.businessName} is not registered under GST. This is a commercial invoice, not a GST tax invoice.`;
  renderFooter(pdf, nonGstDisclaimer);
  pdf.save(`${invoice.invoiceNumber}.pdf`);
}

export function downloadQuotationPdf(quotation: Quotation, settings: BusinessSettings): void {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const accent = hexToRgb(settings.pdfAccentColor || '#064E3B');
  const pageWidth = pdf.internal.pageSize.getWidth();

  let y = renderStudioHeader(pdf, settings, 'QUOTATION', quotation.quotationNumber, quotation.status);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('PREPARED FOR', 14, y);
  pdf.text('QUOTATION DETAILS', pageWidth - 78, y);

  y += 5;
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.text(quotation.customerName, 14, y);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  let leftY = y + 5;
  if (quotation.customerAddress) {
    const addr = pdf.splitTextToSize(quotation.customerAddress, 95);
    pdf.text(addr, 14, leftY);
    leftY += addr.length * 4.2;
  }
  if (quotation.customerPhone) {
    pdf.text(`Phone: ${quotation.customerPhone}`, 14, leftY);
    leftY += 4.5;
  }
  if (quotation.customerEmail) {
    pdf.text(`Email: ${quotation.customerEmail}`, 14, leftY);
    leftY += 4.5;
  }

  let rightY = y;
  const metaRows: Array<[string, string]> = [
    ['Quotation Date:', formatDisplayDate(quotation.issueDate)],
    ['Valid Until:', formatDisplayDate(quotation.validityDate)],
    ['Currency:', quotation.currency],
  ];
  if (quotation.currency !== 'INR') {
    metaRows.push(['Exchange Rate:', `1 ${quotation.currency} = INR ${quotation.exchangeRate}`]);
  }
  metaRows.forEach(([label, val]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(100, 116, 139);
    pdf.text(label, pageWidth - 78, rightY);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(15, 23, 42);
    pdf.text(val, pageWidth - 14, rightY, { align: 'right' });
    rightY += 5;
  });

  const tableStartY = Math.max(leftY, rightY) + 6;
  autoTable(pdf, {
    startY: tableStartY,
    head: [['#', 'Service / Deliverable', 'Qty', 'Unit Price', 'Total']],
    body: quotation.items.map((item, idx) => [
      String(idx + 1),
      item.description ? `${item.name}\n${item.description}` : item.name,
      String(item.quantity),
      formatPdfCurrency(item.unitPrice, quotation.currency),
      formatPdfCurrency(item.total, quotation.currency),
    ]),
    theme: 'striped',
    headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 3.5, textColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 18, halign: 'right' },
      3: { cellWidth: 36, halign: 'right' },
      4: { cellWidth: 38, halign: 'right' },
    },
  });

  const finalY = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? tableStartY + 30;
  let summaryY = finalY + 8;
  const summaryX = pageWidth - 88;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Subtotal', summaryX, summaryY);
  pdf.setTextColor(15, 23, 42);
  pdf.text(formatPdfCurrency(quotation.subtotal, quotation.currency), pageWidth - 14, summaryY, {
    align: 'right',
  });
  summaryY += 6;

  if (quotation.discountAmount > 0) {
    const discLabel =
      quotation.discountType === 'percent' ? `Discount (${quotation.discountValue}%)` : 'Discount';
    pdf.setTextColor(71, 85, 105);
    pdf.text(discLabel, summaryX, summaryY);
    pdf.setTextColor(15, 23, 42);
    pdf.text(
      `- ${formatPdfCurrency(quotation.discountAmount, quotation.currency)}`,
      pageWidth - 14,
      summaryY,
      { align: 'right' },
    );
    summaryY += 6;
  }

  pdf.setFillColor(240, 253, 244);
  pdf.rect(summaryX - 4, summaryY - 4.5, 78, 7.5, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...accent);
  pdf.text('Estimated Total', summaryX, summaryY);
  pdf.setTextColor(15, 23, 42);
  pdf.text(formatPdfCurrency(quotation.total, quotation.currency), pageWidth - 14, summaryY, {
    align: 'right',
  });
  summaryY += 6.5;

  if (quotation.currency !== 'INR') {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text('Approx. INR Equivalent', summaryX, summaryY);
    pdf.text(formatPdfCurrency(quotation.totalInr, 'INR'), pageWidth - 14, summaryY, { align: 'right' });
    summaryY += 6;
  }

  let termsY = summaryY + 8;
  if (quotation.terms) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...accent);
    pdf.text('TERMS & CONDITIONS', 14, termsY);
    termsY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.2);
    pdf.setTextColor(51, 65, 85);
    const wrappedTerms = pdf.splitTextToSize(quotation.terms, pageWidth - 28);
    pdf.text(wrappedTerms, 14, termsY);
    termsY += wrappedTerms.length * 4 + 4;
  }

  if (quotation.notes && termsY < 260) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...accent);
    pdf.text('NOTES', 14, termsY);
    termsY += 4.5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.2);
    pdf.setTextColor(71, 85, 105);
    pdf.text(pdf.splitTextToSize(quotation.notes, pageWidth - 28), 14, termsY);
  }

  renderFooter(
    pdf,
    `${settings.businessName} (Non-GST Registered Freelance Studio) — Commercial Quotation valid until ${formatDisplayDate(quotation.validityDate)}.`,
  );
  pdf.save(`${quotation.quotationNumber}.pdf`);
}

export function downloadReceiptPdf(
  payment: Payment,
  settings: BusinessSettings,
  remainingBalanceInr?: number,
): void {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const accent = hexToRgb(settings.pdfAccentColor || '#064E3B');
  const pageWidth = pdf.internal.pageSize.getWidth();

  let y = renderStudioHeader(
    pdf,
    settings,
    'PAYMENT RECEIPT',
    payment.receiptNumber,
    `${payment.paymentType} Payment Recorded`,
  );

  // Studio-generated receipt clarity notice
  pdf.setFillColor(254, 249, 195);
  pdf.setDrawColor(217, 177, 92);
  pdf.roundedRect(14, y, pageWidth - 28, 12, 1.5, 1.5, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.2);
  pdf.setTextColor(120, 82, 18);
  pdf.text(
    'STUDIO-GENERATED RECEIPT NOTICE: Issued by AM PIXEL STUDIO as acknowledgement of a recorded payment.',
    18,
    y + 5,
  );
  pdf.setFont('helvetica', 'normal');
  pdf.text(
    'This receipt is distinct from bank-issued settlement advices or UPI/SWIFT transaction proofs.',
    18,
    y + 9.5,
  );

  y += 19;

  const rows: Array<[string, string]> = [
    ['Receipt Number', payment.receiptNumber],
    ['Payment Date', formatDisplayDate(payment.paymentDate)],
    ['Received From', payment.customerName],
    ['Linked Invoice', payment.invoiceNumber],
    ['Payment Type', `${payment.paymentType} Payment`],
    ['Payment Method', payment.paymentMethod],
    ['Transaction Reference', payment.transactionReference || 'Not provided'],
    [
      'Amount Received (Original)',
      formatPdfCurrency(payment.originalAmount, payment.originalCurrency),
    ],
  ];

  if (payment.originalCurrency !== 'INR') {
    rows.push(['Manual Exchange Rate', `1 ${payment.originalCurrency} = INR ${payment.exchangeRate}`]);
    rows.push(['Exchange Rate Source', payment.exchangeRateSource || 'Manual Rate Entry']);
    rows.push(['INR Equivalent (Gross)', formatPdfCurrency(payment.inrEquivalent, 'INR')]);
  }
  if (payment.transferFees > 0) {
    rows.push(['Transfer / Settlement Fees', formatPdfCurrency(payment.transferFees, 'INR')]);
  }
  rows.push(['Net Amount Received (INR)', formatPdfCurrency(payment.netAmountReceivedInr, 'INR')]);

  if (typeof remainingBalanceInr === 'number') {
    rows.push(['Remaining Invoice Balance (INR)', formatPdfCurrency(remainingBalanceInr, 'INR')]);
  }

  autoTable(pdf, {
    startY: y,
    head: [['Receipt Field', 'Recorded Value']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 4, textColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 68, fontStyle: 'bold', textColor: [71, 85, 105] },
    },
  });

  const finalY = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 90;
  let noteY = finalY + 10;
  if (payment.notes) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...accent);
    pdf.text('NOTES', 14, noteY);
    noteY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(51, 65, 85);
    pdf.text(pdf.splitTextToSize(payment.notes, pageWidth - 28), 14, noteY);
  }

  renderFooter(
    pdf,
    `${settings.businessName} — Studio-Generated Payment Receipt (Not a bank-issued transaction proof; Non-GST business).`,
  );
  pdf.save(`${payment.receiptNumber}.pdf`);
}

export function downloadFinancialReportPdf(
  title: string,
  periodLabel: string,
  settings: BusinessSettings,
  summaryItems: Array<{ label: string; value: string }>,
  tableHeaders: string[],
  tableRows: string[][],
  filename: string,
): void {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const accent = hexToRgb(settings.pdfAccentColor || '#064E3B');

  let y = renderStudioHeader(pdf, settings, 'FINANCIAL REPORT', title, periodLabel);

  autoTable(pdf, {
    startY: y,
    head: [['Key Financial Metric', 'Amount / Value']],
    body: summaryItems.map((item) => [item.label, item.value]),
    theme: 'striped',
    headStyles: { fillColor: accent, textColor: [255, 255, 255], fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 3 },
  });

  const nextY = ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40) + 8;

  if (tableRows.length > 0) {
    autoTable(pdf, {
      startY: nextY,
      head: [tableHeaders],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2.8 },
    });
  }

  renderFooter(
    pdf,
    `${settings.businessName} — Generated from verified Firestore accounting ledger (${periodLabel}). Base currency: INR.`,
  );
  pdf.save(`${filename}.pdf`);
}
