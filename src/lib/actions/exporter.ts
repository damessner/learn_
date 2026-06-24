import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { execSync } from "child_process";
import { unzipSync, strFromU8 } from "fflate";
import { prisma } from "@/lib/db";
import { syncExercisesToDb } from "@/lib/exercises";
import bcrypt from "bcryptjs";
import { generateJoinCode } from "./auth-helpers";

const EXERCISES_DIR = path.join(process.cwd(), "content", "exercises");
const MAX_CLASSROOM_IMPORT_BYTES = 1 * 1024 * 1024;
const MAX_EXERCISE_IMPORT_ARCHIVE_BYTES = 10 * 1024 * 1024;
const MAX_COURSE_IMPORT_ARCHIVE_BYTES = 50 * 1024 * 1024;

const EXERCISE_IMPORT_LIMITS = {
  maxArchiveBytes: MAX_EXERCISE_IMPORT_ARCHIVE_BYTES,
  maxEntries: 200,
  maxEntryBytes: 5 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxCompressionRatio: 100,
};

const COURSE_IMPORT_LIMITS = {
  maxArchiveBytes: MAX_COURSE_IMPORT_ARCHIVE_BYTES,
  maxEntries: 400,
  maxEntryBytes: 10 * 1024 * 1024,
  maxTotalBytes: 80 * 1024 * 1024,
  maxCompressionRatio: 120,
};

type ZipExtractionLimits = typeof EXERCISE_IMPORT_LIMITS;

function normalizeArchiveEntryPath(entryName: string): string {
  const normalized = path.posix.normalize(entryName.replace(/\\/g, "/").replace(/^(\.\/)+/, ""));
  if (
    !normalized ||
    normalized === "." ||
    normalized.includes("\0") ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error("Archive contains unsafe file paths");
  }
  return normalized;
}

function extractZipEntries(zipBuffer: Buffer, limits: ZipExtractionLimits): Record<string, Buffer> {
  if (zipBuffer.length > limits.maxArchiveBytes) {
    throw new Error("Archive exceeds the maximum allowed upload size");
  }

  let entryCount = 0;
  let totalUncompressedBytes = 0;

  const extracted = unzipSync(new Uint8Array(zipBuffer), {
    filter(file) {
      const normalized = normalizeArchiveEntryPath(file.name);
      if (normalized.endsWith("/")) {
        return false;
      }

      entryCount++;
      if (entryCount > limits.maxEntries) {
        throw new Error("Archive contains too many files");
      }
      if (file.originalSize > limits.maxEntryBytes) {
        throw new Error("Archive contains files that are too large");
      }
      if (file.size === 0 && file.originalSize > 0) {
        throw new Error("Archive contains suspicious compressed entries");
      }
      if (file.size > 0 && file.originalSize / file.size > limits.maxCompressionRatio) {
        throw new Error("Archive failed compression safety checks");
      }

      totalUncompressedBytes += file.originalSize;
      if (totalUncompressedBytes > limits.maxTotalBytes) {
        throw new Error("Archive expands beyond the allowed size");
      }

      return true;
    },
  });

  return Object.fromEntries(
    Object.entries(extracted).map(([entryName, contents]) => [
      normalizeArchiveEntryPath(entryName),
      Buffer.from(contents),
    ])
  );
}

function writeArchiveEntries(targetDir: string, entries: Record<string, Buffer>) {
  const resolvedTargetDir = path.resolve(targetDir);

  for (const [relativePath, contents] of Object.entries(entries)) {
    const destinationPath = path.resolve(resolvedTargetDir, relativePath);
    if (
      destinationPath !== resolvedTargetDir &&
      !destinationPath.startsWith(`${resolvedTargetDir}${path.sep}`)
    ) {
      throw new Error("Archive extraction attempted to escape target directory");
    }

    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.writeFileSync(destinationPath, contents);
  }
}

function readRootTextEntry(entries: Record<string, Buffer>, fileName: string): string | null {
  const contents = entries[fileName];
  return contents ? strFromU8(new Uint8Array(contents)) : null;
}

function generateTemporaryPassword(): string {
  return crypto.randomBytes(18).toString("base64url").slice(0, 18);
}

/**
 * Generates a unique exercise ID by checking if it exists in the filesystem or database
 */
async function generateUniqueExerciseId(baseId: string): Promise<string> {
  let uniqueId = baseId;
  let counter = 1;

  const checkExists = async (id: string) => {
    const dirExists = fs.existsSync(path.join(EXERCISES_DIR, id));
    if (dirExists) return true;
    const dbExists = await prisma.exercise.findUnique({
      where: { id },
      select: { id: true },
    });
    return !!dbExists;
  };

  while (await checkExists(uniqueId)) {
    uniqueId = `${baseId}-${counter}`;
    counter++;
  }
  return uniqueId;
}

/**
 * Modifies the ID inside index.json or index.md of the exercise folder
 */
function updateExerciseIdInFolder(exerciseDir: string, newId: string) {
  const jsonPath = path.join(exerciseDir, "index.json");
  const mdPath = path.join(exerciseDir, "index.md");

  if (fs.existsSync(jsonPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      config.id = newId;
      fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to update ID in index.json:", e);
    }
  } else if (fs.existsSync(mdPath)) {
    try {
      let content = fs.readFileSync(mdPath, "utf-8");
      const fmMatch = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
      if (fmMatch) {
        const beforeFm = content.slice(0, fmMatch.index! + fmMatch[1].length);
        const fmBlock = fmMatch[2];
        const afterFm = content.slice(fmMatch.index! + fmMatch[0].length);
        const updatedFm = fmBlock.replace(/^id:\s*.*$/m, `id: ${newId}`);
        content = beforeFm + updatedFm + fmMatch[3] + afterFm;
      } else {
        content = content.replace(/^id:\s*.*$/m, `id: ${newId}`);
      }
      fs.writeFileSync(mdPath, content, "utf-8");
    } catch (e) {
      console.error("Failed to update ID in index.md:", e);
    }
  }
}

/**
 * Exports a worksheet to a ZIP archive buffer
 */
export async function exportWorksheetZip(exerciseId: string): Promise<Buffer> {
  const exerciseDir = path.join(EXERCISES_DIR, exerciseId);
  if (!fs.existsSync(exerciseDir)) {
    throw new Error(`Exercise ${exerciseId} not found on disk`);
  }

  const tempZipPath = path.join(os.tmpdir(), `exercise-${exerciseId}-${Date.now()}.zip`);
  try {
    execSync(`zip -r "${tempZipPath}" .`, { cwd: exerciseDir, stdio: "ignore" });
    return fs.readFileSync(tempZipPath);
  } finally {
    if (fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }
  }
}

/**
 * Imports a worksheet from a ZIP archive buffer
 */
export async function importWorksheetZip(zipBuffer: Buffer, teacherId: string): Promise<string> {
  const entries = extractZipEntries(zipBuffer, EXERCISE_IMPORT_LIMITS);
  const jsonText = readRootTextEntry(entries, "index.json");
  const mdText = readRootTextEntry(entries, "index.md");

  let originalId = "";
  if (jsonText) {
    const config = JSON.parse(jsonText);
    originalId = config.id;
  } else if (mdText) {
    const fmMatch = mdText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
      const fmBlock = fmMatch[1];
      const idLine = fmBlock.split("\n").find((line) => line.trim().startsWith("id:"));
      if (idLine) {
        originalId = idLine.split(":")[1].trim().replace(/^['"]|['"]$/g, "");
      }
    }
  } else {
    throw new Error("Archive must contain index.json or index.md at the root");
  }

  if (!originalId || !/^[a-z0-9-]+$/.test(originalId)) {
    throw new Error("Invalid or missing exercise ID in ZIP config files");
  }

  const uniqueId = await generateUniqueExerciseId(originalId);
  const targetDir = path.join(EXERCISES_DIR, uniqueId);
  fs.mkdirSync(targetDir, { recursive: true });

  writeArchiveEntries(targetDir, entries);
  updateExerciseIdInFolder(targetDir, uniqueId);

  await syncExercisesToDb();
  await prisma.exercise.update({
    where: { id: uniqueId },
    data: { creatorId: teacherId },
  });

  return uniqueId;
}

/**
 * Exports classroom details to a JSON format
 */
export async function exportClassroomJson(classroomId: string): Promise<string> {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    include: {
      students: {
        include: {
          student: true,
        },
      },
    },
  });

  if (!classroom) {
    throw new Error("Classroom not found");
  }

  const exportData = {
    name: classroom.name,
    students: classroom.students.map((cs) => ({
      username: cs.student.username,
      microsoftEmail: cs.student.microsoftEmail,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Imports a classroom from JSON
 */
export async function importClassroomJson(jsonContent: string, teacherId: string): Promise<string> {
  if (Buffer.byteLength(jsonContent, "utf8") > MAX_CLASSROOM_IMPORT_BYTES) {
    throw new Error("Classroom import file is too large");
  }

  const data = JSON.parse(jsonContent) as {
    name?: unknown;
    students?: Array<{ username?: unknown; microsoftEmail?: unknown }>;
  };
  if (!data.name || typeof data.name !== "string" || data.name.trim() === "") {
    throw new Error("Invalid classroom name");
  }

  let joinCode = generateJoinCode();
  let exists = await prisma.classroom.findUnique({ where: { joinCode } });
  while (exists) {
    joinCode = generateJoinCode();
    exists = await prisma.classroom.findUnique({ where: { joinCode } });
  }

  const classroom = await prisma.classroom.create({
    data: {
      name: data.name.trim(),
      joinCode,
      teacherId,
    },
  });

  const students = Array.isArray(data.students) ? data.students : [];
  for (const stud of students) {
    const rawUsername = stud.username;
    if (!rawUsername || typeof rawUsername !== "string") continue;
    const username = rawUsername.trim().toLowerCase();
    const normalizedMicrosoftEmail =
      typeof stud.microsoftEmail === "string" && stud.microsoftEmail.trim()
        ? stud.microsoftEmail.trim().toLowerCase()
        : null;

    let studentUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          normalizedMicrosoftEmail ? { microsoftEmail: normalizedMicrosoftEmail } : {},
        ].filter((condition) => Object.keys(condition).length > 0),
      },
    });

    if (!studentUser) {
      const randomPass = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(randomPass, 10);
      studentUser = await prisma.user.create({
        data: {
          username,
          passwordHash,
          role: "STUDENT",
          active: true,
          microsoftEmail: normalizedMicrosoftEmail,
        },
      });
    }

    await prisma.classroomStudent.upsert({
      where: {
        classroomId_studentId: {
          classroomId: classroom.id,
          studentId: studentUser.id,
        },
      },
      update: {},
      create: {
        classroomId: classroom.id,
        studentId: studentUser.id,
      },
    });
  }

  return classroom.id;
}

/**
 * Exports a course and all its exercises to a ZIP bundle
 */
export async function exportCourseZip(courseId: string): Promise<Buffer> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      exercises: {
        where: { pendingDeletion: false },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "course-export-"));
  const exercisesSubdir = path.join(tempDir, "exercises");
  fs.mkdirSync(exercisesSubdir, { recursive: true });

  try {
    for (const ex of course.exercises) {
      const exZipBuffer = await exportWorksheetZip(ex.id);
      fs.writeFileSync(path.join(exercisesSubdir, `${ex.id}.zip`), exZipBuffer);
    }

    const courseMeta = {
      title: course.title,
      description: course.description,
      exercises: course.exercises.map((ex) => ({
        id: ex.id,
        order: ex.order,
      })),
    };
    fs.writeFileSync(path.join(tempDir, "course.json"), JSON.stringify(courseMeta, null, 2));

    const tempZipPath = path.join(os.tmpdir(), `course-${courseId}-${Date.now()}.zip`);
    try {
      execSync(`zip -r "${tempZipPath}" .`, { cwd: tempDir, stdio: "ignore" });
      return fs.readFileSync(tempZipPath);
    } finally {
      if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Imports a course and all its nested exercises from a ZIP bundle
 */
export async function importCourseZip(zipBuffer: Buffer, teacherId: string): Promise<string> {
  const entries = extractZipEntries(zipBuffer, COURSE_IMPORT_LIMITS);
  const courseJsonText = readRootTextEntry(entries, "course.json");
  if (!courseJsonText) {
    throw new Error("Missing course.json in ZIP bundle");
  }

  const courseMeta = JSON.parse(courseJsonText) as {
    title?: unknown;
    description?: unknown;
    exercises?: Array<{ id?: unknown; order?: unknown }>;
  };
  if (!courseMeta.title || typeof courseMeta.title !== "string" || courseMeta.title.trim() === "") {
    throw new Error("Invalid course title in course.json");
  }

  const maxOrder = await prisma.course.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (maxOrder?.order ?? -1) + 1;

  const newCourse = await prisma.course.create({
    data: {
      title: courseMeta.title.trim(),
      description: typeof courseMeta.description === "string" ? courseMeta.description : "",
      order: nextOrder,
      creatorId: teacherId,
    },
  });

  const exercisesMeta = Array.isArray(courseMeta.exercises) ? courseMeta.exercises : [];

  for (const exMeta of exercisesMeta) {
    if (typeof exMeta.id !== "string") {
      continue;
    }

    const exZipBuffer = entries[`exercises/${exMeta.id}.zip`];
    if (!exZipBuffer) {
      continue;
    }

    const uniqueExId = await importWorksheetZip(exZipBuffer, teacherId);
    await prisma.exercise.update({
      where: { id: uniqueExId },
      data: {
        courseId: newCourse.id,
        order: typeof exMeta.order === "number" ? exMeta.order : 0,
      },
    });
  }

  return newCourse.id;
}
