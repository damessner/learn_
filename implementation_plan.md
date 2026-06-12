# Implementation Plan: Course/Folder System for Worksheets

## Overview

Add a **Course** concept so teachers can organize worksheets into folders (courses/units). Worksheets can be standalone or belong to a course. Teachers can assign an entire course at once. Students see courses as units with progress tracking.

---

## 1. Database Schema Changes

**File:** `prisma/schema.prisma`

Add a `Course` model and link exercises to courses:

```prisma
model Course {
  id          String     @id @default(uuid())
  title       String
  description String     @default("")
  order       Int        @default(0)       // for sorting on dashboard
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  // Relations
  exercises   Exercise[]
  assignments CourseAssignment[]
}

model Exercise {
  id          String    @id
  title       String
  description String
  type        String
  courseId    String?
  order       Int       @default(0)       // position within course
  updatedAt   DateTime  @default(now())

  // Relations
  course      Course?      @relation(fields: [courseId], references: [id], onDelete: SetNull)
  assignments Assignment[]
}

model CourseAssignment {
  id          String   @id @default(uuid())
  classroomId String
  courseId    String
  dueDate     DateTime?
  createdAt   DateTime @default(now())

  // Relations
  classroom   Classroom @relation(fields: [classroomId], references: [id], onDelete: Cascade)
  course      Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  assignments Assignment[]  // the individual exercise assignments created for this course
}
```

Update `Assignment` to optionally link back to a `CourseAssignment`:

```prisma
model Assignment {
  id                String            @id @default(uuid())
  classroomId      String
  exerciseId       String
  dueDate           DateTime?
  createdAt         DateTime          @default(now())
  courseAssignmentId String?         // null = standalone, set = part of course assignment

  // Relations
  classroom         Classroom         @relation(fields: [classroomId], references: [id], onDelete: Cascade)
  exercise          Exercise          @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  submissions      Submission[]
  courseAssignment  CourseAssignment? @relation(fields: [courseAssignmentId], references: [id], onDelete: SetNull)
}
```

Update `Classroom` to include `CourseAssignment`:

```prisma
model Classroom {
  // ... existing fields ...
  courseAssignments CourseAssignment[]
}
```

---

## 2. Server Actions

**File:** `src/app/actions.ts`

Add these new actions:

| Action | Purpose |
|--------|---------|
| `createCourse(title, description)` | Create a new course |
| `updateCourse(id, title, description)` | Edit course metadata |
| `deleteCourse(id)` | Delete course (sets exercises' courseId to null, removes from DB) |
| `addExerciseToCourse(exerciseId, courseId)` | Add a worksheet to a course |
| `removeExerciseFromCourse(exerciseId)` | Remove a worksheet from its course (sets courseId to null) |
| `reorderCourseExercises(courseId, exerciseIds[])` | Set order of worksheets within a course |
| `assignCourse(classroomId, courseId, dueDate?)` | Assign all course exercises to a classroom (creates CourseAssignment + individual Assignments) |
| `deleteExercise(exerciseId)` | Delete an exercise: removes its folder from `content/exercises/`, deletes from DB, cascades to assignments/submissions |

Update `createWorksheet` to accept an optional `courseId` parameter.

### Delete Exercise (`deleteExercise`)

- Deletes the exercise folder from `content/exercises/{exerciseId}/` via `fs.rmSync`
- Deletes the exercise row from DB (Prisma cascade handles related Assignments → Submissions)
- Revalidates `/teacher` path
- Returns `{ success: true }` or `{ error: string }`

### Delete Course (`deleteCourse`)

- Sets `courseId` to `null` on all exercises that belong to the course (they become standalone)
- Deletes the course row from DB
- Does **not** delete the exercises themselves — they just become ungrouped
- Revalidates `/teacher` path

---

## 3. Exercise Sync Update

**File:** `src/lib/exercises.ts`

- Update `syncExercisesToDb()` to preserve `courseId` and `order` fields during upsert (don't overwrite them from disk — they're DB-managed)
- The `courseId` and `order` fields are **not** stored in the filesystem `index.json` — they're purely DB metadata

---

## 4. Teacher Dashboard Redesign

**File:** `src/app/teacher/page.tsx`

Restructure the "Created Exercises" section:

- **Courses** shown as expandable folder cards, each listing its worksheets
- **Standalone worksheets** shown in a separate flat list
- Each course card has: title, description, worksheet count, Edit/Delete/Assign buttons
- Each worksheet row (inside a course or standalone) has: Preview, Edit, **Delete** buttons
- Each course card has a **Delete** button (with confirmation)
- Add a "+ Create Course" button next to "+ Create Worksheet"

New components:
- `CourseCard` — expandable card showing course info + its worksheets
- `DeleteExerciseButton` — client component: confirmation dialog → calls `deleteExercise`
- `DeleteCourseButton` — client component: confirmation dialog → calls `deleteCourse`

---

## 5. Course Management Pages

New files:

| File | Purpose |
|------|---------|
| `src/app/teacher/courses/page.tsx` | Course list + create form (or inline on dashboard) |
| `src/app/teacher/courses/[courseId]/page.tsx` | Course detail: reorder worksheets, add/remove worksheets, edit course info |

---

## 6. WorksheetCreator Update

**File:** `src/app/teacher/create/WorksheetCreator.tsx`

Add a **Course** dropdown (optional) when creating a new worksheet:
- Fetches courses from DB
- If a course is selected, the worksheet is added to that course
- If no course selected, worksheet is standalone

---

## 7. Assign Exercise Form Update

**File:** `src/app/teacher/page.tsx` (or extracted component)

Update `AssignExerciseForm` to support:
- Assign individual worksheet (existing behavior)
- Assign entire course (new: creates CourseAssignment + N Assignments)

---

## 8. Student Dashboard Update

**File:** `src/app/student/page.tsx`

Group assignments by course:
- **Course assignments** shown as expandable units with progress (e.g., "2/3 completed")
- Each course shows its worksheets as steps
- **Standalone assignments** shown as before
- Progress indicator: completed count / total count per course

---

## 9. Files to Create/Modify Summary

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add Course, CourseAssignment models; update Exercise, Assignment, Classroom |
| `src/app/actions.ts` | Add course CRUD actions, deleteExercise, assignCourse, update createWorksheet |
| `src/lib/exercises.ts` | Update syncExercisesToDb to preserve courseId/order |
| `src/app/teacher/page.tsx` | Redesign: courses as folders, standalone worksheets separate, delete buttons |
| `src/app/teacher/create/WorksheetCreator.tsx` | Add course selector dropdown |
| `src/app/teacher/courses/[courseId]/page.tsx` | New: course detail/management page |
| `src/app/teacher/DeleteExerciseButton.tsx` | New: client component for delete confirmation |
| `src/app/teacher/DeleteCourseButton.tsx` | New: client component for delete confirmation |
| `src/app/student/page.tsx` | Group assignments by course with progress |
| `src/lib/exerciseLabels.ts` | No change needed |

---

## 10. Migration Steps

1. Update `prisma/schema.prisma`
2. Run `npx prisma db push` (or `prisma migrate dev`)
3. Update `prisma/seed.ts` if needed
4. Implement server actions
5. Update sync logic
6. Build teacher UI (dashboard + course management)
7. Build student UI (course-grouped view)
8. Test end-to-end