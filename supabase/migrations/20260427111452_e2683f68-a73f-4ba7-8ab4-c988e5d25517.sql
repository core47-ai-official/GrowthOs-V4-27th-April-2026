-- Remove the restrictive CHECK constraints on admin_logs that block valid activity types
-- The application logs many action types (login, logout, page_visit, video_watched, view_students, etc.)
-- and entity types that aren't in the original whitelist, causing inserts to fail and crash the page.

ALTER TABLE public.admin_logs DROP CONSTRAINT IF EXISTS admin_logs_action_check;
ALTER TABLE public.admin_logs DROP CONSTRAINT IF EXISTS admin_logs_entity_type_check;