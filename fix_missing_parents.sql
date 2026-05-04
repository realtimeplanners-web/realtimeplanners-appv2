-- SQL to fix missing parent IDs in tasks table
-- Run these queries in your Supabase SQL Editor

-- 1. Add parent_missing column if it doesn't exist
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_missing boolean DEFAULT false;

-- 2. Identify tasks with missing parents (for review)
SELECT 
    t.id,
    t.wbs_code,
    t.task_name,
    t.parent_id,
    t.parent_missing,
    t.level,
    CASE 
        WHEN t.parent_id IS NOT NULL AND parent_task.id IS NULL THEN 'Missing Parent'
        WHEN t.parent_id IS NULL AND t.level > 1 THEN 'Should Have Parent'
        ELSE 'OK'
    END as status
FROM tasks t
LEFT JOIN tasks parent_task ON t.parent_id = parent_task.id
WHERE (t.parent_id IS NOT NULL AND parent_task.id IS NULL) 
   OR (t.parent_id IS NULL AND t.level > 1)
ORDER BY t.wbs_code;

-- 3. Fix parents based on WBS code structure
-- Update parent_id based on WBS code prefix (e.g., 1.1.1 should have parent 1.1)
UPDATE tasks t
SET parent_id = parent_task.id,
    parent_missing = false,
    updated_at = NOW()
FROM tasks parent_task
WHERE t.level > 1 
  AND t.parent_missing = true
  AND parent_task.wbs_code = SUBSTRING(t.wbs_code, 1, LENGTH(t.wbs_code) - POSITION('.' IN REVERSE(t.wbs_code)))
  AND parent_task.project_id = t.project_id;

-- 4. For root level tasks (level 1), ensure parent_id is null
UPDATE tasks 
SET parent_id = NULL,
    parent_missing = false,
    updated_at = NOW()
WHERE level = 1 AND (parent_id IS NOT NULL OR parent_missing = true);

-- 5. Mark remaining tasks with missing parents
UPDATE tasks t
SET parent_missing = true,
    updated_at = NOW()
WHERE t.parent_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM tasks pt 
    WHERE pt.id = t.parent_id
  );

-- 6. Verify the fixes
SELECT 
    t.id,
    t.wbs_code,
    t.task_name,
    t.parent_id,
    t.parent_missing,
    t.level,
    parent_task.wbs_code as parent_wbs_code,
    parent_task.task_name as parent_task_name
FROM tasks t
LEFT JOIN tasks parent_task ON t.parent_id = parent_task.id
WHERE t.parent_missing = true
   OR (t.parent_id IS NOT NULL AND parent_task.id IS NULL)
ORDER BY t.wbs_code;

-- 7. Optional: Reset WBS codes if structure is broken
-- WARNING: This will recalculate all WBS codes. Use only if needed.
/*
WITH ordered_tasks AS (
  SELECT 
    id,
    project_id,
    parent_id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, parent_id 
      ORDER BY COALESCE(sort_order, 0), created_at
    ) as row_num
  FROM tasks
),
wbs_update AS (
  SELECT 
    t.id,
    CASE 
      WHEN t.parent_id IS NULL THEN t.row_num::text
      ELSE (
        SELECT p.wbs_code || '.' || t.row_num::text
        FROM ordered_tasks p
        WHERE p.id = t.parent_id
      )
    END as new_wbs_code,
    CASE 
      WHEN t.parent_id IS NULL THEN 1
      ELSE (
        SELECT p.level + 1
        FROM tasks p
        WHERE p.id = t.parent_id
      )
    END as new_level
  FROM ordered_tasks t
)
UPDATE tasks t
SET wbs_code = w.new_wbs_code,
    level = w.new_level,
    parent_missing = false,
    updated_at = NOW()
FROM wbs_update w
WHERE t.id = w.id;
*/
