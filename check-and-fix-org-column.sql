-- Check current organization_id column type in projects table
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'projects' 
AND column_name = 'organization_id';

-- If organization_id is bigint but should be UUID, run this:
-- ALTER TABLE projects ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;

-- Also check organizations table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name = 'id';
