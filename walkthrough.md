# Walkthrough: Course/Folder System for Worksheets

## Changes Summary

### Bug Fixes (from earlier in session)
1. **Worksheet preview bug** (`src/app/assignments/[id]/AssignmentPlayer.tsx`): Fixed "Unknown exercise widget type: worksheet" error by adding composite type exclusions to the early-return guard on line 303.
2. **Register worksheet bug** (`src/app/actions.ts`): Removed the hard error when a folder already exists; now overwrites content files like the update path does.
3. **Orphaned folders**: Deleted `content/exercises/u1-alphabet-01/` and `content/exercises/u1-spelling-01/` (no content files).

### New Feature: Course/Folder System

#### Database Schema (`prisma/schema.prisma`)
- **`Course` model**: `id`, `title`, `description`, `order`, `createdAt`, `updatedAt` — groups worksheets into folders
- **`CourseAssignment` model**: `id`, `classroomId`, `courseId`, `dueDate`, `createdAt` — assigns an entire course to a classroom
- **`Exercise` model**: Added `courseId` (optional FK to Course) and `order` (position within course)
- **`Assignment` model**: Added `courseAssignmentId` (optional FK to CourseAssignment) — links individual assignments back to their course assignment
- **`Classroom` model**: Added `courseAssignments` relation

#### Server Actions (`src/app/actions.ts`)
New actions:
- `createCourse(title, description?)` — Create a course
- `updateCourse(id, title, description?)` — Edit course metadata
- `deleteCourse(id)` — Delete course (ungroups exercises, doesn't delete them)
- `addExerciseToCourse(exerciseId, courseId)` — Add worksheet to course
- `removeExerciseFromCourse(exerciseId)` — Remove worksheet from course
- `reorderCourseExercises(courseId, exerciseIds[])` — Reorder worksheets within a course
- `assignCourse(classroomId, courseId, dueDateStr?)` — Assign all course exercises to a classroom
- `deleteExercise(exerciseId)` — Delete exercise (disk + DB, cascades to assignments/submissions)

Updated:
- `createWorksheet` — Now accepts optional `courseId` parameter; fixed the "folder already exists" error

#### Exercise Sync (`src/lib/exercises.ts`)
- `syncExercisesToDb()` now preserves `courseId` and `order` on update (these are DB-managed, not stored on disk)

#### Teacher Dashboard (`src/app/teacher/page.tsx`)
- **Courses section**: Expandable folder cards showing course title, description, worksheet count, and action buttons (Edit, Delete, Assign)
- **Standalone Worksheets section**: Flat table of exercises not in any course, with Preview/Edit/Delete buttons
- **"+ Create Course" button**: Inline form for creating new courses

#### New Components
- `src/app/teacher/DeleteExerciseButton.tsx` — Client component with confirmation dialog for deleting exercises
- `src/app/teacher/DeleteCourseButton.tsx` — Client component with confirmation dialog for deleting courses
- `src/app/teacher/CreateCourseForm.tsx` — Inline form for creating courses

#### Course Management Page (`src/app/teacher/courses/[courseId]/`)
- `page.tsx` — Server component: auth, data fetching
- `CourseDetailClient.tsx` — Interactive client component with:
  - Edit course title/description
  - Ordered worksheet list with up/down reorder buttons
  - Add worksheet from standalone exercises
  - Remove worksheet from course
  - Delete course with confirmation

#### WorksheetCreator (`src/app/teacher/create/WorksheetCreator.tsx`)
- Added `courses` prop and `selectedCourseId` state
- Course selector dropdown (optional) when creating a new worksheet
- Passes `courseId` to `createWorksheet` server action

#### Create/Edit Pages
- `src/app/teacher/create/page.tsx` — Now fetches courses and passes them to WorksheetCreator
- `src/app/teacher/edit/[exerciseId]/page.tsx` — Same

#### AssignExerciseForm (`src/app/teacher/AssignExerciseForm.tsx`)
- Toggle between "Assign Exercise" and "Assign Course" modes
- Course mode: dropdown of courses + classroom + optional due date
- Calls `assignCourse` server action

#### Student Dashboard (`src/app/student/page.tsx`)
- Assignments grouped by course with collapsible sections
- Progress indicator per course (e.g., "2/3 completed")
- Standalone assignments shown separately
- Uses `FolderOpen` icon for course headers

### Files Modified
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added Course, CourseAssignment models; updated Exercise, Assignment, Classroom |
| `src/app/actions.ts` | Added course CRUD, deleteExercise, assignCourse; updated createWorksheet |
| `src/lib/exercises.ts` | Updated syncExercisesToDb to preserve courseId/order |
| `src/app/teacher/page.tsx` | Redesigned with courses + standalone worksheets + delete buttons |
| `src/app/teacher/create/page.tsx` | Fetches courses, passes to WorksheetCreator |
| `src/app/teacher/edit/[exerciseId]/page.tsx` | Fetches courses, passes to WorksheetCreator |
| `src/app/teacher/create/WorksheetCreator.tsx` | Added courses prop, course selector dropdown |
| `src/app/teacher/AssignExerciseForm.tsx` | Added course assignment mode |
| `src/app/assignments/[id]/AssignmentPlayer.tsx` | Fixed worksheet preview bug |
| `src/app/student/page.tsx` | Grouped assignments by course with progress |

### Files Created
| File | Purpose |
|------|---------|
| `src/app/teacher/DeleteExerciseButton.tsx` | Delete exercise confirmation dialog |
| `src/app/teacher/DeleteCourseButton.tsx` | Delete course confirmation dialog |
| `src/app/teacher/CreateCourseForm.tsx` | Inline course creation form |
| `src/app/teacher/courses/[courseId]/page.tsx` | Course detail server page |
| `src/app/teacher/courses/[courseId]/CourseDetailClient.tsx` | Course management client component |

### Files Deleted (orphaned exercise folders)
| Path | Reason |
|------|--------|
| `content/exercises/u1-alphabet-01/` | No index.json/index.md, only assets |
| `content/exercises/u1-spelling-01/` | No index.json/index.md, only assets |