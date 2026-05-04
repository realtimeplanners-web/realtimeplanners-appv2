-- WBS (Tasks) Table Schema
-- This table will store Work Breakdown Structure (WBS) tasks

-- Create tasks table for WBS
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    level INTEGER NOT NULL DEFAULT 1,
    wbs_code TEXT NOT NULL,
    task_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add task_id to activities table
ALTER TABLE activities ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- Add quantity and unit fields to activities table for QS
ALTER TABLE activities ADD COLUMN IF NOT EXISTS quantity DECIMAL(10,2);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS boq_rate DECIMAL(10,2);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_wbs_code ON tasks(wbs_code);
CREATE INDEX IF NOT EXISTS idx_activities_task_id ON activities(task_id);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks table
CREATE POLICY "Users can view tasks for their projects" ON tasks
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects 
            WHERE organization_id = (
                SELECT organization_id FROM users 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert tasks for their projects" ON tasks
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT id FROM projects 
            WHERE organization_id = (
                SELECT organization_id FROM users 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update tasks for their projects" ON tasks
    FOR UPDATE USING (
        project_id IN (
            SELECT id FROM projects 
            WHERE organization_id = (
                SELECT organization_id FROM users 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete tasks for their projects" ON tasks
    FOR DELETE USING (
        project_id IN (
            SELECT id FROM projects 
            WHERE organization_id = (
                SELECT organization_id FROM users 
                WHERE id = auth.uid()
            )
        )
    );

-- Function to auto-generate WBS code
CREATE OR REPLACE FUNCTION generate_wbs_code(p_project_id UUID, p_parent_id UUID)
RETURNS TEXT AS $$
DECLARE
    parent_wbs TEXT;
    max_child_num INTEGER;
    new_wbs_code TEXT;
BEGIN
    IF p_parent_id IS NULL THEN
        -- Root level task: get max number for root tasks in this project
        SELECT COALESCE(MAX(CAST(wbs_code AS INTEGER)), 0) + 1
        INTO max_child_num
        FROM tasks
        WHERE project_id = p_project_id AND parent_id IS NULL;
        
        new_wbs_code := max_child_num::TEXT;
    ELSE
        -- Child task: get parent's WBS code and find max child number
        SELECT wbs_code INTO parent_wbs
        FROM tasks
        WHERE id = p_parent_id;
        
        SELECT COALESCE(MAX(CAST(SPLIT_PART(wbs_code, '.', 2) AS INTEGER)), 0) + 1
        INTO max_child_num
        FROM tasks
        WHERE parent_id = p_parent_id;
        
        new_wbs_code := parent_wbs || '.' || max_child_num::TEXT;
    END IF;
    
    RETURN new_wbs_code;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate task level
CREATE OR REPLACE FUNCTION calculate_task_level(p_parent_id UUID)
RETURNS INTEGER AS $$
DECLARE
    parent_level INTEGER;
BEGIN
    IF p_parent_id IS NULL THEN
        RETURN 1;
    ELSE
        SELECT level INTO parent_level
        FROM tasks
        WHERE id = p_parent_id;
        
        RETURN parent_level + 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set level and wbs_code
CREATE OR REPLACE FUNCTION set_task_attributes()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-calculate level
    NEW.level := calculate_task_level(NEW.parent_id);
    
    -- Auto-generate WBS code
    NEW.wbs_code := generate_wbs_code(NEW.project_id, NEW.parent_id);
    
    -- Update timestamp
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_set_task_attributes
    BEFORE INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_task_attributes();

-- Update trigger for activities
CREATE OR REPLACE FUNCTION update_activities_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_activities_timestamp
    BEFORE UPDATE ON activities
    FOR EACH ROW
    EXECUTE FUNCTION update_activities_timestamp();

-- Insert sample data for testing
INSERT INTO tasks (project_id, parent_id, task_name) VALUES
-- Replace with actual project UUIDs from your database
(NULL, NULL, 'Project Initiation'),
(NULL, NULL, 'Design Phase'),
(NULL, NULL, 'Construction Phase'),
(NULL, NULL, 'Commissioning');

-- Note: Uncomment and update with actual project UUIDs when implementing
-- INSERT INTO tasks (project_id, parent_id, task_name) VALUES
-- (your-project-uuid-1, NULL, 'Project Initiation'),
-- (your-project-uuid-1, NULL, 'Design Phase'),
-- (your-project-uuid-1, NULL, 'Construction Phase'),
-- (your-project-uuid-1, NULL, 'Commissioning');
