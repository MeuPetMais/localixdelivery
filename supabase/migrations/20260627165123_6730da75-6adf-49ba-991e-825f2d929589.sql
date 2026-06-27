
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_days smallint[],
  ADD COLUMN IF NOT EXISTS recurrence_start_time time,
  ADD COLUMN IF NOT EXISTS recurrence_end_time time;
