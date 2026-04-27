-- Update get_recovery_statistics function to work with new schema
CREATE OR REPLACE FUNCTION get_recovery_statistics()
RETURNS TABLE (
  total_messages_sent bigint,
  successful_recoveries bigint,
  pending_recoveries bigint,
  failed_recoveries bigint,
  recovery_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stats AS (
    SELECT
      COUNT(*) as total_messages,
      COUNT(*) FILTER (WHERE message_status = 'recovered' OR recovery_successful = true) as recovered,
      COUNT(*) FILTER (WHERE message_status = 'pending') as pending,
      COUNT(*) FILTER (WHERE message_status = 'failed' OR recovery_successful = false) as failed
    FROM student_recovery_messages
  )
  SELECT
    total_messages,
    recovered,
    pending,
    failed,
    CASE 
      WHEN total_messages > 0 
      THEN ROUND((recovered::numeric / total_messages::numeric) * 100, 1)
      ELSE 0
    END as recovery_rate
  FROM stats;
$$;