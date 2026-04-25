-- Fix type mismatch between projects.organization_id and organizations.id
-- Change organization_id from bigint to UUID to match organizations.id

-- First, drop any existing foreign key constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS fk_org;

-- Convert organization_id from bigint to UUID
ALTER TABLE projects ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;

-- Now add the foreign key constraint with matching types
ALTER TABLE projects 
ADD CONSTRAINT fk_org
FOREIGN KEY (organization_id)
REFERENCES organizations(id)
ON DELETE CASCADE;

-- Verify the column type change
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'projects' 
AND column_name = 'organization_id';

-- Verify the constraint was added
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name = 'projects' 
AND tc.constraint_name = 'fk_org';

-- Test the relationship
SELECT 
    p.id as project_id,
    p.name as project_name,
    p.organization_id,
    o.id as org_id,
    o.name as organization_name
FROM projects p
LEFT JOIN organizations o ON p.organization_id = o.id
ORDER BY p.created_at DESC
LIMIT 5;
