"use server";

import { requireTeacher } from "./auth-helpers";
import { generateAIBranchedReading } from "../gemini";
import { autoDownloadPixabayImage } from "../tts/generator";
import { consumeRateLimit } from "../rateLimit";

// Rate limiting configuration
const AI_READING_RATE_LIMIT_PER_HOUR = 10;
const AI_READING_RATE_LIMIT_PER_DAY = 50;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function generateAIReadingAdventure(
  prompt: string,
  vocabulary: string,
  topics: string,
  exerciseId: string
) {
  const session = await requireTeacher();

  // Rate limiting — check hourly and daily limits before proceeding
  const hourlyResult = consumeRateLimit(
    `ai-reading-hourly:${session.userId}`,
    AI_READING_RATE_LIMIT_PER_HOUR,
    ONE_HOUR_MS,
  );
  if (!hourlyResult.allowed) {
    const minutes = Math.ceil(hourlyResult.resetMs / 60000);
    return {
      error:
        `You've reached the AI reading generation limit (${AI_READING_RATE_LIMIT_PER_HOUR}/hour). ` +
        `Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const dailyResult = consumeRateLimit(
    `ai-reading-daily:${session.userId}`,
    AI_READING_RATE_LIMIT_PER_DAY,
    ONE_DAY_MS,
  );
  if (!dailyResult.allowed) {
    const hours = Math.ceil(dailyResult.resetMs / 3600000);
    return {
      error:
        `You've reached the AI reading generation limit (${AI_READING_RATE_LIMIT_PER_DAY}/day). ` +
        `Please try again in ${hours} hour${hours === 1 ? "" : "s"}.`,
    };
  }

  if (!prompt || !prompt.trim()) {
    return { error: "Please enter a story topic or prompt." };
  }
  if (!exerciseId || !exerciseId.trim()) {
    return { error: "Please specify the Worksheet Key first." };
  }

  try {
    console.log(`[AI Reading] Generating choose-your-own-adventure story for prompt: "${prompt}"`);
    const story = await generateAIBranchedReading(prompt, vocabulary, topics);

    console.log(`[AI Reading] Story structure generated successfully. Downloading illustrations...`);
    
    // Convert AIGeneratedPage array into ReadingPageCreator array structure
    const readingPages = await Promise.all(
      story.pages.map(async (page) => {
        let media = "";
        let mediaStatus = "";
        
        if (page.imageQuery) {
          try {
            console.log(`[AI Reading] Searching illustration for: "${page.imageQuery}"`);
            const downloadedFile = await autoDownloadPixabayImage(page.imageQuery, exerciseId);
            if (downloadedFile) {
              media = downloadedFile;
              mediaStatus = "✓ Pixabay Image Downloaded";
            }
          } catch (imgErr) {
            console.error(`[AI Reading] Image download failed for query "${page.imageQuery}":`, imgErr);
          }
        }

        // Format questions
        const questions = (page.questions || []).map((q) => {
          const qId = `q-${crypto.randomUUID()}`;
          return {
            id: qId,
            type: q.type,
            prompt: q.prompt,
            options: q.options || ["", ""],
            correctOptionIdx: q.correctOptionIdx ?? 0,
            keywords: (q.keywords || []).join("##"),
          };
        });

        return {
          id: page.id,
          title: page.title,
          text: page.text,
          media,
          mediaStatus,
          ttsEnabled: true, // Enable TTS by default
          choices: page.choices || [],
          questions,
        };
      })
    );

    return {
      success: true,
      readingPages,
      startPageId: story.startPageId || "intro",
    };
  } catch (err: unknown) {
    console.error("[AI Reading] Generation failed:", err);
    return { error: err instanceof Error ? err.message : "Failed to generate AI adventure worksheet." };
  }
}
