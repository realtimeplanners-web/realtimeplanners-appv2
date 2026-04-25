-- Fix organization relationship between projects and organizations tables
-- Step 1: Add foreign key constraint (run only if not already exists)

-- First, ensure all projects have organization_id
UPDATE projects SET organization_id = 1 WHERE organization_id IS NULL;

-- Add foreign key constraint
ALTER TABLE projects
ADD CONSTRAINT fk_org
FOREIGN KEY (organization_id)
REFERENCES organizations(id)
ON DELETE CASCADE;

-- Verify the constraint was added
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name = 'projects' 
AND tc.constraint_name = 'fk_org';

-- Check data integrity
SELECT 
    p.id as project_id,
    p.name as project_name,
    p.organization_id,
    o.name as organization_name
FROM projects p
LEFT JOIN organizations o ON p.organization_id = o.id
ORDER BY p.created_at DESC
LIMIT 5;
