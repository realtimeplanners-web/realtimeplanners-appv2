# WBS (Tasks) + Activities Integration Setup Guide

## Overview
This integration provides a clean separation between Work Breakdown Structure (WBS) planning and execution activities, without breaking existing functionality.

## Database Setup

### 1. Run the Schema Migration
Execute the SQL file to create the necessary tables and update existing ones:

```sql
-- Run: supabase-wbs-schema.sql
```

This creates:
- `tasks` table for WBS structure
- Adds `task_id`, `quantity`, `unit`, `boq_rate` fields to `activities` table
- Auto-generates WBS codes and levels
- Sets up proper RLS policies

## New Pages Created

### 1. `/planning` - WBS Management
**Features:**
- Create WBS nodes with parent selection
- Auto level calculation (parent.level + 1)
- Auto WBS code generation (root: 1,2,3 | child: parent.wbs_code + ".1")
- Tree view with expand/collapse
- Add child tasks to any node
- Delete tasks (with confirmation)

**Access:** `http://localhost:3000/planning`

### 2. `/qs` - Quantity Surveying
**Features:**
- Select activity to update QS data
- Input quantity, unit, and BOQ rate
- Calculate total values automatically
- View all activities with QS status
- Project value summary

**Access:** `http://localhost:3000/qs`

## Updated Features

### 1. Activity Creation Enhanced
- Added WBS task selection dropdown
- Optional linking to WBS tasks
- Maintains all existing functionality
- No breaking changes to existing flow

### 2. Activity List Display Enhanced
- Shows linked WBS information (when available)
- Displays quantity and unit data
- Shows total calculated values
- Clean visual separation with color-coded borders

## Database Schema

### Tasks Table (WBS)
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    parent_id UUID REFERENCES tasks(id),
    level INTEGER NOT NULL DEFAULT 1,
    wbs_code TEXT NOT NULL,
    task_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Activities Table (Updated)
```sql
-- Added fields:
task_id UUID REFERENCES tasks(id),
quantity DECIMAL(10,2),
unit TEXT,
boq_rate DECIMAL(10,2)
```

## Key Features

### 1. Auto WBS Code Generation
- **Root tasks:** 1, 2, 3, 4...
- **Child tasks:** parent.wbs_code + ".1", parent.wbs_code + ".2", etc.
- **Example:** 
  - 1 (Foundation)
  - 1.1 (Excavation)
  - 1.2 (Concrete Work)
  - 2 (Structure)
  - 2.1 (Columns)
  - 2.2 (Beams)

### 2. Auto Level Calculation
- Root tasks: Level 1
- Child tasks: Parent level + 1
- Unlimited nesting depth

### 3. Clean Integration
- **No breaking changes** to existing activities flow
- **Optional WBS linking** - activities can exist without WBS
- **Backward compatible** - existing activities continue to work
- **Progress updates** remain unchanged

## Navigation Flow

### Recommended Workflow:
1. **Planning Phase:** `/planning` - Create WBS structure
2. **Activity Creation:** `/activities` - Link activities to WBS tasks
3. **QS Management:** `/qs` - Add quantities and rates
4. **Progress Tracking:** `/activities` - Update progress (unchanged)

## Usage Examples

### Creating WBS Structure:
1. Go to `/planning`
2. Select project
3. Click "Add Root Task" for main phases
4. Click "Add Child" on any task for sub-tasks
5. System auto-generates codes and levels

### Creating Activities:
1. Go to `/activities`
2. Select zone and project
3. Fill activity details
4. **Optional:** Select WBS task from dropdown
5. Save activity

### Adding QS Data:
1. Go to `/qs`
2. Select activity from dropdown
3. Enter quantity, unit, and BOQ rate
4. System calculates total value
5. Update multiple activities as needed

## Visual Indicators

### Activity Cards Show:
- **Purple border:** WBS information (when linked)
- **Orange border:** Quantity information (when set)
- **Blue border:** Planned dates (existing)
- **Green border:** Actual dates (existing)

## Testing Checklist

### ✅ Database Setup:
- [ ] Run supabase-wbs-schema.sql
- [ ] Verify tasks table exists
- [ ] Verify activities table has new fields

### ✅ WBS Planning:
- [ ] Create root tasks
- [ ] Create child tasks
- [ ] Verify auto code generation
- [ ] Verify auto level calculation
- [ ] Test delete functionality

### ✅ Activity Integration:
- [ ] Create activity without WBS (existing flow)
- [ ] Create activity with WBS link
- [ ] Verify WBS dropdown populates
- [ ] Test activity list display

### ✅ QS Management:
- [ ] Add quantity data to activities
- [ ] Verify total calculations
- [ ] Test QS status display
- [ ] Verify project value summary

### ✅ Backward Compatibility:
- [ ] Existing activities still work
- [ ] Progress updates unchanged
- [ ] Zone functionality preserved
- [ ] User permissions maintained

## Error Handling

### Common Issues:
1. **WBS codes duplicate:** Handled by database functions
2. **Circular references:** Prevented by parent_id constraints
3. **Missing tasks:** Graceful fallback in activity display
4. **Invalid quantities:** Form validation on QS page

## Future Enhancements

### Potential Additions:
- WBS template copying between projects
- Bulk QS data import
- WBS progress visualization
- Cost tracking integration
- Resource assignment to WBS tasks

## Support

For issues or questions:
1. Check browser console for errors
2. Verify database schema is applied
3. Ensure proper user permissions
4. Test with sample data first

---

**Status:** ✅ Complete and Ready for Testing

The integration maintains clean separation between planning (WBS) and execution (activities) while providing powerful new capabilities for project management.
