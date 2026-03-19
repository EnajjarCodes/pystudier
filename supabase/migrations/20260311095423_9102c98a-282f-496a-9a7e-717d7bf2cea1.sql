ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS hardest_subject text DEFAULT null,
ADD COLUMN IF NOT EXISTS weekly_goal integer DEFAULT null;