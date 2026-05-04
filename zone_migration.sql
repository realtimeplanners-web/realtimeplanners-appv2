-- Add zone_id column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS zone_id uuid;

-- Update existing tasks to have a default zone (optional)
-- This will need to be run once, then you can assign zones to existing tasks manually if needed
UPDATE tasks 
SET zone_id = 'default-zone' 
WHERE zone_id IS NULL;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name = 'zone_id';
