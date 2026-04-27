# Financial Management System

## Overview

The Financial Management system handles student payment tracking, installment plans, invoice generation, and financial reporting across the Growth OS platform.

## User-Facing Behavior

### For Admins/Enrollment Managers
- **Payment Tracking**: Mark payments as received, view outstanding balances
- **Installment Management**: Configure payment plans and schedules
- **Financial Reports**: Generate revenue reports and payment analytics
- **Invoice Generation**: Create and send automated invoices

## Technical Implementation

### Core Components
- `src/components/admin/FinancialManagement.tsx` - Main admin financial interface
- `src/hooks/useInstallmentPlans.ts` - Payment plan management
- `src/hooks/useInstallmentOptions.ts` - Installment configuration
- `src/components/InvoiceTemplate.tsx` - PDF invoice generation

### Database Tables
- `installment_payments` - Payment records and schedules
- `company_settings` - Financial configuration (fees, currency, terms)

### Edge Functions
- `mark-invoice-paid` - Payment processing and status updates
- Email notifications for payment reminders and confirmations

## Configuration Matrix

### Environment Variables
| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `SMTP_*` | Email delivery for invoices | None | Yes |

### Company Settings (Database)
| Setting | Default | Description |
|---------|---------|-------------|
| `original_fee_amount` | 3000.00 | Base course fee |
| `maximum_installment_count` | 3 | Max payment splits |
| `currency` | USD | Payment currency |
| `invoice_overdue_days` | 30 | Days before overdue |
| `invoice_send_gap_days` | 7 | Reminder frequency |
| `payment_methods` | [] | Accepted payment types |
| `invoice_notes` | None | Custom invoice text |

### Hard-coded Values
```typescript
// Default installment options
const INSTALLMENT_OPTIONS = [1, 2, 3];

// Payment statuses
const PAYMENT_STATUS = ['pending', 'paid', 'overdue', 'failed'];
```

## Security Considerations

### Access Control
- Students can only view their own payment records
- Admins can access all financial data
- Enrollment managers have limited financial access
- Payment marking requires admin permissions

### Data Protection
- Payment information is encrypted in database
- Invoice PDFs include minimal sensitive data
- Audit trails track all payment modifications

### Failure Modes
- **Email Delivery Failure**: Payment confirmations may not send
- **Calculation Errors**: Installment amounts must match totals
- **Currency Mismatch**: Multi-currency not supported
- **Overdue Processing**: Automated suspension based on payment status

## API Integration Points

### Invoice Generation
```typescript
// Invoice PDF creation
const generateInvoice = (paymentData) => {
  // Uses jsPDF library
  // Template: src/templates/invoice-template.html
}
```

### Payment Notifications
```typescript
// Automated email triggers
const notifyPaymentStatus = (installmentId, status) => {
  // Edge function: mark-invoice-paid
  // Email templates for different payment events
}
```

## Extending the System

### Adding Payment Gateways
1. Create new Edge Function for gateway integration
2. Update payment methods in company_settings
3. Add gateway-specific webhook handlers
4. Implement payment status synchronization

### Multi-Currency Support
> **Warning:** Currency changes affect existing payment calculations

1. Update database schema for currency per transaction
2. Modify installment calculation logic
3. Update invoice templates for currency display
4. Add exchange rate handling

### Advanced Reporting
```typescript
// Example: Custom financial reports
const generateFinancialReport = (dateRange, filters) => {
  // Query installment_payments with aggregations
  // Export formats: PDF, CSV, Excel
}
```

## Troubleshooting

### Common Issues

**Payments Not Reflecting**
- Check email delivery logs
- Verify admin has marked payment as received
- Confirm installment_payments table updates

**Invoice Generation Failing**
- Verify jsPDF library availability
- Check invoice template exists
- Ensure company settings are complete

**Email Notifications Missing**
- Validate SMTP/Resend configuration
- Check notification triggers in database
- Review Edge Function logs

**Installment Calculation Errors**
- Verify maximum_installment_count setting
- Check for decimal rounding issues
- Ensure total amounts match course fees

## Next Steps

Review [Student Management](./student-management.md) for enrollment workflows and [Company Branding](./company-branding.md) for invoice customization options.
