// PDF generation utility for invoices using HTML-to-PDF conversion
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

export interface InvoiceItem {
  description: string;
  installment_number: number;
  price: number;
  total: number;
}

export interface InvoiceData {
  invoice_number: string;
  date: string;
  due_date: string;
  student_name: string;
  student_email?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  total_program_cost?: number;
  total_installments?: number;
  currency?: string;
  payment_methods?: PaymentMethod[];
  terms?: string;
}

export interface PaymentMethod {
  type: 'bank_transfer' | 'cod' | 'stripe' | 'custom';
  name: string;
  enabled: boolean;
  details: {
    [key: string]: string;
  };
}

export interface CompanyDetails {
  company_name: string;
  address: string;
  contact_email: string;
  primary_phone: string;
  company_logo?: string;
}

export async function generateInvoicePDF(invoiceData: InvoiceData, companyDetails: CompanyDetails): Promise<Uint8Array> {
  try {
    console.log('Starting PDF generation for invoice:', invoiceData.invoice_number);
    
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    const html = generateInvoiceHTML(invoiceData, companyDetails);
    
    console.log('Setting HTML content for PDF generation');
    await page.setContent(html, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    console.log('Generating PDF...');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      },
      preferCSSPageSize: true
    });

    await browser.close();
    console.log('PDF generated successfully, size:', pdf.length, 'bytes');
    
    return pdf;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

function generateInvoiceHTML(invoiceData: InvoiceData, companyDetails: CompanyDetails): string {
  // Currency symbol helper function
  const getCurrencySymbol = (currency: string = 'USD') => {
    const symbols: { [key: string]: string } = {
      USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'C$', AUD: 'A$', PKR: 'Rs'
    };
    return symbols[currency] || currency;
  };

  const currency = invoiceData.currency || 'USD';
  const currencySymbol = getCurrencySymbol(currency);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice #${invoiceData.invoice_number}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: white;
            color: #0f172a;
            line-height: 1.5;
        }

        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 0;
        }

        .invoice-header {
            background: linear-gradient(135deg, #2563eb, #7c3aed, #a855f7);
            color: white;
            padding: 2rem;
            position: relative;
            overflow: hidden;
        }

        .logo-circles {
            position: absolute;
            left: 2rem;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            gap: -12px;
        }

        .logo-circle {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(4px);
            margin-left: -12px;
        }

        .logo-circle:first-child {
            margin-left: 0;
            background: rgba(255, 255, 255, 0.2);
        }

        .logo-circle:nth-child(2) {
            background: rgba(255, 255, 255, 0.3);
        }

        .logo-circle:nth-child(3) {
            background: rgba(255, 255, 255, 0.25);
        }

        .invoice-title {
            text-align: right;
        }

        .invoice-title h1 {
            font-size: 2.5rem;
            font-weight: 800;
            letter-spacing: 0.05em;
        }

        .invoice-content {
            padding: 2rem;
        }

        .invoice-meta {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        }

        .meta-group h3 {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            margin-bottom: 0.5rem;
        }

        .student-name {
            font-size: 1.25rem;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 0.25rem;
        }

        .student-underline {
            height: 4px;
            width: 48px;
            background: #0f172a;
            margin-bottom: 0.5rem;
        }

        .student-email {
            font-size: 0.875rem;
            color: #64748b;
        }

        .total-due {
            text-align: right;
        }

        .total-due h3 {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            margin-bottom: 0.5rem;
        }

        .total-amount {
            font-size: 1.5rem;
            font-weight: 700;
            color: #0f172a;
        }

        .items-table {
            width: 100%;
            margin-bottom: 2rem;
            border-collapse: collapse;
            overflow: hidden;
            border-radius: 8px;
        }

        .items-table thead {
            background: linear-gradient(135deg, #2563eb, #7c3aed, #a855f7);
            color: white;
        }

        .items-table th {
            padding: 1rem;
            text-align: left;
            font-weight: 600;
            font-size: 0.875rem;
        }

        .items-table th:nth-child(2),
        .items-table th:nth-child(3),
        .items-table th:nth-child(4) {
            text-align: center;
        }

        .items-table td {
            padding: 1rem;
            border-bottom: 1px solid #e2e8f0;
        }

        .items-table tbody tr:nth-child(odd) {
            background: #f8fafc;
        }

        .items-table tbody tr:nth-child(even) {
            background: white;
        }

        .items-table td:nth-child(2),
        .items-table td:nth-child(3),
        .items-table td:nth-child(4) {
            text-align: center;
        }

        .items-table td:nth-child(4) {
            font-weight: 600;
        }

        .bottom-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-top: 2rem;
        }

        .payment-methods h3 {
            font-size: 1.125rem;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 1rem;
        }

        .payment-method {
            border-left: 2px solid #d1d5db;
            padding-left: 0.75rem;
            margin-bottom: 1rem;
        }

        .payment-method-name {
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 0.25rem;
        }

        .payment-detail {
            font-size: 0.875rem;
            color: #64748b;
            margin-bottom: 0.25rem;
        }

        .totals-section {
            text-align: right;
        }

        .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
        }

        .total-row.final {
            background: linear-gradient(135deg, #2563eb, #7c3aed);
            color: white;
            padding: 0.75rem;
            border-radius: 6px;
            font-weight: 700;
            margin-top: 0.5rem;
        }

        .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-top: 3rem;
        }

        .notes h3 {
            font-size: 1.125rem;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 1rem;
        }

        .notes p {
            font-size: 0.875rem;
            color: #64748b;
            font-style: italic;
            line-height: 1.6;
        }

        .signature {
            text-align: right;
        }

        .company-name {
            font-size: 1.125rem;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 0.5rem;
        }

        .company-role {
            font-size: 0.875rem;
            color: #64748b;
        }

        .company-footer {
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 0.75rem;
            color: #64748b;
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <header class="invoice-header">
            <div class="logo-circles">
                <div class="logo-circle"></div>
                <div class="logo-circle"></div>
                <div class="logo-circle"></div>
            </div>
            <div class="invoice-title">
                <h1>INVOICE</h1>
            </div>
        </header>

        <div class="invoice-content">
            <div class="invoice-meta">
                <div>
                    <h3>INVOICE TO:</h3>
                    <div class="student-name">${invoiceData.student_name}</div>
                    <div class="student-underline"></div>
                    ${invoiceData.student_email ? `<div class="student-email">${invoiceData.student_email}</div>` : ''}
                </div>
                
                <div>
                    <div style="margin-bottom: 0.5rem;">
                        <span style="font-size: 0.875rem; color: #64748b;">Date: </span>
                        <span style="font-weight: 500;">${invoiceData.date}</span>
                    </div>
                    <div style="margin-bottom: 0.5rem;">
                        <span style="font-size: 0.875rem; color: #64748b;">Due Date: </span>
                        <span style="font-weight: 500;">${invoiceData.due_date}</span>
                    </div>
                    <div>
                        <span style="font-size: 0.875rem; color: #64748b;">Invoice No: </span>
                        <span style="font-weight: 500;">${invoiceData.invoice_number}</span>
                    </div>
                </div>

                <div class="total-due">
                    <h3>TOTAL DUE:</h3>
                    <div class="total-amount">
                        ${currencySymbol}${invoiceData.total.toLocaleString()}
                        ${invoiceData.total_program_cost ? `<span style="font-size: 0.875rem; font-weight: normal; color: #64748b; margin-left: 0.5rem;">of ${currencySymbol}${invoiceData.total_program_cost.toLocaleString()}</span>` : ''}
                    </div>
                </div>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Installment Number</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoiceData.items.map(item => `
                        <tr>
                            <td style="font-weight: 500;">${item.description}</td>
                            <td>
                                ${invoiceData.total_installments 
                                    ? `${item.installment_number}/${invoiceData.total_installments}`
                                    : item.installment_number
                                }
                            </td>
                            <td>${currencySymbol}${item.price}</td>
                            <td style="font-weight: 600;">${currencySymbol}${item.total}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="bottom-section">
                <div class="payment-methods">
                    <h3>Payment Methods</h3>
                    ${invoiceData.payment_methods && invoiceData.payment_methods.filter(method => method.enabled).length > 0 
                        ? invoiceData.payment_methods.filter(method => method.enabled).map(method => `
                            <div class="payment-method">
                                <div class="payment-method-name">${method.name}</div>
                                ${Object.entries(method.details).map(([key, value]) => `
                                    <div class="payment-detail">
                                        <span style="font-weight: 500;">${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span> ${value}
                                    </div>
                                `).join('')}
                            </div>
                        `).join('')
                        : '<div style="font-size: 0.875rem; color: #64748b; font-style: italic;">No payment methods configured</div>'
                    }
                </div>

                <div class="totals-section">
                    <div class="total-row">
                        <span style="font-weight: 500;">Sub-total:</span>
                        <span>${currencySymbol}${invoiceData.subtotal.toLocaleString()}</span>
                    </div>
                    <div class="total-row">
                        <span style="font-weight: 500;">Tax:</span>
                        <span>${currencySymbol}${invoiceData.tax}</span>
                    </div>
                    <div class="total-row final">
                        <span>Total:</span>
                        <span>${currencySymbol}${invoiceData.total.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div class="signature-section">
                <div class="notes">
                    <h3>Notes</h3>
                    <p>${invoiceData.terms || 'Please send payment within 30 days of receiving this invoice.'}</p>
                </div>

                <div class="signature">
                    <div class="company-name">${companyDetails.company_name}</div>
                    <div class="company-role">Administrator</div>
                </div>
            </div>

            <div class="company-footer">
                <div>${companyDetails.company_name}</div>
                <div>${companyDetails.address}</div>
                <div>${companyDetails.contact_email} | ${companyDetails.primary_phone}</div>
            </div>
        </div>
    </div>
</body>
</html>
  `;
}