-- Add sort_order column to tasks table
-- Run this SQL in your Supabase SQL Editor

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order integer;

-- Optional: Update existing tasks with sequential sort_order values
UPDATE tasks 
SET sort_order = (
  SELECT row_number - 1
  FROM (
    SELECT id, row_number() OVER (ORDER BY wbs_code) as row_number
    FROM tasks
    WHERE project_id = tasks.project_id
    ORDER BY wbs_code
  ) numbered_tasks
  WHERE numbered_tasks.id = tasks.id
);
