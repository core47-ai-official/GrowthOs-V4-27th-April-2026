import React from 'react';
import { Card } from '@/components/ui/card';
import { getCurrencySymbol } from '@/utils/currencyFormatter';
import { ENV_CONFIG } from '@/lib/env-config';
interface InvoiceItem {
  description: string;
  installment_number: number;
  price: number;
  total: number;
}
interface InvoiceData {
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
  enrollment_details?: {
    courses?: string[];
    pathways?: string[];
  };
}

interface PaymentMethod {
  type: 'bank_transfer' | 'cod' | 'stripe' | 'custom';
  name: string;
  enabled: boolean;
  details: {
    [key: string]: string;
  };
}
interface CompanyDetails {
  company_name: string;
  address: string;
  contact_email: string;
  primary_phone: string;
  company_logo?: string;
}
interface InvoiceTemplateProps {
  invoiceData: InvoiceData;
  companyDetails: CompanyDetails;
}
export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({
  invoiceData,
  companyDetails
}) => {
  const currency = invoiceData.currency || ENV_CONFIG.DEFAULT_CURRENCY;
  const currencySymbol = getCurrencySymbol(currency);
  return <div className="max-w-4xl mx-auto bg-white p-8 shadow-lg">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-purple-400 p-8 mb-8 relative overflow-hidden">
        <div className="absolute left-8 top-1/2 transform -translate-y-1/2">
          {/* Three overlapping circles logo */}
          <div className="flex items-center space-x-[-12px]">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm"></div>
            <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-sm"></div>
            <div className="w-12 h-12 rounded-full bg-white/25 backdrop-blur-sm"></div>
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-4xl font-bold text-white tracking-wider">INVOICE</h1>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="grid grid-cols-3 gap-8 mb-8">
        {/* Invoice To */}
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">INVOICE TO:</h3>
          <div className="text-xl font-bold text-gray-900 mb-1">{invoiceData.student_name}</div>
          <div className="h-1 w-12 bg-gray-900"></div>
          {invoiceData.student_email && <div className="text-sm text-gray-600 mt-2">{invoiceData.student_email}</div>}
        </div>

        {/* Invoice Details */}
        <div>
          <div className="mb-2">
            <span className="text-sm text-gray-600">Date: </span>
            <span className="font-medium">{invoiceData.date}</span>
          </div>
          <div className="mb-2">
            <span className="text-sm text-gray-600">Due Date: </span>
            <span className="font-medium">{invoiceData.due_date}</span>
          </div>
          <div>
            <span className="text-sm text-gray-600">Invoice No: </span>
            <span className="font-medium">{invoiceData.invoice_number}</span>
          </div>
        </div>

        {/* Total Due */}
        <div className="text-right">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">TOTAL DUE:</h3>
          <div className="text-2xl font-bold text-gray-900">
            {currencySymbol}{invoiceData.total.toLocaleString()}
            {invoiceData.total_program_cost && (
              <span className="text-sm font-normal text-gray-600 ml-2">
                of {currencySymbol}{invoiceData.total_program_cost.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Enrolled Courses & Pathways */}
      {invoiceData.enrollment_details && (
        (invoiceData.enrollment_details.courses?.length || 0) > 0 || 
        (invoiceData.enrollment_details.pathways?.length || 0) > 0
      ) && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Enrolled Program Details:</h3>
          <div className="grid grid-cols-2 gap-4">
            {invoiceData.enrollment_details.courses && invoiceData.enrollment_details.courses.length > 0 && (
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase">Courses:</span>
                <ul className="mt-1 space-y-1">
                  {invoiceData.enrollment_details.courses.map((course, idx) => (
                    <li key={idx} className="text-sm text-gray-800 flex items-center">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                      {course}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {invoiceData.enrollment_details.pathways && invoiceData.enrollment_details.pathways.length > 0 && (
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase">Learning Pathways:</span>
                <ul className="mt-1 space-y-1">
                  {invoiceData.enrollment_details.pathways.map((pathway, idx) => (
                    <li key={idx} className="text-sm text-gray-800 flex items-center">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2"></span>
                      {pathway}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="mb-8">
        {/* Table Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-purple-400 text-white">
          <div className="grid grid-cols-4 p-4 font-semibold">
            <div>Description</div>
            <div className="text-center">Installment Number</div>
            <div className="text-center">Price</div>
            <div className="text-center">Total</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="border-l border-r border-b border-gray-200">
          {invoiceData.items.map((item, index) => <div key={index} className={`grid grid-cols-4 p-4 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
              <div className="font-medium">{item.description}</div>
              <div className="text-center">
                {invoiceData.total_installments 
                  ? `${item.installment_number}/${invoiceData.total_installments}`
                  : item.installment_number
                }
              </div>
              <div className="text-center">{currencySymbol}{item.price}</div>
              <div className="text-center font-semibold">{currencySymbol}{item.total}</div>
            </div>)}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-2 gap-8">
        {/* Payment Methods */}
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Methods</h3>
          {invoiceData.payment_methods && invoiceData.payment_methods.filter(method => method.enabled).length > 0 ? (
            <div className="space-y-4">
              {invoiceData.payment_methods.filter(method => method.enabled).map((method, index) => (
                <div key={index} className="border-l-2 border-gray-300 pl-3">
                  <div className="font-medium text-gray-900 mb-1">{method.name}</div>
                  {Object.entries(method.details).map(([key, value]) => (
                    <div key={key} className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span> {value}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-600 italic">
              No payment methods configured
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="space-y-2">
          <div className="flex justify-between text-right">
            <span className="font-medium">Sub-total:</span>
            <span>{currencySymbol}{invoiceData.subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-right">
            <span className="font-medium">Tax:</span>
            <span>{currencySymbol}{invoiceData.tax}</span>
          </div>
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 rounded">
            <div className="flex justify-between text-right font-bold">
              <span>Total:</span>
              <span>{currencySymbol}{invoiceData.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Terms and Signature */}
      <div className="grid grid-cols-2 gap-8 mt-12">
        {/* Terms and Conditions */}
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Notes</h3>
          <p className="text-sm text-gray-600 italic leading-relaxed">
            {invoiceData.terms || `Please send payment within 30 days of receiving this invoice. There will be 10% interest charge per month on late invoice.`}
          </p>
        </div>

        {/* Signature */}
        <div className="text-right">
          <div className="inline-block">
            <div className="text-lg font-bold text-gray-900 mb-2">
              {companyDetails.company_name}
            </div>
            <div className="text-sm text-gray-600">Administrator</div>
          </div>
        </div>
      </div>

      {/* Company Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
        <div>{companyDetails.company_name}</div>
        <div>{companyDetails.address}</div>
        <div>{companyDetails.contact_email} | {companyDetails.primary_phone}</div>
      </div>
    </div>;
};