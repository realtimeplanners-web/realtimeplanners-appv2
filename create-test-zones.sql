-- Create test zones for existing projects
-- Run this in your Supabase SQL editor to create sample zones

INSERT INTO zones (project_id, name) 
SELECT 
  p.id,
  'Zone ' || (ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY p.id))
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM zones z WHERE z.project_id = p.id
);

-- Or create zones for a specific project (replace with your project ID)
INSERT INTO zones (project_id, name) VALUES 
  ('your-project-id-here', 'Zone 1'),
  ('your-project-id-here', 'Zone 2'),
  ('your-project-id-here', 'Zone 3');
