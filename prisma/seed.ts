import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

// Standard DB adapter for Prisma 7 SQLite
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const EXERCISES_DIR = path.join(process.cwd(), "content", "exercises");

async function main() {
  console.log("🌱 Starting seeding...");

  // 1. Sync Exercises from content/exercises/
  if (!fs.existsSync(EXERCISES_DIR)) {
    console.log("No content/exercises directory found. Skipping exercise sync.");
  } else {
    const folders = fs.readdirSync(EXERCISES_DIR);
    const diskIds: string[] = [];

    for (const folder of folders) {
      const folderPath = path.join(EXERCISES_DIR, folder);
      if (fs.statSync(folderPath).isDirectory()) {
        const jsonPath = path.join(folderPath, "index.json");
        const mdPath = path.join(folderPath, "index.md");
        let title = folder;
        let type = "multiple-choice";
        let description = "";

        if (fs.existsSync(jsonPath)) {
          const raw = fs.readFileSync(jsonPath, "utf-8");
          const parsed = JSON.parse(raw);
          title = parsed.title || folder;
          type = parsed.type || "multiple-choice";
          description = parsed.description || "";
        } else if (fs.existsSync(mdPath)) {
          const raw = fs.readFileSync(mdPath, "utf-8");
          const titleMatch = raw.match(/title:\s*(.*)/);
          const typeMatch = raw.match(/type:\s*(.*)/);
          const descMatch = raw.match(/description:\s*(.*)/);

          if (titleMatch) title = titleMatch[1].trim().replace(/^['"]|['"]$/g, "");
          if (typeMatch) type = typeMatch[1].trim().replace(/^['"]|['"]$/g, "");
          if (descMatch) description = descMatch[1].trim().replace(/^['"]|['"]$/g, "");
        }

        await prisma.exercise.upsert({
          where: { id: folder },
          update: { title, type, description, updatedAt: new Date() },
          create: { id: folder, title, type, description },
        });

        diskIds.push(folder);
        console.log(`Synced exercise: ${folder}`);
      }
    }

    // Delete orphans
    await prisma.exercise.deleteMany({
      where: {
        id: { notIn: diskIds },
      },
    });
  }

  // 2. Seed default Teacher
  const teacherPasswordHash = await bcrypt.hash("password", 10);
  const teacher = await prisma.user.upsert({
    where: { username: "teacher" },
    update: {},
    create: {
      username: "teacher",
      passwordHash: teacherPasswordHash,
      role: "TEACHER",
      active: true,
    },
  });
  console.log("Seeded Teacher user: teacher / password");

  // 2a. Seed default Admins
  const adminPasswordHash = await bcrypt.hash("Aloys2026!", 10);
  await prisma.user.upsert({
    where: { username: "da.messner" },
    update: {},
    create: {
      username: "da.messner",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      active: true,
    },
  });
  console.log("Seeded Admin user: da.messner / Aloys2026!");

  await prisma.user.upsert({
    where: { username: "weissenbach" },
    update: {},
    create: {
      username: "weissenbach",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      active: true,
    },
  });
  console.log("Seeded Admin user: weissenbach / Aloys2026!");

  // 3. Seed default Classroom
  const classroom = await prisma.classroom.upsert({
    where: { joinCode: "CLASS1" },
    update: { name: "Class 1A" },
    create: {
      name: "Class 1A",
      joinCode: "CLASS1",
      teacherId: teacher.id,
    },
  });
  console.log("Seeded Classroom: Class 1A (Code: CLASS1)");

  // 4. Seed default Student
  const studentPasswordHash = await bcrypt.hash("password", 10);
  const student = await prisma.user.upsert({
    where: { username: "student" },
    update: {},
    create: {
      username: "student",
      passwordHash: studentPasswordHash,
      role: "STUDENT",
      active: true,
    },
  });
  console.log("Seeded Student user: student / password");

  // Map student to classroom
  await prisma.classroomStudent.upsert({
    where: {
      classroomId_studentId: {
        classroomId: classroom.id,
        studentId: student.id,
      },
    },
    update: {},
    create: {
      classroomId: classroom.id,
      studentId: student.id,
    },
  });
  console.log("Mapped Student to Classroom");

  // 5. Assign exercises to classroom
  const allExercises = await prisma.exercise.findMany();
  for (const ex of allExercises) {
    // Check if already assigned
    const existingAssignment = await prisma.assignment.findFirst({
      where: {
        classroomId: classroom.id,
        exerciseId: ex.id,
      },
    });

    if (!existingAssignment) {
      await prisma.assignment.create({
        data: {
          classroomId: classroom.id,
          exerciseId: ex.id,
        },
      });
      console.log(`Assigned exercise: ${ex.id} to Class 1A`);
    }
  }

  console.log("🌱 Seeding finished successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    // Adapter doesn't expose disconnect, client will clean up
  });
