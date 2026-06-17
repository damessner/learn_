import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { execSync } from "child_process";

// ---------------------------------------------------------------------------
// Schema setup — push the Prisma schema to a test SQLite database once per
// test-suite run. This is hoisted before imports by vitest's module system.
// ---------------------------------------------------------------------------
beforeAll(() => {
  execSync("npx prisma db push --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    cwd: process.cwd(),
  });
}, 30000);

// ---------------------------------------------------------------------------
// Mock the session module so we can control who is "logged in" per test.
// vi.mock() is hoisted to top of file by vitest, so it runs before modules
// are loaded — meaning @/lib/actions/auth-helpers will see the mock too.
// ---------------------------------------------------------------------------
vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

import {
  getConversationDetail,
  adminGetConversationsAction,
  teacherGetConversationsAction,
} from "@/lib/actions/aloys";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function createUser(username: string, role: string) {
  const passwordHash = await bcrypt.hash("password", 10);
  return prisma.user.create({
    data: { username, passwordHash, role },
  });
}

async function createConversation(studentId: string, title: string) {
  return prisma.aloysConversation.create({
    data: { studentId, title },
  });
}

async function cleanDatabase() {
  await prisma.aloysMessage.deleteMany();
  await prisma.aloysConversation.deleteMany();
  await prisma.classroomStudent.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.user.deleteMany();
}

function setSession(
  overrides: Partial<{ userId: string; username: string; role: "ADMIN" | "TEACHER" | "STUDENT" }>
) {
  vi.mocked(getSession).mockResolvedValue({
    userId: overrides.userId ?? "mock-user-id",
    username: overrides.username ?? "mock-user",
    role: overrides.role ?? "STUDENT",
  });
}

// =========================================================================
// getConversationDetail — IDOR protection
// =========================================================================

describe("getConversationDetail", () => {
  let studentA: Awaited<ReturnType<typeof createUser>>;
  let studentB: Awaited<ReturnType<typeof createUser>>;
  let teacher: Awaited<ReturnType<typeof createUser>>;
  let admin: Awaited<ReturnType<typeof createUser>>;
  let convoA: Awaited<ReturnType<typeof createConversation>>;
  let convoB: Awaited<ReturnType<typeof createConversation>>;

  beforeEach(async () => {
    studentA = await createUser("studenta_test", "STUDENT");
    studentB = await createUser("studentb_test", "STUDENT");
    teacher = await createUser("teacher_test", "TEACHER");
    admin = await createUser("admin_test", "ADMIN");

    convoA = await createConversation(studentA.id, "Conversation of A");
    convoB = await createConversation(studentB.id, "Conversation of B");
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await cleanDatabase();
  });

  // -----------------------------------------------------------------------
  // Test 1a: student can read own conversation
  // -----------------------------------------------------------------------
  it("student A can read their own conversation", async () => {
    setSession({ userId: studentA.id, username: "studenta_test", role: "STUDENT" });

    const result = await getConversationDetail(convoA.id);

    expect(result.id).toBe(convoA.id);
    expect(result.studentId).toBe(studentA.id);
  });

  // -----------------------------------------------------------------------
  // Test 1b: student CANNOT read another student's conversation (IDOR)
  // -----------------------------------------------------------------------
  it("student A CANNOT read student B's conversation (throws)", async () => {
    setSession({ userId: studentA.id, username: "studenta_test", role: "STUDENT" });

    await expect(getConversationDetail(convoB.id)).rejects.toThrow(
      "Unauthorized access to conversation"
    );
  });

  // -----------------------------------------------------------------------
  // Test 2: teacher CAN read any student's conversation
  // -----------------------------------------------------------------------
  it("teacher CAN read student A's conversation", async () => {
    setSession({ userId: teacher.id, username: "teacher_test", role: "TEACHER" });

    const result = await getConversationDetail(convoA.id);

    expect(result.id).toBe(convoA.id);
    expect(result.studentId).toBe(studentA.id);
  });

  // -----------------------------------------------------------------------
  // Test 3: admin CAN read any student's conversation
  // -----------------------------------------------------------------------
  it("admin CAN read student A's conversation", async () => {
    setSession({ userId: admin.id, username: "admin_test", role: "ADMIN" });

    const result = await getConversationDetail(convoA.id);

    expect(result.id).toBe(convoA.id);
    expect(result.studentId).toBe(studentA.id);
  });
});

// =========================================================================
// adminGetConversationsAction — classroom-based filtering
// =========================================================================

describe("adminGetConversationsAction", () => {
  let admin: Awaited<ReturnType<typeof createUser>>;
  let teacher1: Awaited<ReturnType<typeof createUser>>;
  let studentA: Awaited<ReturnType<typeof createUser>>;
  let studentB: Awaited<ReturnType<typeof createUser>>;
  let classroom1: Awaited<ReturnType<typeof prisma.classroom.create>>;
  let convoA: Awaited<ReturnType<typeof createConversation>>;
  let convoB: Awaited<ReturnType<typeof createConversation>>;

  beforeEach(async () => {
    admin = await createUser("admin_getconv", "ADMIN");
    teacher1 = await createUser("teacher_getconv", "TEACHER");
    studentA = await createUser("studenta_getconv", "STUDENT");
    studentB = await createUser("studentb_getconv", "STUDENT");

    classroom1 = await prisma.classroom.create({
      data: {
        name: "Test Classroom",
        joinCode: "TESTCLS",
        teacherId: teacher1.id,
      },
    });

    // studentA is in classroom1, studentB is NOT
    await prisma.classroomStudent.create({
      data: {
        classroomId: classroom1.id,
        studentId: studentA.id,
      },
    });

    convoA = await createConversation(studentA.id, "Convo A - in classroom");
    convoB = await createConversation(studentB.id, "Convo B - NOT in classroom");
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await cleanDatabase();
  });

  // -----------------------------------------------------------------------
  // Test 4: adminGetConversationsAction filters by classroom
  // -----------------------------------------------------------------------
  it("returns only conversations for students in the given classroom (classroomId filter)", async () => {
    setSession({ userId: admin.id, username: "admin_getconv", role: "ADMIN" });

    const results = await adminGetConversationsAction(undefined, classroom1.id);

    const ids = results.map((r: { id: string }) => r.id);
    expect(ids).toContain(convoA.id);
    expect(ids).not.toContain(convoB.id);
  });
});

// =========================================================================
// teacherGetConversationsAction — teacher only sees their own students
// =========================================================================

describe("teacherGetConversationsAction", () => {
  let teacher1: Awaited<ReturnType<typeof createUser>>;
  let teacher2: Awaited<ReturnType<typeof createUser>>;
  let studentInClass: Awaited<ReturnType<typeof createUser>>;
  let studentNotInClass: Awaited<ReturnType<typeof createUser>>;
  let convoIn: Awaited<ReturnType<typeof createConversation>>;
  let convoOut: Awaited<ReturnType<typeof createConversation>>;

  beforeEach(async () => {
    teacher1 = await createUser("teach1_tgca", "TEACHER");
    teacher2 = await createUser("teach2_tgca", "TEACHER");
    studentInClass = await createUser("student_in_tgca", "STUDENT");
    studentNotInClass = await createUser("student_out_tgca", "STUDENT");

    // teacher1 owns classroom1 with studentInClass
    const classroom = await prisma.classroom.create({
      data: {
        name: "Teacher1 Class",
        joinCode: "T1CLASS",
        teacherId: teacher1.id,
      },
    });

    await prisma.classroomStudent.create({
      data: {
        classroomId: classroom.id,
        studentId: studentInClass.id,
      },
    });

    // teacher2 owns classroom2 with studentNotInClass
    const classroom2 = await prisma.classroom.create({
      data: {
        name: "Teacher2 Class",
        joinCode: "T2CLASS",
        teacherId: teacher2.id,
      },
    });

    await prisma.classroomStudent.create({
      data: {
        classroomId: classroom2.id,
        studentId: studentNotInClass.id,
      },
    });

    convoIn = await createConversation(studentInClass.id, "Student in class");
    convoOut = await createConversation(studentNotInClass.id, "Student NOT in class");
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await cleanDatabase();
  });

  // -----------------------------------------------------------------------
  // Test 5: teacher only sees their own students' conversations
  // -----------------------------------------------------------------------
  it("teacher only sees conversations of students in their own classrooms", async () => {
    setSession({ userId: teacher1.id, username: "teach1_tgca", role: "TEACHER" });

    const results = await teacherGetConversationsAction();

    const ids = results.map((r: { id: string }) => r.id);
    expect(ids).toContain(convoIn.id);
    expect(ids).not.toContain(convoOut.id);
  });

  // -----------------------------------------------------------------------
  // Test 6: admin sees all students' conversations via teacherGetConversationsAction
  // -----------------------------------------------------------------------
  it("admin sees conversations of ALL students when calling teacherGetConversationsAction", async () => {
    setSession({ userId: (await createUser("admin_tgca", "ADMIN")).id, username: "admin_tgca", role: "ADMIN" });

    const results = await teacherGetConversationsAction();

    const ids = results.map((r: { id: string }) => r.id);
    expect(ids).toContain(convoIn.id);
    expect(ids).toContain(convoOut.id);
  });
});
