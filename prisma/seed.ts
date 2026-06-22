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

  // 5. Assign non-4g exercises to classroom 1A
  const allExercises = await prisma.exercise.findMany();
  for (const ex of allExercises) {
    if (ex.id.startsWith("4g-")) continue;
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

  // 6. Seed Showcase Classroom 4G
  const classroom4G = await prisma.classroom.upsert({
    where: { joinCode: "4G" },
    update: { name: "Class 4G" },
    create: {
      name: "Class 4G",
      joinCode: "4G",
      teacherId: teacher.id,
    },
  });
  console.log("Seeded Classroom: Class 4G (Code: 4G)");

  // Map student to Classroom 4G
  await prisma.classroomStudent.upsert({
    where: {
      classroomId_studentId: {
        classroomId: classroom4G.id,
        studentId: student.id,
      },
    },
    update: {},
    create: {
      classroomId: classroom4G.id,
      studentId: student.id,
    },
  });
  console.log("Mapped Student to Classroom 4G");

  // Create Showcase Courses and map 4G exercises
  const coursesData = [
    {
      id: "4g-grammar",
      title: "4G Grammar",
      description: "Showcase Course: Comprehensive English Grammar for 4th Grade NMS (covering tenses, reported speech, conditionals, question tags, adverbs, modals, reflexive pronouns, passive voice, relative clauses, gerunds, and word formation).",
      order: 1,
      exerciseIds: [
        "4g-grammar-past-tenses",
        "4g-grammar-past-perfect",
        "4g-grammar-reported-speech",
        "4g-grammar-reported-commands",
        "4g-grammar-question-tags",
        "4g-grammar-adverbs-of-manner",
        "4g-grammar-future-and-requests",
        "4g-grammar-present-perfect-vs-past-simple",
        "4g-grammar-modals-of-possibility",
        "4g-grammar-conditionals",
        "4g-grammar-reflexive-pronouns",
        "4g-grammar-word-formation",
        "4g-grammar-passive-voice",
        "4g-grammar-gerund-infinitive",
        "4g-grammar-relative-clauses",
        "4g-writing-ireland"
      ],
    },
    {
      id: "4g-vocabulary",
      title: "4G Vocabulary",
      description: "Showcase Course: Core Vocabulary covering Cybercrime, Careers & Professions, and Food (Units 2, 4, 5).",
      order: 2,
      exerciseIds: ["4g-vocab-cybercrime", "4g-vocab-jobs", "4g-vocab-food", "4g-oral-vocab-ireland"],
    },
    {
      id: "4g-readings",
      title: "4G Readings",
      description: "Showcase Course: Branching Interactive Readings covering Cyber Mystery and Miracle on the Hudson (Units 2, 3).",
      order: 3,
      exerciseIds: ["4g-read-locked-room", "4g-read-hudson-miracle", "4g-explore-dublin", "4g-explore-canterville", "4g-explore-airport"],
    },
  ];

  for (const cInfo of coursesData) {
    const course = await prisma.course.upsert({
      where: { id: cInfo.id },
      update: {
        title: cInfo.title,
        description: cInfo.description,
        order: cInfo.order,
      },
      create: {
        id: cInfo.id,
        title: cInfo.title,
        description: cInfo.description,
        order: cInfo.order,
      },
    });

    // Update exercises to link to this course and set their order
    for (let i = 0; i < cInfo.exerciseIds.length; i++) {
      const exId = cInfo.exerciseIds[i];
      // Check if exercise exists before updating (to avoid crash if not loaded yet)
      const exExists = await prisma.exercise.findUnique({ where: { id: exId } });
      if (exExists) {
        await prisma.exercise.update({
          where: { id: exId },
          data: { courseId: course.id, order: i },
        });
      }
    }

    // Assign course to classroom 4G
    let courseAssignment = await prisma.courseAssignment.findFirst({
      where: { classroomId: classroom4G.id, courseId: course.id },
    });

    if (!courseAssignment) {
      courseAssignment = await prisma.courseAssignment.create({
        data: {
          classroomId: classroom4G.id,
          courseId: course.id,
        },
      });
      console.log(`Assigned course: ${course.title} to Class 4G`);
    }

    // Create Assignments for each exercise in this course linked to the CourseAssignment
    for (const exId of cInfo.exerciseIds) {
      const exExists = await prisma.exercise.findUnique({ where: { id: exId } });
      if (!exExists) continue;

      const existingAssignment = await prisma.assignment.findFirst({
        where: {
          classroomId: classroom4G.id,
          exerciseId: exId,
        },
      });

      if (!existingAssignment) {
        await prisma.assignment.create({
          data: {
            classroomId: classroom4G.id,
            exerciseId: exId,
            courseAssignmentId: courseAssignment.id,
          },
        });
        console.log(`Assigned exercise ${exId} under course ${course.title}`);
      } else if (!existingAssignment.courseAssignmentId) {
        await prisma.assignment.update({
          where: { id: existingAssignment.id },
          data: { courseAssignmentId: courseAssignment.id },
        });
      }
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
