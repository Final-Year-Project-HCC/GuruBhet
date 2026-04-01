# Academic Domains Admin Interface - Implementation Guide

## Overview
This document describes the complete implementation of the Academic Domains management system for the Staff application. This system allows staff members to create and manage the hierarchical structure of universities, faculties, semesters, and subjects used in the teacher booking system.

## Architecture

### Hierarchy Structure
```
University (Root)
    └── Faculty (Multiple per University)
        └── Semester 1-N (N defined per Faculty)
            └── Subject (Multiple per Semester)
```

### Key Constraints
1. **University-First**: All other entities depend on a selected university
2. **Faculty Requires University**: Cannot create faculties without selecting a university
3. **Semester Requires Faculty**: Cannot create semesters without selecting a faculty
4. **Subject Requires Semester**: Cannot create subjects without selecting a semester
5. **Semester Count**: Maximum semesters per faculty is defined during faculty creation

## File Structure

```
Staff/src/
├── lib/
│   ├── types.ts                    # Type definitions for all academic domains
│   ├── utils.ts                    # Utility functions (existing)
│   └── useAcademicDomains.ts      # Custom React hooks for API operations
├── components/
│   └── AcademicDomains/
│       ├── index.ts               # Barrel export
│       ├── BulkInputForm.tsx      # Reusable bulk input component
│       ├── UniversityManager.tsx  # University CRUD operations
│       ├── FacultyManager.tsx     # Faculty CRUD with university selection
│       └── SubjectManager.tsx     # Semester & Subject management
├── app/
│   ├── layout.tsx                 # Modified to include navbar links
│   ├── admin-domains/
│   │   └── page.tsx               # Main admin dashboard with tabs
│   └── teachers/
│       └── page.tsx               # Existing teachers page
└── components/
    └── StaffNavbar.tsx            # Updated with new navigation links
```

## Component Breakdown

### 1. **BulkInputForm** (`BulkInputForm.tsx`)
A reusable component for adding multiple items at once with a smooth UX.

**Features:**
- Expandable/collapsible items
- Dynamic field configuration
- Add/remove items functionality
- Bulk submission with loading state
- Maximum item limit with helpful messaging

**Props:**
```typescript
interface BulkInputFormProps {
  title: string;
  fields: Array<{
    name: string;
    label: string;
    type?: "text" | "number" | "select";
    placeholder?: string;
    required?: boolean;
    options?: Array<{ label: string; value: string | number }>;
    helpText?: string;
  }>;
  onAdd: (items: BulkInputItem[]) => void;
  isLoading?: boolean;
  submitLabel?: string;
  maxItems?: number;
}
```

### 2. **UniversityManager** (`UniversityManager.tsx`)
Manages creation and listing of universities.

**Features:**
- Create single university with name and description
- Display all created universities in a card grid
- Show readiness status for next steps
- Loading and error states
- Inline form toggle for better UX

**State Management:**
- Uses `useFetchUniversities()` to load universities
- Uses `useCreateUniversity()` to create new universities
- Automatic cache invalidation on create

### 3. **FacultyManager** (`FacultyManager.tsx`)
Manages faculties within selected universities.

**Features:**
- University selection dropdown (required)
- Single faculty creation form
- Bulk faculty creation
- Faculty list with semester count badge
- Expandable faculty cards for more details

**Dependencies:**
- Must select university first
- Number of semesters is mandatory during creation
- Can add multiple faculties via bulk form

**State Management:**
- University selection state
- Conditional loading for faculties only when university is selected
- Separate mutations for single and bulk operations

### 4. **SubjectManager** (`SubjectManager.tsx`)
Manages semesters and subjects hierarchically.

**Features:**
- Step-by-step guided interface
- University selection (Step 1)
- Faculty selection (Step 2)
- Semester creation grid (Step 3) - Shows all available semesters
- Subject creation and bulk creation (Step 4)

**Smart Semester Grid:**
- Displays all semesters from 1 to N
- Green check for created semesters (disabled)
- Clickable buttons for missing semesters
- Dynamic based on faculty's semester count

**State Management:**
- Cascading dropdown selections
- Reset child selections when parent changes
- Conditional rendering based on selections

### 5. **AcademicDomainsAdmin** (`admin-domains/page.tsx`)
Main dashboard page with tab-based navigation.

**Features:**
- Three-tab interface: Universities → Faculties → Subjects
- Visual progress indicator showing 4-step process
- Smooth fade-in animations between tabs
- Comprehensive "How It Works" section
- Sticky navigation for easy access

**Tab Navigation:**
1. **Universities** - Initial setup tab
2. **Faculties** - Add faculties to universities
3. **Semesters & Subjects** - Complex multi-step management

## Custom Hooks (`useAcademicDomains.ts`)

All hooks follow React Query patterns for optimal caching and state management.

### Universities
- `useFetchUniversities()` - Get all universities
- `useCreateUniversity()` - Create a single university

### Faculties
- `useFetchFacultiesByUniversity(universityId)` - Conditional fetching
- `useCreateFaculty()` - Single faculty creation
- `useBulkCreateFaculty()` - Bulk create multiple faculties

### Semesters
- `useFetchSemestersByFaculty(universityId, facultyId)` - Conditional fetching
- `useCreateSemester()` - Create semester with validation

### Subjects
- `useFetchSubjectsByFaculty(universityId, facultyId, semesterId)` - Triple conditional fetching
- `useCreateSubject()` - Single subject creation
- `useBulkCreateSubject()` - Bulk create multiple subjects

**Cache Invalidation:**
- Each mutation invalidates its corresponding query key
- Cascading updates: creating items invalidates parent listings
- Automatic toast notifications for success/error states

## UX Design Principles

### 1. **Progressive Disclosure**
- Show only relevant options based on current selections
- Disable/hide features that can't be used yet
- Clear guidance messages for each step

### 2. **Constraint Enforcement**
Visual feedback prevents invalid states:
- Grayed-out semesters that already exist
- Disabled inputs for missing prerequisites
- Warning messages when requirements aren't met

### 3. **Bulk Operations**
- Single "Add Multiple" button alongside single item creation
- Expandable form for managing multiple items at once
- Up to 15 items can be added in one request

### 4. **Visual Feedback**
- Loading states with spinner animations
- Success/error toast notifications
- Smooth transitions and animations
- Color-coded status indicators (green check for ready items)

### 5. **Navigation Clarity**
- Breadcrumb-style display of current path
- Clear step numbers in the UI
- "How It Works" section explains the flow
- Informative placeholder messages

## API Endpoints (Expected)

The following endpoints should be implemented in the backend:

```
GET    /staff/universities
POST   /staff/universities

GET    /staff/universities/:universityId/faculties
POST   /staff/universities/:universityId/faculties
POST   /staff/faculties/bulk

GET    /staff/universities/:universityId/faculties/:facultyId/semesters
POST   /staff/universities/:universityId/faculties/:facultyId/semesters

GET    /staff/universities/:universityId/faculties/:facultyId/semesters/:semesterId/subjects
POST   /staff/universities/:universityId/faculties/:facultyId/semesters/:semesterId/subjects
POST   /staff/subjects/bulk
```

## Usage Examples

### Complete Workflow

1. **Create Universities**
   - Navigate to "Academic Setup" → "Universities" tab
   - Click "Add University"
   - Enter university name and optional description
   - Submit

2. **Add Faculties**
   - Navigate to "Faculties" tab
   - Select a university from dropdown
   - Fill in faculty details and semester count
   - Can add multiple faculties using "Add Multiple" button

3. **Create Semesters & Subjects**
   - Navigate to "Semesters & Subjects" tab
   - Select university (Step 1)
   - Select faculty (Step 2)
   - Click semester buttons to create them (Step 3)
   - Select a semester
   - Add subjects (single or bulk) (Step 4)

### Bulk Adding Subjects

```typescript
// Example: Add 5 subjects at once
const items = [
  { id: "1", name: "Calculus I", description: "Advanced calculus" },
  { id: "2", name: "Physics I", description: "Mechanics" },
  { id: "3", name: "Chemistry I", description: "General chemistry" },
  // ... more items
];
handleBulkAddSubjects(items);
```

## Styling

All components use Tailwind CSS with support for:
- Light and dark modes
- Custom Tailwind configuration from the existing project
- Consistent spacing and typography
- Accessible color contrasts

### Color Scheme
- `primary` - Action buttons and highlights
- `foreground/background` - Text and backgrounds
- `muted` - Secondary content
- `destructive` - Delete/remove actions
- `border` - Divider lines

## Type Safety

All operations are fully typed with TypeScript:
- Request/response interfaces in `types.ts`
- Proper type inference in React hooks
- TypeScript strict mode compliance

## Error Handling

- Automatic error toast notifications
- Graceful fallbacks for failed requests
- Loading states for all async operations
- Disabled buttons during mutations
- Error boundary ready (can be added if needed)

## Performance Considerations

- React Query caching prevents unnecessary API calls
- Lazy loading with conditional query enabling
- Memoization of calculations (e.g., semester numbers)
- Optimistic updates available (can be added)
- Pagination ready (for large datasets)

## Future Enhancements

1. **Bulk Edit/Delete** - Modify existing items in bulk
2. **Search & Filter** - Find universities, faculties, subjects
3. **Drag & Reorder** - Reorder subjects or semesters
4. **CSV Import** - Bulk import data from CSV files
5. **Archive/Soft Delete** - Preserve historical data
6. **Audit Logs** - Track changes by staff member
7. **Template/Presets** - Save and reuse common structures
8. **Analytics** - Show usage statistics

## Testing Checklist

- [ ] Create multiple universities
- [ ] Add faculties to each university
- [ ] Create faculties with different semester counts
- [ ] Use bulk faculty creation
- [ ] Create all semesters for a faculty
- [ ] Add subjects to different semesters
- [ ] Use bulk subject creation
- [ ] Test error states (network failures)
- [ ] Test loading states
- [ ] Verify cache invalidation
- [ ] Test responsive design on mobile
- [ ] Test dark/light mode switching
- [ ] Verify constraint enforcement (can't create without prerequisites)

## Troubleshooting

### Faculties not loading after university selection
- Check that university ID is properly set
- Verify API endpoint is correct
- Check network tab for API errors

### Semesters not showing as created
- Clear React Query cache in dev tools
- Verify semester numbers are in valid range (1-N)
- Check API response for errors

### Bulk operations failing
- Ensure all required fields are filled
- Check max item limit hasn't been exceeded
- Verify API supports bulk endpoints

## Support & Maintenance

For questions or issues with this implementation:
1. Check the UI for constraint violation messages
2. Review browser console for errors
3. Check Network tab for API failures
4. Review React Query dev tools for cache state
