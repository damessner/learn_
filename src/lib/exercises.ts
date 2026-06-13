import fs from "fs";
import path from "path";
import { prisma } from "./db";
import { z } from "zod";

// Base Schema
const BaseExerciseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(""),
  type: z.enum([
    "multiple-choice",
    "drag-drop",
    "gap-fill",
    "categorization",
    "explore-image-map",
    "worksheet",
    "clickable-choice",
    "matching",
    "media",
    "instruction",
    "open-question",
    "ordering",
    "image-hotspot-quiz",
    "interactive-reading",
    "vocabulary",
    "writing-coach"
  ]),
  tags: z.union([z.string(), z.array(z.string())]).optional().default(""),
});

// Zod schemas for validation
export const MultipleChoiceSchema = BaseExerciseSchema.extend({
  type: z.literal("multiple-choice"),
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      options: z.array(z.string()),
      correctOptionIndex: z.number().int().min(0),
      media: z.string().optional(), // e.g. "image.jpg"
    })
  ),
});

export const DragDropSchema = BaseExerciseSchema.extend({
  type: z.literal("drag-drop"),
  // Word drag and drop inside a text block
  // Example text: "The [cow] lives on the farm and eats [grass]."
  text: z.string(),
  distractors: z.array(z.string()).default([]),
});

export const GapFillSchema = BaseExerciseSchema.extend({
  type: z.literal("gap-fill"),
  // Example text: "The sun <<shines##shone##shined>> in the sky. Yesterday it <<rained>>."
  // <<shines##shone##shined>> means a dropdown (first is correct). <<rained>> means a text input.
  text: z.string(),
});

export const CategorizationSchema = BaseExerciseSchema.extend({
  type: z.literal("categorization"),
  categories: z.array(z.string()),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      media: z.string().optional(), // optional image or audio
    })
  ),
});

export const ExploreImageMapSchema = BaseExerciseSchema.extend({
  type: z.literal("explore-image-map"),
  startScene: z.string(),
  scenes: z.record(
    z.string(),
    z.object({
      image: z.string(), // e.g. "room.jpg"
      hotspots: z.array(
        z.object({
          id: z.string(),
          shape: z.enum(["circle", "rect", "polygon"]),
          coords: z.array(z.number()), // [cx, cy, r] or [x1, y1, x2, y2] or [x1, y1, x2, y2, x3, y3, ...]
          action: z.object({
            type: z.enum(["play-audio", "change-scene"]),
            audio: z.string().optional(), // e.g. "cow_moo.mp3"
            scene: z.string().optional(), // scene ID to transition to
          }),
          popupText: z.string().optional(),
          label: z.string().optional(), // name of target, used in game mode challenges
        })
      ),
    })
  ),
  gameMode: z
    .object({
      enabled: z.boolean().default(false),
      challenges: z.array(
        z.object({
          id: z.string(),
          promptText: z.string(),
          promptAudio: z.string().optional(), // e.g. "find_cow.mp3"
          targetLabel: z.string(), // matches hotspot label
          successAudio: z.string().optional(),
          failAudio: z.string().optional(),
        })
      ),
    })
    .optional(),
});

export const ClickableChoiceSchema = BaseExerciseSchema.extend({
  type: z.literal("clickable-choice"),
  choices: z.array(z.string()),
  statements: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      correctChoice: z.string(),
      media: z.string().optional(),
    })
  ),
});

export const MatchingSchema = BaseExerciseSchema.extend({
  type: z.literal("matching"),
  pairs: z.array(
    z.object({
      id: z.string(),
      leftText: z.string().optional(),
      leftMedia: z.string().optional(),
      rightText: z.string(),
    })
  ),
});

// Single-purpose top-level schemas for discriminatedUnion completeness
export const MediaSchema = BaseExerciseSchema.extend({
  type: z.literal("media"),
  media: z.string(),
});

export const InstructionSchema = BaseExerciseSchema.extend({
  type: z.literal("instruction"),
  text: z.string(),
});

export const OpenQuestionSchema = BaseExerciseSchema.extend({
  type: z.literal("open-question"),
  question: z.string(),
  keywords: z.array(z.string()).optional(),
  required: z.array(z.string()).optional(),
  bonus: z.array(z.string()).optional(),
  forbidden: z.array(z.string()).optional(),
  spellingTolerance: z.enum(["strict", "lenient", "off"]).optional(),
  allowAudio: z.boolean().optional(),
  allowImage: z.boolean().optional(),
});

export const OrderingSchema = BaseExerciseSchema.extend({
  type: z.literal("ordering"),
  question: z.string(),
  elements: z.array(z.string()),
});

export const ImageHotspotQuizSchema = BaseExerciseSchema.extend({
  type: z.literal("image-hotspot-quiz"),
  backgroundImage: z.string(),
  hotspots: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      shape: z.enum(["circle", "rect"]),
      coords: z.array(z.number()),
    })
  ),
  tasks: z.array(
    z.object({
      id: z.string(),
      promptText: z.string(),
      promptAudio: z.string().optional(),
      targetHotspotId: z.string(),
    })
  ),
});

export const InteractiveReadingSchema = BaseExerciseSchema.extend({
  type: z.literal("interactive-reading"),
  startPage: z.string(),
  pages: z.record(
    z.string(),
    z.object({
      title: z.string().optional(),
      text: z.string(),
      media: z.string().optional(),
      choices: z.array(
        z.object({
          text: z.string(),
          nextPageId: z.string(),
        })
      ),
      questions: z.array(
        z.object({
          id: z.string(),
          type: z.enum(["multiple-choice", "open-question"]),
          prompt: z.string(),
          options: z.array(z.string()).optional(),
          correctOptionIdx: z.number().int().optional(),
          keywords: z.array(z.string()).optional(),
        })
      ).default([]),
    })
  ),
});

export const VocabularySchema = BaseExerciseSchema.extend({
  type: z.literal("vocabulary"),
  vocabList: z.array(
    z.object({
      word: z.string(),
      translation: z.string(),
    })
  ),
});

export const WritingCoachSchema = BaseExerciseSchema.extend({
  type: z.literal("writing-coach"),
  prompt: z.string(),
  systemPrompt: z.string().optional(),
  criteria: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      tip: z.string().optional(),
    })
  ),
});

export const WorksheetQuestionSchema = z.object({
  id: z.string(),
  type: z.enum([
    "multiple-choice",
    "drag-drop",
    "gap-fill",
    "categorization",
    "clickable-choice",
    "matching",
    "media",
    "instruction",
    "open-question",
    "ordering"
  ]),
  question: z.string().default(""),
  media: z.string().optional(), // general media input for questions
  hint: z.string().optional(), // optional hint
  options: z.array(z.string()).optional(),
  correctOptionIndex: z.number().int().min(0).optional(),
  text: z.string().optional(),
  categories: z.array(z.string()).optional(),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
    })
  ).optional(),
  // Clickable Choice specific
  choices: z.array(z.string()).optional(),
  statements: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      correctChoice: z.string(),
      media: z.string().optional(),
    })
  ).optional(),
  // Matching specific
  pairs: z.array(
    z.object({
      id: z.string(),
      leftText: z.string().optional(),
      leftMedia: z.string().optional(),
      rightText: z.string(),
    })
  ).optional(),
  // Open question specific
  keywords: z.array(z.string()).optional(),
  required: z.array(z.string()).optional(),
  bonus: z.array(z.string()).optional(),
  forbidden: z.array(z.string()).optional(),
  spellingTolerance: z.enum(["strict", "lenient", "off"]).optional(),
  // Ordering specific
  elements: z.array(z.string()).optional(),
});

export const WorksheetSchema = BaseExerciseSchema.extend({
  type: z.literal("worksheet"),
  questions: z.array(WorksheetQuestionSchema),
});

export const ExerciseSchema = z.discriminatedUnion("type", [
  MultipleChoiceSchema,
  DragDropSchema,
  GapFillSchema,
  CategorizationSchema,
  ExploreImageMapSchema,
  WorksheetSchema,
  ClickableChoiceSchema,
  MatchingSchema,
  MediaSchema,
  InstructionSchema,
  OpenQuestionSchema,
  OrderingSchema,
  ImageHotspotQuizSchema,
  InteractiveReadingSchema,
  VocabularySchema,
  WritingCoachSchema,
]);

export type ExerciseData = z.infer<typeof ExerciseSchema>;

const EXERCISES_DIR = path.join(process.cwd(), "content", "exercises");

// Simple in-memory cache for exercise reads from disk
const exerciseCache = new Map<string, { data: ExerciseData; ts: number }>();
const CACHE_TTL_MS = 5_000; // 5 seconds

/**
 * Ensures the exercises directory exists on disk
 */
export function ensureExercisesDirExists() {
  if (!fs.existsSync(EXERCISES_DIR)) {
    fs.mkdirSync(EXERCISES_DIR, { recursive: true });
  }
}

/**
 * Parses frontmatter from a markdown string
 */
function parseMarkdown(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yamlBlock = match[1];
  const body = match[2];
  const frontmatter: Record<string, unknown> = {};

  yamlBlock.split("\n").forEach((line) => {
    const parts = line.split(":");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join(":").trim();
      // Simple parse for strings, booleans, and numbers
      if (value === "true") frontmatter[key] = true;
      else if (value === "false") frontmatter[key] = false;
      else if (!isNaN(Number(value)) && value !== "") frontmatter[key] = Number(value);
      else frontmatter[key] = value.replace(/^['"]|['"]$/g, ""); // strip quotes
    }
  });

  return { frontmatter, body };
}

/**
 * Reads and parses an exercise folder from the filesystem
 */
export function getExerciseFromDisk(id: string): ExerciseData | null {
  ensureExercisesDirExists();
  const dirPath = path.join(EXERCISES_DIR, id);

  if (!fs.existsSync(dirPath)) return null;

  const jsonPath = path.join(dirPath, "index.json");
  const mdPath = path.join(dirPath, "index.md");

  const cached = exerciseCache.get(id);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(raw);
      // Ensure id matches folder name
      parsed.id = id;
      if (parsed.type === "tiptoi") {
        parsed.type = "explore-image-map";
      }
      const result = ExerciseSchema.safeParse(parsed);
      if (!result.success) {
        console.error(`Validation error in exercise ${id}:`, result.error.format());
        return null;
      }
      exerciseCache.set(id, { data: result.data, ts: Date.now() });
      return result.data;
    } else if (fs.existsSync(mdPath)) {
      const raw = fs.readFileSync(mdPath, "utf-8");
      const { frontmatter, body } = parseMarkdown(raw);
      
      frontmatter.id = id;
      frontmatter.text = body.trim();
      
      if (frontmatter.type === "tiptoi") {
        frontmatter.type = "explore-image-map";
      }
      // Markdown exercises are typically gap-fill or drag-drop
      if (!frontmatter.type) frontmatter.type = "gap-fill";

      const result = ExerciseSchema.safeParse(frontmatter);
      if (!result.success) {
        console.error(`Validation error in markdown exercise ${id}:`, result.error.format());
        return null;
      }
      exerciseCache.set(id, { data: result.data, ts: Date.now() });
      return result.data;
    }
  } catch (error) {
    console.error(`Failed to read exercise ${id} from disk:`, error);
  }

  return null;
}

/**
 * Scans content/exercises directory and returns list of all exercises on disk
 */
export function getAllExercisesFromDisk(): ExerciseData[] {
  ensureExercisesDirExists();
  try {
    const folders = fs.readdirSync(EXERCISES_DIR);
    const exercises: ExerciseData[] = [];

    for (const folder of folders) {
      if (folder.startsWith(".")) continue;
      const folderPath = path.join(EXERCISES_DIR, folder);
      if (fs.statSync(folderPath).isDirectory()) {
        const exercise = getExerciseFromDisk(folder);
        if (exercise) {
          exercises.push(exercise);
        }
      }
    }
    return exercises;
  } catch (error) {
    console.error("Failed to read exercises directory:", error);
    return [];
  }
}

/**
 * Synchronizes the filesystem exercises with the SQLite database
 */
export async function syncExercisesToDb(): Promise<{ syncedCount: number; deletedCount: number }> {
  ensureExercisesDirExists();
  const diskExercises = getAllExercisesFromDisk();
  const diskIds = diskExercises.map((e) => e.id);

  let syncedCount = 0;

  // Upsert all exercises from disk into DB
  // Note: courseId and order are DB-managed metadata, not stored on disk.
  // On update, we preserve them; on create, they default to null/0.
  for (const exercise of diskExercises) {
    const tagsStr = Array.isArray(exercise.tags)
      ? exercise.tags.join(",")
      : exercise.tags || "";

    await prisma.exercise.upsert({
      where: { id: exercise.id },
      update: {
        title: exercise.title,
        description: exercise.description,
        type: exercise.type,
        updatedAt: new Date(),
        pendingDeletion: false, // restore if it was previously soft-deleted
        tags: tagsStr,
        // courseId and order are preserved — not overwritten from disk
      },
      create: {
        id: exercise.id,
        title: exercise.title,
        description: exercise.description,
        type: exercise.type,
        pendingDeletion: false,
        tags: tagsStr,
        // courseId defaults to null, order defaults to 0
      },
    });
    syncedCount++;
  }

  // Soft-delete exercises in DB that no longer exist on disk
  const deleteResult = await prisma.exercise.updateMany({
    where: {
      id: {
        notIn: diskIds,
      },
    },
    data: {
      pendingDeletion: true,
    },
  });

  return {
    syncedCount,
    deletedCount: deleteResult.count,
  };
}

