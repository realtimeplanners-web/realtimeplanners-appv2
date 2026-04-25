-- Add organization_id column to projects table
-- This column is needed to link projects to organizations

ALTER TABLE projects ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Update existing projects to have organization_id = 1 (default org)
UPDATE projects SET organization_id = 1 WHERE organization_id IS NULL;

-- Verify the column was added and updated
SELECT id, name, organization_id FROM projects ORDER BY created_at DESC LIMIT 5;
