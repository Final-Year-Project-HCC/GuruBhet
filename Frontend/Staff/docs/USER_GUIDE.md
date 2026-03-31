# Staff Admin Application - User Guide

## Introduction

The Staff Admin Application provides comprehensive tools for managing the academic structure and teacher verification system. This guide walks you through all the features and workflows.

## Dashboard Overview

The Staff Dashboard is your central hub with quick access to:
- **Teachers** - Review and approve teacher registrations
- **Academic Setup** - Manage the complete academic hierarchy

### Navigating the App

Use the navigation bar at the top:
- **GuruBhet Logo** - Returns to dashboard
- **Teachers** - Teacher management page
- **Academic Setup** - Academic domains management
- **Profile Menu** - Account options (top right)

---

## Academic Setup - Complete Workflow

Your academic structure has 4 levels and must be created in order:

```
1️⃣ Universities (Create First)
    ↓
2️⃣ Faculties (Select University → Add Faculties)
    ↓
3️⃣ Semesters (Select Faculty → Create Semesters 1-N)
    ↓
4️⃣ Subjects (Select Semester → Add Subjects)
```

### Why This Order?

- Teachers need to know which **University** they teach at
- Then select a **Faculty** within that university
- Then choose a **Semester** (e.g., 1st year, 2nd year)
- Finally, pick **Subjects** they teach

---

## Step-by-Step Guide

### ✅ Step 1: Create Universities

**Where:** Academic Setup → Universities Tab

1. Click **"+ Add University"**
2. Enter university name (required)
3. Add optional description (what this university is known for)
4. Click **Create**

**Example:**
- Name: "Tribhuvan University"
- Description: "Nepal's oldest and largest university"

**Tips:**
- Create all main universities in your system
- You can add more universities anytime
- Names must be unique
- Descriptions help staff remember each university

**Bulk Creation:**
Currently you must create universities one at a time. This ensures data accuracy.

---

### ✅ Step 2: Add Faculties

**Where:** Academic Setup → Faculties Tab

**Prerequisites:** At least one university created

#### Process:
1. **Select a University** from the dropdown
   - This is required - you must choose one university
   - The system will only show faculties for this university
   
2. **Add an Individual Faculty:**
   - Faculty Name: e.g., "Faculty of Engineering"
   - Description (Optional): "Engineering programs"
   - Number of Semesters: 4, 6, or 8 (depends on program length)
   - Click **Add Faculty**

3. **Add Multiple Faculties at Once:**
   - Click **Add Multiple** button
   - Use the bulk form to add up to 10 faculties
   - Each faculty needs a name and semester count
   - Click **Create Faculties**

**Example Faculties for Tribhuvan University:**
- Faculty of Science (6 semesters)
- Faculty of Engineering (8 semesters)
- Faculty of Humanities (6 semesters)
- Faculty of Management (4 semesters)

**Important Notes:**
- Semester count is fixed when creating faculty - it determines how many semester options exist
- Cannot change semester count later - create carefully
- You can add more faculties to the same university anytime

**Bulk Adding Example:**
```
Faculty 1: Faculty of Science, 6 semesters
Faculty 2: Faculty of Engineering, 8 semesters
Faculty 3: Faculty of Medicine, 6 semesters
```

---

### ✅ Step 3: Create Semesters

**Where:** Academic Setup → Semesters & Subjects Tab

**Prerequisites:** At least one faculty created

#### Process:
1. **Select University** (Step 1)
2. **Select Faculty** (Step 2)
   - Shows semester count for this faculty, e.g., "6 semesters"
3. **Create Semesters** (Step 3)
   - Grid shows buttons: "+ Sem 1", "+ Sem 2", etc.
   - Click each semester button to create it
   - Green checkmarks appear when created
   - Once created, cannot be created again (intentional)

**Why One by One?**
Sometimes faculties might only offer certain semesters. This gives flexibility.

**After Creating Semesters:**
- Select one semester to start adding subjects
- You'll see blue information box confirming your selection

---

### ✅ Step 4: Add Subjects

**Where:** Academic Setup → Semesters & Subjects Tab

**Prerequisites:** At least one semester created

#### Process:
1. Make sure university, faculty, and semester are selected
2. You should see the blue "Adding Subjects for Semester X" section

**Add Individual Subject:**
- Subject Name: e.g., "Calculus I"
- Description (Optional): "Advanced mathematics"
- Click **Add Subject**

**Add Multiple Subjects at Once:**
- Click **Add Multiple**
- Use the form to add up to 15 subjects
- Example: Add all subjects for Semester 1 at once
- Click **Create Subjects**

**Example Subjects for Engineering Semester 1:**
- Calculus I
- Physics I
- Chemistry I
- Engineering Drawing
- Fundamentals of Computing
- English Communication

---

## Advanced Features

### Bulk Operations

#### When to Use Bulk Adding:
- ✅ Adding many faculties to one university
- ✅ Adding many subjects to one semester
- ✅ Setting up a new university with many subjects

#### How Bulk Adding Works:
1. Click **"Add Multiple"** button
2. Fill in first item (required fields marked with *)
3. Click **"Add Another Item"** to add more
4. Remove items with the X button if needed
5. Click **"Create [Items]"** to submit all at once

#### Bulk Form Features:
- Expandable/collapsible items (click item to expand)
- Shows count of items being added
- Items number automatically
- Shows validation errors
- Loading spinner during submission

---

### Managing Existing Data

#### View Created Items:
- Universities: Shows on Universities tab
- Faculties: Shows list for selected university
- Subjects: Shows list for selected semester

#### Update Items:
Currently, items cannot be edited if used by teachers. Plan accordingly.

#### Delete Items:
Delete functionality is not enabled to prevent breaking teacher bookings.

---

## Common Workflows

### Setup New University from Scratch

1. **Universities Tab**
   - Add "New University Name"

2. **Faculties Tab**
   - Select new university
   - Add multiple faculties using bulk form
   - Example: Science, Engineering, Humanities

3. **Semesters & Subjects Tab**
   - For each faculty:
     - Select university
     - Select faculty
     - Create each semester (1, 2, 3... up to N)
     - Add subjects for each semester

### Add Subjects to Existing Structure

1. Go to **Semesters & Subjects Tab**
2. Select university
3. Select faculty
4. Select semester
5. Use "Add Subject" or "Add Multiple" to add subjects

### Verify Academic Structure

**Check Universities:**
- Go to Universities tab → see all created universities

**Check Faculties:**
- Universities tab → Faculties tab
- Select university → see all faculties with semester counts

**Check Semesters:**
- Semesters & Subjects tab
- Select university and faculty → see created semesters (green checkmarks)

---

## Tips & Best Practices

### Planning

- 📋 Plan your structure before entering data
- 📋 Make a list of all universities, faculties, and subjects
- 📋 Note semester counts for each faculty

### Naming Conventions

**Universities:**
- Use official names: "Tribhuvan University", "Pokhara University"
- Include location if helpful

**Faculties:**
- Use "Faculty of [Name]" format
- Examples: "Faculty of Science", "Faculty of Engineering"

**Subjects:**
- Use proper subject names: "Calculus I", "Physics II"
- Include semester/level if needed: "Discrete Mathematics II"

### Organization

- Add universities in geographical order
- Group faculties logically within universities
- Organize subjects by difficulty/progression

### Updating Data

- ⚠️ **Careful with changes:** Once teachers use these, changes affect them
- Check Teacher section to see which faculties/subjects are in use
- Plan structure thoroughly before teacher registrations

---

## Error Messages & Troubleshooting

### "No Universities Found"
- **Cause:** You haven't created any universities yet
- **Solution:** Go to Universities tab → Create first university

### "No Faculties Found"
- **Cause:** Selected university has no faculties
- **Solution:** Go to Faculties tab → Select same university → Add faculties

### Faculty Selection Shows "Loading"
- **Cause:** API is fetching data
- **Solution:** Wait a moment, then refresh if stuck

### Can't Select Latest Created Item
- **Cause:** Cache may not be updated
- **Solution:** Refresh page or wait a moment

### Subject Creation Returns Error
- **Cause:** Missing semester selection
- **Solution:** Ensure semester is selected (blue box should appear)

---

## Working with Teachers

Once academic structure is set up:

1. Teachers can view universities and faculties during signup
2. When creating bookings, teachers select:
   - University → Faculty → Semester → Subject
3. Student-side filtering works automatically

### Recommended Order:
1. Create complete academic structure for 1-2 universities
2. Enable teacher registrations
3. Teachers start creating bookings
4. Add more universities/faculties as needed

---

## Performance Notes

- Creating all semesters may take a moment for faculties with 8+ semesters
- Bulk operations are faster than individual additions
- Large bulk operations (10+ items) take a few seconds
- Refresh page if list seems outdated

---

## FAQ

**Q: Can I change the number of semesters after creating a faculty?**
A: No. Create faculties with correct semester count. Plan first.

**Q: Can I delete universities/faculties/subjects?**
A: Not in this version. This prevents breaking teacher bookings.

**Q: Can I reorder subjects or semesters?**
A: Not currently. Subjects appear in creation order.

**Q: What if I create a mistake?**
A: Contact system administrator. Deletions need manual database intervention.

**Q: How many universities can I have?**
A: Unlimited. System scales to thousands.

**Q: Can I have a semester without subjects?**
A: Yes, but teachers won't be able to select it for bookings.

**Q: What about duplicate names?**
A: System allows duplicates. Use clear naming to avoid confusion.

---

## Important Reminders

⚠️ **Before uploading to production:**
- [ ] Create all universities
- [ ] Add all faculties for each university
- [ ] Create all semesters for each faculty
- [ ] Add all subjects for each semester
- [ ] Review all created data for accuracy
- [ ] Test with a teacher account (verify they see correct options)

---

## Getting Help

If you encounter issues:
1. Check this guide's Troubleshooting section
2. Review error messages carefully
3. Refresh the page and try again
4. Contact your system administrator

---

**Last Updated:** March 2026
**Version:** 1.0
