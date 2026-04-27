-- Create a secure function to get team member passwords (superadmin only)
CREATE OR REPLACE FUNCTION get_team_member_password(member_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role TEXT;
  member_password TEXT;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role
  FROM users
  WHERE id = auth.uid();
  
  -- Only superadmins can access passwords
  IF current_user_role != 'superadmin' THEN
    RETURN NULL;
  END IF;
  
  -- Get the password
  SELECT password_display INTO member_password
  FROM users
  WHERE id = member_id;
  
  RETURN member_password;
END;
$$;

-- Grant execute permission to authenticated users (function handles authorization)
GRANT EXECUTE ON FUNCTION get_team_member_password(UUID) TO authenticated;