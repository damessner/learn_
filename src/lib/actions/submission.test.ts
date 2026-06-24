process.env.DATABASE_URL = "file:./test_submission.db";

import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { execSync } from "child_process";

beforeAll(() => {
  execSync("npx prisma db push --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: "file:./test_submission.db" },
    cwd: process.cwd(),
  });
}, 30000);

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/microsoftGraph", () => ({
  submitGradeToTeams: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { submitGradeToTeams } from "@/lib/microsoftGraph";
import { retryTeamsGradeSync } from "@/lib/actions/submission";
import bcrypt from "bcryptjs";

async function cleanDatabase() {
  await prisma.submission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.classroomStudent.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.user.deleteMany();
}

function setSession(userId: string, role: "TEACHER" | "STUDENT" | "ADMIN") {
  vi.mocked(getSession).mockResolvedValue({
    userId,
    username: "test_user",
    role,
  });
}

describe("retryTeamsGradeSync", () => {
  let teacher: any;
  let otherTeacher: any;
  let student: any;
  let classroom: any;
  let assignment: any;
  let submission: any;

  beforeEach(async () => {
    await cleanDatabase();

    const passwordHash = await bcrypt.hash("password", 10);
    
    teacher = await prisma.user.create({
      data: { username: "teacher", passwordHash, role: "TEACHER" }
    });
    otherTeacher = await prisma.user.create({
      data: { username: "other", passwordHash, role: "TEACHER" }
    });
    student = await prisma.user.create({
      data: { 
        username: "student", 
        passwordHash, 
        role: "STUDENT",
        microsoftId: "student-ms-id",
        microsoftEmail: "student@school.edu"
      }
    });

    classroom = await prisma.classroom.create({
      data: { 
        name: "Test Class", 
        teacherId: teacher.id,
        msGraphClassId: "team-id",
        joinCode: "TESTGP"
      }
    });

    // Create required exercises due to foreign key constraints
    await prisma.exercise.create({
      data: {
        id: "exercise-1",
        title: "Exercise 1",
        description: "Description 1",
        type: "worksheet"
      }
    });

    await prisma.exercise.create({
      data: {
        id: "exercise-2",
        title: "Exercise 2",
        description: "Description 2",
        type: "worksheet"
      }
    });

    assignment = await prisma.assignment.create({
      data: {
        classroomId: classroom.id,
        exerciseId: "exercise-1",
        msGraphAssignmentId: "assignment-ms-id"
      }
    });

    submission = await prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        studentId: student.id,
        answersJson: "{}",
        score: 90,
        effectiveScore: 90,
        attemptNumber: 1
      }
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await cleanDatabase();
  });

  it("should throw an error if user is not logged in", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(retryTeamsGradeSync(submission.id)).rejects.toThrow("Authentication required");
  });

  it("should return access denied if calling teacher does not own the classroom", async () => {
    setSession(otherTeacher.id, "TEACHER");
    const result = await retryTeamsGradeSync(submission.id);
    expect(result).toEqual({ error: "Access denied" });
  });

  it("should return an error if the assignment is not linked to Microsoft Teams", async () => {
    setSession(teacher.id, "TEACHER");
    
    // Create an unlinked assignment/submission
    const unlinkedAssignment = await prisma.assignment.create({
      data: {
        classroomId: classroom.id,
        exerciseId: "exercise-2"
      }
    });
    const unlinkedSub = await prisma.submission.create({
      data: {
        assignmentId: unlinkedAssignment.id,
        studentId: student.id,
        answersJson: "{}",
        score: 80,
        effectiveScore: 80
      }
    });

    const result = await retryTeamsGradeSync(unlinkedSub.id);
    expect(result.error).toContain("not linked to Microsoft Teams");
  });

  it("should return success and set teamsSyncStatus to SUCCESS on success", async () => {
    setSession(teacher.id, "TEACHER");
    vi.mocked(submitGradeToTeams).mockResolvedValue();

    const result = await retryTeamsGradeSync(submission.id);
    expect(result).toEqual({ success: true });
    expect(submitGradeToTeams).toHaveBeenCalledWith(
      teacher.id,
      "team-id",
      "assignment-ms-id",
      "student-ms-id",
      90,
      100
    );

    const updatedSub = await prisma.submission.findUnique({ where: { id: submission.id } });
    expect(updatedSub?.teamsSyncStatus).toBe("SUCCESS");
    expect(updatedSub?.teamsSyncError).toBeNull();
  });

  it("should set teamsSyncStatus to FAILED and store the error message if submitGradeToTeams throws", async () => {
    setSession(teacher.id, "TEACHER");
    vi.mocked(submitGradeToTeams).mockRejectedValue(new Error("API Timeout"));

    const result = await retryTeamsGradeSync(submission.id);
    expect(result.error).toContain("Teams Sync failed: API Timeout");

    const updatedSub = await prisma.submission.findUnique({ where: { id: submission.id } });
    expect(updatedSub?.teamsSyncStatus).toBe("FAILED");
    expect(updatedSub?.teamsSyncError).toBe("API Timeout");
  });
});
