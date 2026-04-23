-- RealTimePlanners Database Schema
-- Created for Supabase PostgreSQL

-- 1. Projects Table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Zones Table
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Activities Table
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    planned_start DATE,
    planned_end DATE,
    duration_days INTEGER,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Progress Updates Table
CREATE TABLE progress_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    progress_percent INTEGER CHECK (progress_percent >= 0 AND progress_percent <= 100),
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_zones_project_id ON zones(project_id);
CREATE INDEX idx_activities_project_id ON activities(project_id);
CREATE INDEX idx_activities_zone_id ON activities(zone_id);
CREATE INDEX idx_progress_updates_activity_id ON progress_updates(activity_id);

-- RLS (Row Level Security) Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_updates ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (you can restrict this later)
CREATE POLICY "Users can view all projects" ON projects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert projects" ON projects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update projects" ON projects FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete projects" ON projects FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all zones" ON zones FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert zones" ON zones FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update zones" ON zones FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete zones" ON zones FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all activities" ON activities FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert activities" ON activities FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update activities" ON activities FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete activities" ON activities FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all progress updates" ON progress_updates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert progress updates" ON progress_updates FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update progress updates" ON progress_updates FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete progress updates" ON progress_updates FOR DELETE USING (auth.role() = 'authenticated');

-- Functions for automatic timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_progress_updates_updated_at BEFORE UPDATE ON progress_updates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
