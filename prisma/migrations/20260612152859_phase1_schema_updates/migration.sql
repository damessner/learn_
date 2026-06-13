-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CourseAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classroomId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseAssignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classroomId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "courseAssignmentId" TEXT,
    CONSTRAINT "Assignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_courseAssignmentId_fkey" FOREIGN KEY ("courseAssignmentId") REFERENCES "CourseAssignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("classroomId", "createdAt", "dueDate", "exerciseId", "id") SELECT "classroomId", "createdAt", "dueDate", "exerciseId", "id" FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE TABLE "new_Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "courseId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pendingDeletion" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Exercise_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Exercise" ("description", "id", "title", "type", "updatedAt") SELECT "description", "id", "title", "type", "updatedAt" FROM "Exercise";
DROP TABLE "Exercise";
ALTER TABLE "new_Exercise" RENAME TO "Exercise";
CREATE TABLE "new_Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "answersJson" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "effectiveScore" REAL NOT NULL DEFAULT 0,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedback" TEXT,
    "teacherScore" REAL,
    "reviewedAt" DATETIME,
    "draft" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Submission" ("answersJson", "assignmentId", "attemptNumber", "completed", "completedAt", "effectiveScore", "id", "score", "studentId") SELECT "answersJson", "assignmentId", "attemptNumber", "completed", "completedAt", "effectiveScore", "id", "score", "studentId" FROM "Submission";
DROP TABLE "Submission";
ALTER TABLE "new_Submission" RENAME TO "Submission";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
