# Pictorial Progress Tracker Setup Guide

This guide will help you set up the pictorial progress tracking functionality in your RealTimePlanners project.

## Overview

The pictorial module allows users to:
- Upload floor plan images for different project sections/zones
- Paint on floor plans to mark progress areas
- Track visual progress with different colors (Complete, In Progress, etc.)
- Save and restore progress automatically
- Manage multiple sections per project

## Database Setup

### 1. Run the SQL Schema

Execute the SQL commands in `supabase-pictorial-schema.sql` in your Supabase database:

```sql
-- You can run this in the Supabase Dashboard SQL Editor
-- Or use the Supabase CLI: supabase db push
```

### 2. Create Storage Bucket

In your Supabase Dashboard:

1. Go to **Storage** section
2. Click **New bucket**
3. Create a bucket named `floor-plans`
4. Make it **public** (so images can be accessed via URL)

### 3. Set Up Storage Policies

The SQL schema includes storage policies, but you may need to manually configure them in the Supabase Dashboard if they don't apply automatically.

## Integration Points

### 1. Navigation

Add the pictorial page to your navigation. You can access it at:
```
/pictorial
```

### 2. URL Parameters

The pictorial page supports URL parameters for direct access:
```
/pictorial?project_id=your-project-id&zone_id=your-zone-id
```

### 3. Permission Integration

The pictorial module uses the same authentication and role-based access as your existing activities page.

## Features

### Core Functionality
- **Multi-project support**: Switch between different projects
- **Zone filtering**: Filter by specific zones within projects
- **Section management**: Create multiple sections per project/zone
- **Floor plan upload**: Drag & drop or click to upload floor plan images
- **Progress painting**: Paint on floor plans with different colors and brush sizes
- **Auto-save**: Progress is automatically saved to Supabase
- **Undo functionality**: Undo recent painting actions
- **Eraser tool**: Remove painted areas
- **Progress tracking**: Visual and percentage-based progress tracking

### Color Coding
- 🟢 **Green** (#22c55e): Complete
- 🟡 **Yellow** (#eab308): In Progress
- 🟠 **Orange** (#f97316): Partial
- 🔴 **Red** (#ef4444): Issue
- 🔵 **Blue** (#3b82f6): Inspected

## Database Tables

### pictorial_pages
- Stores floor plan sections
- Links to projects and zones
- Contains floor plan image URLs

### pictorial_progress
- Tracks user progress on each page
- Stores canvas data as base64
- Calculates progress percentages

### pictorial_annotations
- Detailed annotations on floor plans
- Supports different annotation types
- Stores coordinates and metadata

## File Structure

```
apps/admin/src/
├── app/pictorial/
│   └── page.tsx                 # Main pictorial page
├── components/
│   └── PictorialViewer.tsx      # Core pictorial component
└── lib/
    └── supabase.ts              # Existing Supabase client
```

## Usage

### For Users

1. Navigate to `/pictorial`
2. Select a project from the dropdown
3. Optionally select a zone
4. Click "Add Section" to create a new section
5. Upload a floor plan image
6. Use the color palette to paint progress areas
7. Progress is automatically saved

### For Developers

The component can be embedded in other pages:

```tsx
import PictorialViewer from '@/components/PictorialViewer';

<PictorialViewer 
  projectId="your-project-id" 
  zoneId="optional-zone-id"
/>
```

## Customization

### Styling
The component uses Tailwind CSS classes that match your existing design system. You can customize colors, spacing, and layout by modifying the classes in `PictorialViewer.tsx`.

### Additional Features
You can extend the functionality by:
- Adding more annotation types
- Implementing real-time collaboration
- Adding export functionality
- Integrating with activity progress

## Troubleshooting

### Common Issues

1. **Images not uploading**: Check Supabase storage bucket permissions
2. **Progress not saving**: Verify RLS policies on pictorial tables
3. **Canvas not responding**: Check browser console for JavaScript errors
4. **Authentication errors**: Ensure user is properly authenticated

### Debug Mode

Add console logging to debug issues:
```javascript
console.log('Pictorial Debug:', { activePage, user, progress });
```

## Performance Considerations

- Large images are automatically resized to fit the canvas
- Canvas data is compressed before saving
- Consider implementing image compression for very large floor plans
- Progress is saved periodically to prevent data loss

## Security

- All data is protected by Supabase Row Level Security (RLS)
- Users can only access their own progress data
- Storage policies prevent unauthorized file access
- Input validation prevents malicious uploads

## Future Enhancements

- Real-time collaboration between users
- Advanced annotation tools
- Progress reporting and analytics
- Mobile app support
- Integration with BIM/CAD files
- Automated progress calculation from photos

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify Supabase configuration
3. Ensure all SQL tables were created successfully
4. Check that storage bucket exists and has correct policies
