import { supabase } from '@/integrations/supabase/client';

export interface GenerateInvoicesParams {
  studentId: string;
  courseId?: string;
  pathwayId?: string;
  totalAmount: number;
  maxInstallments: number;
  invoiceSendGapDays?: number;
  invoiceOverdueDays?: number;
  batchStartDate?: string;
  enrollmentDetails?: {
    courseName?: string;
    pathwayName?: string;
  };
}

export interface GeneratedInvoice {
  id: string;
  student_id: string;
  course_id: string | null;
  pathway_id: string | null;
  installment_number: number;
  amount: number;
  due_date: string;
  status: string;
}

/**
 * Generates installment invoices for a course or pathway enrollment.
 * Each invoice is linked to the specific course_id or pathway_id.
 */
export async function generateEnrollmentInvoices({
  studentId,
  courseId,
  pathwayId,
  totalAmount,
  maxInstallments,
  invoiceSendGapDays = 30,
  invoiceOverdueDays = 5,
  batchStartDate,
  enrollmentDetails
}: GenerateInvoicesParams): Promise<GeneratedInvoice[]> {
  // If total amount is 0 or less, no invoices needed
  if (totalAmount <= 0) {
    console.log('No invoices needed - free enrollment or 100% discount');
    return [];
  }

  const installmentAmount = totalAmount / maxInstallments;
  const batchAnchor = batchStartDate ? new Date(batchStartDate) : null;
  const invoices: Array<{
    student_id: string;
    course_id: string | null;
    pathway_id: string | null;
    installment_number: number;
    amount: number;
    issue_date: string;
    due_date: string;
    status: string;
    enrollment_details: Record<string, string[]> | null;
    notes: string;
  }> = [];

  for (let i = 1; i <= maxInstallments; i++) {
    let issueDate: Date;
    let dueDate: Date;

    if (i === 1) {
      // 1st installment: issued immediately
      issueDate = new Date();
      dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + invoiceOverdueDays);
    } else if (batchAnchor) {
      // Batch-enrolled: 2nd+ installments anchored to batch start date + (i-1)*invoiceSendGapDays
      issueDate = new Date(batchAnchor);
      issueDate.setDate(issueDate.getDate() + ((i - 1) * invoiceSendGapDays));
      dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + invoiceOverdueDays);
    } else {
      // Non-batch: use company settings interval
      issueDate = new Date();
      issueDate.setDate(issueDate.getDate() + ((i - 1) * invoiceSendGapDays));
      dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + invoiceOverdueDays);
    }

    invoices.push({
      student_id: studentId,
      course_id: courseId || null,
      pathway_id: pathwayId || null,
      installment_number: i,
      amount: installmentAmount,
      issue_date: issueDate.toISOString(),
      due_date: dueDate.toISOString(),
      status: i === 1 ? 'pending' : 'scheduled',
      enrollment_details: enrollmentDetails ? {
        courses: enrollmentDetails.courseName ? [enrollmentDetails.courseName] : [],
        pathways: enrollmentDetails.pathwayName ? [enrollmentDetails.pathwayName] : []
      } : null,
      notes: `Installment ${i} of ${maxInstallments} for ${enrollmentDetails?.courseName || enrollmentDetails?.pathwayName || 'enrollment'}`
    });
  }

  const { data, error } = await supabase
    .from('invoices')
    .insert(invoices)
    .select();

  if (error) {
    console.error('Error creating invoices:', error);
    throw new Error(`Failed to create invoices: ${error.message}`);
  }

  console.log(`Created ${invoices.length} invoices for ${courseId ? 'course' : 'pathway'} enrollment`);
  return (data || []) as GeneratedInvoice[];
}

/**
 * Updates course enrollment payment status based on paid invoices.
 */
export async function updateEnrollmentPaymentStatus(
  studentId: string,
  courseId?: string,
  pathwayId?: string
): Promise<void> {
  // Get all invoices for this enrollment
  let query = supabase
    .from('invoices')
    .select('id, status, amount')
    .eq('student_id', studentId);

  if (courseId) {
    query = query.eq('course_id', courseId);
  } else if (pathwayId) {
    query = query.eq('pathway_id', pathwayId);
  } else {
    return; // No course or pathway specified
  }

  const { data: invoices, error } = await query;

  if (error) {
    console.error('Error fetching invoices:', error);
    return;
  }

  if (!invoices || invoices.length === 0) {
    return;
  }

  const totalInvoices = invoices.length;
  const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const paidAmount = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.amount || 0), 0);

  let paymentStatus: string;
  if (paidInvoices === 0) {
    paymentStatus = 'pending';
  } else if (paidInvoices === totalInvoices) {
    paymentStatus = 'paid';
  } else {
    paymentStatus = 'partial';
  }

  // Update course enrollment
  let updateQuery = supabase
    .from('course_enrollments')
    .update({
      payment_status: paymentStatus,
      amount_paid: paidAmount,
      total_amount: totalAmount,
      updated_at: new Date().toISOString()
    })
    .eq('student_id', studentId);

  if (courseId) {
    updateQuery = updateQuery.eq('course_id', courseId);
  } else if (pathwayId) {
    updateQuery = updateQuery.eq('pathway_id', pathwayId);
  }

  const { error: updateError } = await updateQuery;

  if (updateError) {
    console.error('Error updating enrollment payment status:', updateError);
  } else {
    console.log(`Updated enrollment payment status to ${paymentStatus}`);
  }
}

/**
 * Fetches company settings for invoice generation.
 */
export async function getInvoiceSettings(): Promise<{
  invoiceSendGapDays: number;
  invoiceOverdueDays: number;
  currency: string;
}> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('invoice_send_gap_days, invoice_overdue_days, currency')
    .single();

  if (error) {
    console.error('Error fetching invoice settings:', error);
    return {
      invoiceSendGapDays: 30,
      invoiceOverdueDays: 5,
      currency: 'USD'
    };
  }

  return {
    invoiceSendGapDays: data?.invoice_send_gap_days || 30,
    invoiceOverdueDays: data?.invoice_overdue_days || 5,
    currency: data?.currency || 'USD'
  };
}
