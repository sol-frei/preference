
-- 1. Extend Polls Table
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS is_multiple_choice BOOLEAN DEFAULT FALSE;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- 2. Modify Poll Votes Constraint (Allow one user to vote for multiple options in the same poll)
ALTER TABLE public.poll_votes DROP CONSTRAINT IF EXISTS poll_votes_poll_id_user_id_key;
ALTER TABLE public.poll_votes ADD CONSTRAINT poll_votes_option_id_user_id_key UNIQUE (option_id, user_id);

-- 3. Extend Messages Table for Images
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
