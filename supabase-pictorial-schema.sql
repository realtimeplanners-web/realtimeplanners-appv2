-- Pictorial Module Schema for RealTimePlanners
-- Add these tables to your existing Supabase database

-- 1. Pictorial Pages Table
CREATE TABLE pictorial_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    floor_plan_url TEXT, -- URL to the floor plan image in Supabase Storage
    canvas_data TEXT, -- Base64 encoded canvas data or JSON with drawing data
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'archived')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Pictorial Progress Table (for tracking painted areas)
CREATE TABLE pictorial_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES pictorial_pages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    progress_data TEXT NOT NULL, -- JSON with areas painted, colors, timestamps
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Pictorial Annotations Table (for detailed annotations on floor plans)
CREATE TABLE pictorial_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES pictorial_pages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    annotation_type VARCHAR(50) NOT NULL CHECK (annotation_type IN ('area', 'note', 'issue', 'photo')),
    coordinates JSONB NOT NULL, -- {x: number, y: number, width?: number, height?: number}
    data JSONB, -- Additional data like color, text, image_url, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_pictorial_pages_project_id ON pictorial_pages(project_id);
CREATE INDEX idx_pictorial_pages_zone_id ON pictorial_pages(zone_id);
CREATE INDEX idx_pictorial_pages_status ON pictorial_pages(status);
CREATE INDEX idx_pictorial_progress_page_id ON pictorial_progress(page_id);
CREATE INDEX idx_pictorial_progress_user_id ON pictorial_progress(user_id);
CREATE INDEX idx_pictorial_annotations_page_id ON pictorial_annotations(page_id);
CREATE INDEX idx_pictorial_annotations_user_id ON pictorial_annotations(user_id);

-- RLS (Row Level Security) Policies for Pictorial Tables
ALTER TABLE pictorial_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pictorial_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE pictorial_annotations ENABLE ROW LEVEL SECURITY;

-- Policies for pictorial_pages
CREATE POLICY "Users can view pictorial pages in their projects" ON pictorial_pages FOR SELECT USING (
    auth.role() = 'authenticated' AND 
    project_id IN (
        SELECT id FROM projects WHERE 
        -- Add your organization-based filtering here if needed
        true
    )
);

CREATE POLICY "Users can create pictorial pages" ON pictorial_pages FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their pictorial pages" ON pictorial_pages FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    created_by = auth.uid()
);

CREATE POLICY "Users can delete their pictorial pages" ON pictorial_pages FOR DELETE USING (
    auth.role() = 'authenticated' AND 
    created_by = auth.uid()
);

-- Policies for pictorial_progress
CREATE POLICY "Users can view pictorial progress" ON pictorial_progress FOR SELECT USING (
    auth.role() = 'authenticated'
);

CREATE POLICY "Users can create pictorial progress" ON pictorial_progress FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their pictorial progress" ON pictorial_progress FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    user_id = auth.uid()
);

CREATE POLICY "Users can delete their pictorial progress" ON pictorial_progress FOR DELETE USING (
    auth.role() = 'authenticated' AND 
    user_id = auth.uid()
);

-- Policies for pictorial_annotations
CREATE POLICY "Users can view pictorial annotations" ON pictorial_annotations FOR SELECT USING (
    auth.role() = 'authenticated'
);

CREATE POLICY "Users can create pictorial annotations" ON pictorial_annotations FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their pictorial annotations" ON pictorial_annotations FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    user_id = auth.uid()
);

CREATE POLICY "Users can delete their pictorial annotations" ON pictorial_annotations FOR DELETE USING (
    auth.role() = 'authenticated' AND 
    user_id = auth.uid()
);

-- Triggers for automatic updated_at
CREATE TRIGGER update_pictorial_pages_updated_at BEFORE UPDATE ON pictorial_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pictorial_annotations_updated_at BEFORE UPDATE ON pictorial_annotations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage Bucket for Floor Plans (run this in Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('floor-plans', 'floor-plans', true);

-- Storage Policies for floor-plans bucket
CREATE POLICY "Users can upload floor plans" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'floor-plans' AND 
    auth.role() = 'authenticated'
);

CREATE POLICY "Users can view floor plans" ON storage.objects FOR SELECT USING (
    bucket_id = 'floor-plans' AND 
    auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their floor plans" ON storage.objects FOR UPDATE USING (
    bucket_id = 'floor-plans' AND 
    auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their floor plans" ON storage.objects FOR DELETE USING (
    bucket_id = 'floor-plans' AND 
    auth.role() = 'authenticated'
);
