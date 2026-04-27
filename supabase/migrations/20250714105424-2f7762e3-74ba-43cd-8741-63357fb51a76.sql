-- Insert sample upcoming success sessions for testing
INSERT INTO public.success_sessions (title, description, start_time, end_time, link, mentor_name, status) VALUES 
('Digital Marketing Fundamentals', 'Learn the basics of digital marketing strategies and implementation', 
 NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '2 hours', 
 'https://meet.google.com/sample-link-1', 'Sarah Johnson', 'upcoming'),
 
('Advanced E-commerce Strategies', 'Deep dive into scaling your e-commerce business', 
 NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '1.5 hours', 
 'https://meet.google.com/sample-link-2', 'Michael Chen', 'upcoming'),
 
('Customer Acquisition Mastery', 'Proven techniques for acquiring and retaining customers', 
 NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '2 hours', 
 'https://meet.google.com/sample-link-3', 'Emily Rodriguez', 'upcoming');