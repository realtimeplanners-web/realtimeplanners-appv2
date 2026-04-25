-- Fix existing project data with proper organization_id
-- Run this script once to update all existing projects to have organization_id = 1
-- You can change the organization_id to the correct one for your setup

UPDATE projects SET organization_id = 1 WHERE organization_id IS NULL;

-- Verify the update
SELECT COUNT(*) as projects_updated FROM projects WHERE organization_id = 1;

-- Show all projects with their organization_id
SELECT id, name, client_name, organization_id, created_at FROM projects ORDER BY created_at DESC;
