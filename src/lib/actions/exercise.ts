"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { syncExercisesToDb } from "@/lib/exercises";
import fs from "fs";
import path from "path";
import { requireTeacher } from "./auth-helpers";

export async function triggerManualSync() {
  await requireTeacher();
  try {
    const result = await syncExercisesToDb();
    revalidatePath("/teacher");
    return { success: true, ...result };
  } catch (error) {
    console.error("Sync exercises error:", error);
    return { error: "Failed to synchronize exercises" };
  }
}

export async function createWorksheet(
  id: string,
  type: string,
  title: string,
  description: string,
  content: string,
  isUpdate: boolean = false,
  courseId?: string | null,
  tags?: string
) {
  await requireTeacher();

  // Validate ID: kebab-case
  const idRegex = /^[a-z0-9-]+$/;
  if (!id || !idRegex.test(id)) {
    return { error: "ID must contain only lowercase letters, numbers, and hyphens (e.g. history-quiz-1)" };
  }
  if (id.length > 128) {
    return { error: "ID must be 128 characters or fewer" };
  }
  if (!title || title.trim().length === 0) {
    return { error: "Title is required" };
  }
  if (title.trim().length > 200) {
    return { error: "Title must be 200 characters or fewer" };
  }
  if (description && description.length > 2000) {
    return { error: "Description must be 2000 characters or fewer" };
  }
  if (!content || content.length > 500_000) {
    return { error: "Content is required or too large" };
  }

  try {
    const exerciseDir = path.join(process.cwd(), "content", "exercises", id);

    const folderExists = fs.existsSync(exerciseDir);

    if (!folderExists) {
      fs.mkdirSync(exerciseDir, { recursive: true });
    }

    // Clean up previous content files when overwriting an existing exercise
    if (isUpdate || folderExists) {
      const mdPath = path.join(exerciseDir, "index.md");
      const jsonPath = path.join(exerciseDir, "index.json");
      if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
    }

    if (type === "gap-fill") {
      const mdContent = `---
id: ${id}
title: ${title}
description: ${description}
type: gap-fill
tags: ${tags || ""}
---
${content}
`;
      fs.writeFileSync(path.join(exerciseDir, "index.md"), mdContent, "utf-8");
    } else {
      const parsedContent = JSON.parse(content);
      const jsonContent = {
        id,
        title,
        description,
        type,
        tags: tags || "",
        ...parsedContent,
      };
      fs.writeFileSync(
        path.join(exerciseDir, "index.json"),
        JSON.stringify(jsonContent, null, 2),
        "utf-8"
      );
    }

    await syncExercisesToDb();

    // If a courseId is provided, link the exercise to that course
    if (courseId) {
      // Get the current max order in this course
      const maxOrder = await prisma.exercise.findFirst({
        where: { courseId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const nextOrder = (maxOrder?.order ?? -1) + 1;

      await prisma.exercise.update({
        where: { id },
        data: { courseId, order: nextOrder },
      });
    }

    revalidatePath("/teacher");
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to write worksheet file:", err);
    return { error: "Failed to save worksheet" };
  }
}

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".mp3", ".wav", ".ogg", ".m4a",
  ".mp4", ".mkv", ".webm",
  ".pdf", ".doc", ".docx",
]);

export async function uploadMedia(exerciseId: string, filename: string, base64Data: string) {
  await requireTeacher();
  try {
    // Validate exerciseId
    if (!exerciseId || typeof exerciseId !== "string" || exerciseId.length > 128 || !/^[a-z0-9-]+$/.test(exerciseId)) {
      return { error: "Invalid exercise ID" };
    }

    // Validate filename
    if (!filename || typeof filename !== "string") {
      return { error: "Invalid filename" };
    }

    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
      return { error: "File type not allowed for upload" };
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const assetsDir = path.join(process.cwd(), "content", "exercises", exerciseId, "assets");
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length > 10 * 1024 * 1024) {
      return { error: "Upload failed: File exceeds the 10MB limit." };
    }
    fs.writeFileSync(path.join(assetsDir, cleanFilename), buffer);
    return { success: true, filepath: cleanFilename };
  } catch (error: unknown) {
    console.error("Upload media error:", error);
    return { error: "Upload failed" };
  }
}

export async function deleteExercise(exerciseId: string) {
  await requireTeacher();

  if (!exerciseId || typeof exerciseId !== "string" || exerciseId.length > 128 || !/^[a-z0-9-]+$/.test(exerciseId)) {
    return { error: "Invalid exercise ID" };
  }

  try {
    // Soft-delete: rename the folder on disk to a hidden directory starting with .deleted-
    const exerciseDir = path.join(process.cwd(), "content", "exercises", exerciseId);
    const deletedDir = path.join(process.cwd(), "content", "exercises", `.deleted-${exerciseId}`);
    if (fs.existsSync(exerciseDir)) {
      if (fs.existsSync(deletedDir)) {
        fs.rmSync(deletedDir, { recursive: true, force: true });
      }
      fs.renameSync(exerciseDir, deletedDir);
    }

    // Set pendingDeletion to true in DB instead of deleting
    await prisma.exercise.update({
      where: { id: exerciseId },
      data: { pendingDeletion: true }
    });

    revalidatePath("/teacher");
    return { success: true };
  } catch (error) {
    console.error("Failed to soft-delete exercise:", error);
    return { error: "Failed to soft-delete exercise" };
  }
}

export async function duplicateExercise(
  exerciseId: string,
  newId: string,
  newTitle: string
) {
  await requireTeacher();

  // Validate source exercise ID
  if (!exerciseId || typeof exerciseId !== "string" || exerciseId.length > 128 || !/^[a-z0-9-]+$/.test(exerciseId)) {
    return { error: "Invalid source exercise ID" };
  }

  // Validate new ID: kebab-case
  const idRegex = /^[a-z0-9-]+$/;
  if (!newId || !idRegex.test(newId)) {
    return { error: "New ID must contain only lowercase letters, numbers, and hyphens" };
  }
  if (newId.length > 128) {
    return { error: "New ID must be 128 characters or fewer" };
  }
  if (!newTitle || newTitle.trim().length === 0) {
    return { error: "New title is required" };
  }
  if (newTitle.trim().length > 200) {
    return { error: "Title must be 200 characters or fewer" };
  }

  const srcDir = path.join(process.cwd(), "content", "exercises", exerciseId);
  const destDir = path.join(process.cwd(), "content", "exercises", newId);

  if (!fs.existsSync(srcDir)) {
    return { error: "Source exercise not found" };
  }

  if (fs.existsSync(destDir)) {
    return { error: "An exercise with this ID already exists" };
  }

  try {
    // Copy folder recursively
    fs.cpSync(srcDir, destDir, { recursive: true });

    // Update metadata in the new folder
    const mdPath = path.join(destDir, "index.md");
    const jsonPath = path.join(destDir, "index.json");

    if (fs.existsSync(mdPath)) {
      let content = fs.readFileSync(mdPath, "utf-8");
      // Replace ID and Title in frontmatter
      content = content.replace(/^id:\s*.*$/m, `id: ${newId}`);
      content = content.replace(/^title:\s*.*$/m, `title: ${newTitle}`);
      fs.writeFileSync(mdPath, content, "utf-8");
    } else if (fs.existsSync(jsonPath)) {
      const config = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      config.id = newId;
      config.title = newTitle;
      fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2), "utf-8");
    }

    // Sync database
    await syncExercisesToDb();

    revalidatePath("/teacher");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to duplicate exercise:", error);
    return { error: "Failed to duplicate exercise" };
  }
}
