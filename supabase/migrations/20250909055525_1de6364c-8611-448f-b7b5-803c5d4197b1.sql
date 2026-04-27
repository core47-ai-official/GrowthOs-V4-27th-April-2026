-- Update notification templates to include proper currency formatting
UPDATE notification_templates 
SET body_md = 'Invoice **{invoice_number}** for **{student_name}** is issued: **{currency} {amount}** due **{due_date}**.'
WHERE key = 'invoice_issued';

UPDATE notification_templates 
SET body_md = 'Invoice **{invoice_number}** for **{student_name}** is due on **{due_date}** - Amount: **{currency} {amount}**.'
WHERE key = 'invoice_due';

-- Add currency to the variables array for invoice templates
UPDATE notification_templates 
SET variables = array_append(variables, 'currency')
WHERE key IN ('invoice_issued', 'invoice_due') AND NOT ('currency' = ANY(variables));