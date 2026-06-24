import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { prisma } from "@/lib/db";
import { syncExercisesToDb } from "@/lib/exercises";
import bcrypt from "bcryptjs";
import { generateJoinCode } from "./auth-helpers";

const EXERCISES_DIR = path.join(process.cwd(), "content", "exercises");

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
      select: { id: true }
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
      console.error(`Failed to update ID in index.json:`, e);
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
      console.error(`Failed to update ID in index.md:`, e);
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
    // Run zip -r to compress all files in exerciseDir
    execSync(`zip -r "${tempZipPath}" .`, { cwd: exerciseDir, stdio: "ignore" });
    const buffer = fs.readFileSync(tempZipPath);
    return buffer;
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "exercise-import-"));
  const zipPath = path.join(tempDir, "upload.zip");
  const extractDir = path.join(tempDir, "extracted");
  
  fs.mkdirSync(extractDir, { recursive: true });
  fs.writeFileSync(zipPath, zipBuffer);

  try {
    // Extract zip
    execSync(`unzip "${zipPath}" -d "${extractDir}"`, { stdio: "ignore" });

    // Find index.json or index.md
    const jsonPath = path.join(extractDir, "index.json");
    const mdPath = path.join(extractDir, "index.md");
    
    let originalId = "";
    if (fs.existsSync(jsonPath)) {
      const config = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      originalId = config.id;
    } else if (fs.existsSync(mdPath)) {
      const content = fs.readFileSync(mdPath, "utf-8");
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (fmMatch) {
        const fmBlock = fmMatch[1];
        const idLine = fmBlock.split("\n").find(line => line.trim().startsWith("id:"));
        if (idLine) {
          originalId = idLine.split(":")[1].trim().replace(/^['"]|['"]$/g, "");
        }
      }
    }

    if (!originalId || !/^[a-z0-9-]+$/.test(originalId)) {
      throw new Error("Invalid or missing exercise ID in ZIP config files");
    }

    const uniqueId = await generateUniqueExerciseId(originalId);
    const targetDir = path.join(EXERCISES_DIR, uniqueId);
    fs.mkdirSync(targetDir, { recursive: true });

    // Copy extracted files to target directory
    fs.cpSync(extractDir, targetDir, { recursive: true });

    // Update the ID inside the configuration files
    updateExerciseIdInFolder(targetDir, uniqueId);

    // Sync disk state with database
    await syncExercisesToDb();

    // Link imported exercise to teacher
    await prisma.exercise.update({
      where: { id: uniqueId },
      data: { creatorId: teacherId }
    });

    return uniqueId;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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
          student: true
        }
      }
    }
  });

  if (!classroom) {
    throw new Error("Classroom not found");
  }

  const exportData = {
    name: classroom.name,
    students: classroom.students.map(cs => ({
      username: cs.student.username,
      microsoftEmail: cs.student.microsoftEmail
    }))
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Imports a classroom from JSON
 */
export async function importClassroomJson(jsonContent: string, teacherId: string): Promise<string> {
  const data = JSON.parse(jsonContent);
  if (!data.name || typeof data.name !== "string" || data.name.trim() === "") {
    throw new Error("Invalid classroom name");
  }

  // Generate unique join code
  let joinCode = generateJoinCode();
  let exists = await prisma.classroom.findUnique({ where: { joinCode } });
  while (exists) {
    joinCode = generateJoinCode();
    exists = await prisma.classroom.findUnique({ where: { joinCode } });
  }

  // Create classroom
  const classroom = await prisma.classroom.create({
    data: {
      name: data.name.trim(),
      joinCode,
      teacherId,
    }
  });

  // Create/Enroll students
  const students = data.students || [];
  for (const stud of students) {
    const rawUsername = stud.username;
    if (!rawUsername || typeof rawUsername !== "string") continue;
    const username = rawUsername.trim().toLowerCase();

    // Check if user already exists
    let studentUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          stud.microsoftEmail ? { microsoftEmail: stud.microsoftEmail.trim().toLowerCase() } : {}
        ].filter(cond => Object.keys(cond).length > 0)
      }
    });

    if (!studentUser) {
      // Create new student
      const randomPass = Math.random().toString(36).substring(2, 12);
      const passwordHash = await bcrypt.hash(randomPass, 10);
      studentUser = await prisma.user.create({
        data: {
          username,
          passwordHash,
          role: "STUDENT",
          active: true,
          microsoftEmail: stud.microsoftEmail ? stud.microsoftEmail.trim().toLowerCase() : null
        }
      });
    }

    // Enroll student in classroom
    await prisma.classroomStudent.upsert({
      where: {
        classroomId_studentId: {
          classroomId: classroom.id,
          studentId: studentUser.id
        }
      },
      update: {},
      create: {
        classroomId: classroom.id,
        studentId: studentUser.id
      }
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
        orderBy: { order: "asc" }
      }
    }
  });

  if (!course) {
    throw new Error("Course not found");
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "course-export-"));
  const exercisesSubdir = path.join(tempDir, "exercises");
  fs.mkdirSync(exercisesSubdir, { recursive: true });

  try {
    // 1. Export all exercises as zip files under exercises/ folder
    for (const ex of course.exercises) {
      const exZipBuffer = await exportWorksheetZip(ex.id);
      fs.writeFileSync(path.join(exercisesSubdir, `${ex.id}.zip`), exZipBuffer);
    }

    // 2. Write course.json structure
    const courseMeta = {
      title: course.title,
      description: course.description,
      exercises: course.exercises.map(ex => ({
        id: ex.id,
        order: ex.order
      }))
    };
    fs.writeFileSync(path.join(tempDir, "course.json"), JSON.stringify(courseMeta, null, 2));

    // 3. Zip the course folder
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "course-import-"));
  const zipPath = path.join(tempDir, "upload.zip");
  const extractDir = path.join(tempDir, "extracted");
  
  fs.mkdirSync(extractDir, { recursive: true });
  fs.writeFileSync(zipPath, zipBuffer);

  try {
    // Extract main course zip
    execSync(`unzip "${zipPath}" -d "${extractDir}"`, { stdio: "ignore" });

    const courseJsonPath = path.join(extractDir, "course.json");
    if (!fs.existsSync(courseJsonPath)) {
      throw new Error("Missing course.json in ZIP bundle");
    }

    const courseMeta = JSON.parse(fs.readFileSync(courseJsonPath, "utf-8"));
    if (!courseMeta.title || typeof courseMeta.title !== "string" || courseMeta.title.trim() === "") {
      throw new Error("Invalid course title in course.json");
    }

    // Get current max order of courses
    const maxOrder = await prisma.course.findFirst({
      orderBy: { order: "desc" },
      select: { order: true }
    });
    const nextOrder = (maxOrder?.order ?? -1) + 1;

    // Create Course record
    const newCourse = await prisma.course.create({
      data: {
        title: courseMeta.title.trim(),
        description: courseMeta.description || "",
        order: nextOrder,
        creatorId: teacherId
      }
    });

    const exercisesMeta = courseMeta.exercises || [];
    const exercisesDir = path.join(extractDir, "exercises");

    // Loop through each exercise configuration in course.json
    for (const exMeta of exercisesMeta) {
      const originalExId = exMeta.id;
      const exZipPath = path.join(exercisesDir, `${originalExId}.zip`);
      if (!fs.existsSync(exZipPath)) {
        continue;
      }

      // Read exercise zip buffer
      const exZipBuffer = fs.readFileSync(exZipPath);
      
      // Import the exercise zip (handles name conflicts automatically)
      const uniqueExId = await importWorksheetZip(exZipBuffer, teacherId);

      // Link the imported exercise to our new course and set order
      await prisma.exercise.update({
        where: { id: uniqueExId },
        data: {
          courseId: newCourse.id,
          order: exMeta.order
        }
      });
    }

    return newCourse.id;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
