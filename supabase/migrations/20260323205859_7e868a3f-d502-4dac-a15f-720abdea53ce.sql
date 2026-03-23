CREATE TABLE public.study_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_type text NOT NULL,
  score integer DEFAULT 0,
  total integer DEFAULT 0,
  topic text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.study_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own progress"
ON public.study_progress FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own progress"
ON public.study_progress FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_study_progress_user_id ON public.study_progress(user_id);
CREATE INDEX idx_study_progress_created_at ON public.study_progress(created_at);