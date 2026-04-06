
ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS learning_level text DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS stage text DEFAULT 'subject',
  ADD COLUMN IF NOT EXISTS progress jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS weak_areas jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pystudy_messages jsonb DEFAULT '[]'::jsonb;
