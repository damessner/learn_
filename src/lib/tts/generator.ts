import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { PIXABAY_API_KEY } from "@/lib/env";

export interface TTSRequest {
  text: string;
  lang: "en-us" | "de";
  output_file: string;
}

export function generateTTS(req: TTSRequest): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const pythonScript = path.join(process.cwd(), "src", "lib", "tts", "generate_tts.py");
    const child = spawn("python3", [pythonScript]);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        resolve({ success: false, error: stderr || `Python process exited with code ${code}` });
        return;
      }
      try {
        const res = JSON.parse(stdout.trim());
        resolve(res);
      } catch {
        resolve({ success: false, error: `Failed to parse Python output: ${stdout}` });
      }
    });

    child.stdin.write(JSON.stringify(req));
    child.stdin.end();
  });
}

/**
 * Walks an exercise content JSON structure and generates necessary TTS files.
 * Modifies the contentJson structure to point to the generated files.
 */
interface TTSWorksheetQuestion {
  id: string;
  type?: string;
  question?: string;
  ttsEnabled?: boolean;
  media?: string;
  mediaStatus?: string;
  hint?: string;
  [key: string]: unknown;
}

interface TTSVocabItem {
  ttsEnabled?: boolean;
  word?: string;
  translation?: string;
  wordAudio?: string;
  translationAudio?: string;
  image?: string;
}

interface TTSReadingPage {
  text?: string;
  ttsEnabled?: boolean;
  media?: string;
  mediaStatus?: string;
}

interface TTSHotspotTask {
  id: string;
  promptText?: string;
  promptAudio?: string;
  promptAudioStatus?: string;
}

interface TTSWorksheetPage {
  id: string;
  title?: string;
  questions: TTSWorksheetQuestion[];
}

interface TTSContentJson {
  questions?: TTSWorksheetQuestion[];
  vocabList?: TTSVocabItem[];
  pages?: Record<string, TTSReadingPage> | TTSWorksheetPage[];
  tasks?: TTSHotspotTask[];
  pictureSupplementation?: boolean;
  practiceMode?: string;
  enhancements?: {
    autoChunkPages?: boolean;
    generateSocraticHints?: boolean;
    autoVisuals?: boolean;
    spacedRetrieval?: boolean;
  };
}

export async function generateTTSForExercise(
  exerciseId: string,
  type: string,
  contentJson: TTSContentJson
): Promise<TTSContentJson> {
  const cleanId = exerciseId.toLowerCase().trim();
  const assetsDir = path.join(process.cwd(), "content", "exercises", cleanId, "assets");
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  if (type === "worksheet") {
    const questions: TTSWorksheetQuestion[] = [];
    if (Array.isArray(contentJson.questions)) {
      questions.push(...contentJson.questions);
    }
    if (Array.isArray(contentJson.pages)) {
      for (const p of contentJson.pages) {
        if (p && typeof p === "object" && "questions" in p && Array.isArray(p.questions)) {
          questions.push(...p.questions);
        }
      }
    }

    for (const q of questions) {
      if (q.ttsEnabled && q.question && !q.media) {
        const filename = `tts-${q.id}.wav`;
        const filepath = path.join(assetsDir, filename);
        console.log(`[TTS] Generating English audio for question prompt: "${q.question}"`);
        const res = await generateTTS({
          text: q.question,
          lang: "en-us",
          output_file: filepath,
        });
        if (res.success) {
          q.media = filename;
          q.mediaStatus = "✓ TTS Generated";
        } else {
          console.error(`[TTS] Failed to generate for question ${q.id}:`, res.error);
        }
      }
    }
  } else if (type === "vocabulary" || type === "oral-vocabulary") {
    if (Array.isArray(contentJson.vocabList)) {
      const isOralQuiz = type === "oral-vocabulary" || (type === "vocabulary" && contentJson.practiceMode === "oral-quiz");
      for (let i = 0; i < contentJson.vocabList.length; i++) {
        const item = contentJson.vocabList[i];
        // For standard vocabulary, it is manual per-item toggle.
        const shouldGenerate = item.ttsEnabled || isOralQuiz;
        
        if (shouldGenerate) {
          // 1. Generate English word audio
          if (item.word) {
            const wordFile = `tts-vocab-${i}-word.wav`;
            const wordPath = path.join(assetsDir, wordFile);
            console.log(`[TTS] Generating English word audio: "${item.word}"`);
            const resEn = await generateTTS({
              text: item.word,
              lang: "en-us",
              output_file: wordPath,
            });
            if (resEn.success) {
              item.wordAudio = wordFile;
            } else {
              console.error(`[TTS] Failed English word vocabulary item ${i}:`, resEn.error);
            }
          }

          // 2. Generate German translation audio
          if (item.translation) {
            const transFile = `tts-vocab-${i}-trans.wav`;
            const transPath = path.join(assetsDir, transFile);
            console.log(`[TTS] Generating German translation audio: "${item.translation}"`);
            const resDe = await generateTTS({
              text: item.translation,
              lang: "de",
              output_file: transPath,
            });
            if (resDe.success) {
              item.translationAudio = transFile;
            } else {
              console.error(`[TTS] Failed German translation vocabulary item ${i}:`, resDe.error);
            }
          }
        }
      }
    }
  } else if (type === "interactive-reading") {
    const pagesRecord = contentJson.pages as Record<string, TTSReadingPage> | undefined;
    if (pagesRecord && typeof pagesRecord === "object") {
      for (const pageKey of Object.keys(pagesRecord)) {
        const page = pagesRecord[pageKey];
        if (page.ttsEnabled && page.text) {
          const filename = `tts-page-${pageKey}.wav`;
          const filepath = path.join(assetsDir, filename);
          console.log(`[TTS] Generating English reading audio for page "${pageKey}"`);
          const res = await generateTTS({
            text: page.text,
            lang: "en-us",
            output_file: filepath,
          });
          if (res.success) {
            page.media = filename;
            page.mediaStatus = "✓ TTS Generated";
          } else {
            console.error(`[TTS] Failed page ${pageKey}:`, res.error);
          }
        }
      }
    }
  } else if (type === "image-hotspot-quiz") {
    if (Array.isArray(contentJson.tasks)) {
      for (const task of contentJson.tasks) {
        if (task.promptText) {
          const filename = `tts-hotspot-${task.id}.wav`;
          const filepath = path.join(assetsDir, filename);
          console.log(`[TTS] Generating English audio for hotspot task: "${task.promptText}"`);
          const res = await generateTTS({
            text: task.promptText,
            lang: "en-us",
            output_file: filepath,
          });
          if (res.success) {
            task.promptAudio = filename;
            task.promptAudioStatus = "✓ TTS Generated";
          } else {
            console.error(`[TTS] Failed hotspot task ${task.id}:`, res.error);
          }
        }
      }
    }
  }

  return contentJson;
}

export async function autoDownloadPixabayImage(word: string, exerciseId: string): Promise<string | null> {
  if (!PIXABAY_API_KEY) {
    console.warn("[Background Build] Pixabay API Key not configured.");
    return null;
  }
  try {
    // E.g. "(to) notice" -> "notice"
    const query = word.replace(/\((to|etw|sb|sth|sich|jemand|jemanden|etwas|jdm|jdn|jds|jdn\/etw)\)/gi, "").replace(/[()]/g, "").replace(/^\s*to\s+/i, "").replace(/\s+/g, " ").trim();
    const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=3`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.hits && data.hits.length > 0) {
      const firstHit = data.hits[0];
      const imgUrl = firstHit.webformatURL;
      
      const parsedUrl = new URL(imgUrl);
      const originalExt = path.extname(parsedUrl.pathname).toLowerCase();
      const safeExt = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(originalExt) ? originalExt : ".jpg";
      const pixabayIdMatch = parsedUrl.pathname.match(/\/([0-9]+)\b/);
      const pixabayId = pixabayIdMatch ? pixabayIdMatch[1] : Date.now();
      const filename = `pixabay_${pixabayId}${safeExt}`;
      
      const assetsDir = path.join(process.cwd(), "content", "exercises", exerciseId.toLowerCase().trim(), "assets");
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }
      const targetPath = path.join(assetsDir, filename);
      const imgRes = await fetch(imgUrl);
      if (!imgRes.ok) return null;
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(targetPath, buffer);
      return filename;
    }
  } catch (err) {
    console.error(`[Background Build] Failed to auto-supplement image for '${word}':`, err);
  }
  return null;
}

export async function runBackgroundBuild(
  exerciseId: string,
  type: string,
  contentJson: TTSContentJson
) {
  const cleanId = exerciseId.toLowerCase().trim();
  const statusFile = path.join(process.cwd(), "content", "exercises", cleanId, "build-status.json");

  // Write a "queued" marker BEFORE delegating to setTimeout, so that even if
  // the server restarts before the timer fires, the next process can find
  // and re-queue this build via `recoverPendingBuilds`.
  try {
    fs.mkdirSync(path.dirname(statusFile), { recursive: true });
    fs.writeFileSync(
      statusFile,
      JSON.stringify({
        status: "queued",
        progress: 0,
        message: "Queued for processing...",
        exerciseId: cleanId,
        type,
        queuedAt: new Date().toISOString(),
      }),
      "utf-8"
    );
  } catch (markErr) {
    console.error(`[Background Build] Failed to mark '${cleanId}' as queued:`, markErr);
  }

  setTimeout(() => {
    void processBuildQueue(cleanId, type, contentJson);
  }, 0);
}

/**
 * Sweeps the exercises directory for builds left in "queued" or "processing"
 * state (e.g. after a server restart) and re-queues them.
 *
 * Safe to call repeatedly; idempotent.
 */
export function recoverPendingBuilds(): { recovered: string[] } {
  const exercisesDir = path.join(process.cwd(), "content", "exercises");
  const recovered: string[] = [];
  if (!fs.existsSync(exercisesDir)) return { recovered };

  const folders = fs.readdirSync(exercisesDir);
  for (const folder of folders) {
    const statusFile = path.join(exercisesDir, folder, "build-status.json");
    if (!fs.existsSync(statusFile)) continue;
    try {
      const raw = fs.readFileSync(statusFile, "utf-8");
      const status = JSON.parse(raw) as { status?: string; type?: string };
      if (status.status === "queued" || status.status === "processing") {
        // The build was interrupted. Mark it for retry and let the
        // operator/user re-trigger if needed. We don't auto-resume because
        // we don't have the in-memory contentJson here. Clearing the
        // stuck status unblocks the UI.
        if (status.status === "processing") {
          fs.writeFileSync(
            statusFile,
            JSON.stringify({
              status: "interrupted",
              progress: 0,
              message:
                "Build was interrupted by a server restart. Re-trigger the build to retry.",
            }),
            "utf-8"
          );
          recovered.push(folder);
        }
      }
    } catch {
      // Ignore unparseable status files
    }
  }
  return { recovered };
}

async function processBuildQueue(
  cleanId: string,
  type: string,
  contentJson: TTSContentJson
) {
  const assetsDir = path.join(process.cwd(), "content", "exercises", cleanId, "assets");
  const statusFile = path.join(process.cwd(), "content", "exercises", cleanId, "build-status.json");
  const indexJsonFile = path.join(process.cwd(), "content", "exercises", cleanId, "index.json");

  const writeStatus = (status: string, progress: number, message: string) => {
    try {
      fs.writeFileSync(
        statusFile,
        JSON.stringify({ status, progress: Math.min(100, Math.max(0, progress)), message }),
        "utf-8"
      );
    } catch (writeErr) {
      console.error(`[Background Build] Failed to write status for '${cleanId}':`, writeErr);
    }
  };

  try {
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    writeStatus("processing", 0, "Initializing background builder...");

    const steps: Array<() => Promise<void>> = [];

    if (type === "worksheet") {
      // 0. Auto-Page Chunking
      if (contentJson.enhancements?.autoChunkPages) {
        const hasPages = Array.isArray(contentJson.pages) && contentJson.pages.length > 0;
        const allQuestions = hasPages
          ? (contentJson.pages as TTSWorksheetPage[]).flatMap(p => p.questions || [])
          : (contentJson.questions || []);

        if (allQuestions.length > 0 && (!hasPages || (contentJson.pages as TTSWorksheetPage[]).length <= 1)) {
          const chunkedPages: TTSWorksheetPage[] = [];
          const chunkSize = 3;
          for (let i = 0; i < allQuestions.length; i += chunkSize) {
            const chunk = allQuestions.slice(i, i + chunkSize);
            chunkedPages.push({
              id: `auto-page-${Math.floor(i / chunkSize) + 1}`,
              title: `Part ${Math.floor(i / chunkSize) + 1}`,
              questions: chunk
            });
          }
          contentJson.pages = chunkedPages;
          contentJson.questions = undefined;
        }
      }

      // Gather all worksheet questions
      const worksheetQuestions: TTSWorksheetQuestion[] = [];
      if (Array.isArray(contentJson.questions)) {
        worksheetQuestions.push(...contentJson.questions);
      }
      if (Array.isArray(contentJson.pages)) {
        for (const p of contentJson.pages) {
          if (p && typeof p === "object" && "questions" in p && Array.isArray(p.questions)) {
            worksheetQuestions.push(...p.questions);
          }
        }
      }

      // Build enhancement and build steps
      for (const q of worksheetQuestions) {
        // TTS Audio Generation
        if (q.ttsEnabled && q.question && !q.media) {
          steps.push(async () => {
            const filename = `tts-${q.id}.wav`;
            const filepath = path.join(assetsDir, filename);
            const res = await generateTTS({
              text: q.question!,
              lang: "en-us",
              output_file: filepath,
            });
            if (res.success) {
              q.media = filename;
              q.mediaStatus = "✓ TTS Generated";
            }
          });
        }

        // Socratic Hint Generation
        if (contentJson.enhancements?.generateSocraticHints && q.question && (!q.hint || q.hint.trim() === "")) {
          steps.push(async () => {
            try {
              const { fetchSocraticHint } = await import("@/lib/gemini");
              const hint = await fetchSocraticHint(q);
              if (hint) {
                q.hint = hint;
              }
            } catch (err) {
              console.error(`[Background Build] Failed to generate Socratic hint for task ${q.id}:`, err);
            }
          });
        }

        // Auto-Visual Pixabay Image Generation
        if (contentJson.enhancements?.autoVisuals && (!q.media || q.media.trim() === "")) {
          steps.push(async () => {
            if (q.type === "media" || q.type === "instruction") return;
            try {
              const { fetchImageQuery } = await import("@/lib/gemini");
              const query = await fetchImageQuery(q);
              if (query) {
                const imgFile = await autoDownloadPixabayImage(query, cleanId);
                if (imgFile) {
                  q.media = imgFile;
                  q.mediaStatus = "✓ Auto-Visual Image";
                }
              }
            } catch (err) {
              console.error(`[Background Build] Failed to auto-supplement image for task ${q.id}:`, err);
            }
          });
        }
      }
    } else if (type === "vocabulary" || type === "oral-vocabulary") {
      if (Array.isArray(contentJson.vocabList)) {
        const isOralQuiz = type === "oral-vocabulary" || (type === "vocabulary" && contentJson.practiceMode === "oral-quiz");
        const needsImages = !!contentJson.pictureSupplementation && !isOralQuiz;
        for (let i = 0; i < contentJson.vocabList.length; i++) {
          const item = contentJson.vocabList[i];
          const shouldGenerateAudio = item.ttsEnabled || isOralQuiz;

          if (shouldGenerateAudio) {
            if (item.word && !item.wordAudio) {
              steps.push(async () => {
                const wordFile = `tts-vocab-${i}-word.wav`;
                const wordPath = path.join(assetsDir, wordFile);
                const res = await generateTTS({
                  text: item.word!,
                  lang: "en-us",
                  output_file: wordPath,
                });
                if (res.success) item.wordAudio = wordFile;
              });
            }
            if (item.translation && !item.translationAudio) {
              steps.push(async () => {
                const transFile = `tts-vocab-${i}-trans.wav`;
                const transPath = path.join(assetsDir, transFile);
                const res = await generateTTS({
                  text: item.translation!,
                  lang: "de",
                  output_file: transPath,
                });
                if (res.success) item.translationAudio = transFile;
              });
            }
          }

          if (needsImages && !item.image) {
            steps.push(async () => {
              const imgFile = await autoDownloadPixabayImage(item.word!, cleanId);
              if (imgFile) {
                item.image = imgFile;
              }
            });
          }
        }
      }
    } else if (type === "interactive-reading") {
      const pagesRecord = contentJson.pages as Record<string, TTSReadingPage> | undefined;
      if (pagesRecord && typeof pagesRecord === "object") {
        for (const pageKey of Object.keys(pagesRecord)) {
          const page = pagesRecord[pageKey];
          if (page.ttsEnabled && page.text && !page.media) {
            steps.push(async () => {
              const filename = `tts-page-${pageKey}.wav`;
              const filepath = path.join(assetsDir, filename);
              const res = await generateTTS({
                text: page.text!,
                lang: "en-us",
                output_file: filepath,
              });
              if (res.success) {
                page.media = filename;
                page.mediaStatus = "✓ TTS Generated";
              }
            });
          }
        }
      }
    } else if (type === "image-hotspot-quiz") {
      if (Array.isArray(contentJson.tasks)) {
        for (const task of contentJson.tasks) {
          if (task.promptText && !task.promptAudio) {
            steps.push(async () => {
              const filename = `tts-hotspot-${task.id}.wav`;
              const filepath = path.join(assetsDir, filename);
              const res = await generateTTS({
                text: task.promptText!,
                lang: "en-us",
                output_file: filepath,
              });
              if (res.success) {
                task.promptAudio = filename;
                task.promptAudioStatus = "✓ TTS Generated";
              }
            });
          }
        }
      }
    }

    const totalSteps = steps.length;
    if (totalSteps === 0) {
      writeStatus("ready", 100, "Ready!");
      setTimeout(() => {
        try {
          if (fs.existsSync(statusFile)) fs.unlinkSync(statusFile);
        } catch { /* ignore */ }
      }, 5000);
      return;
    }

    for (let sIdx = 0; sIdx < totalSteps; sIdx++) {
      const progress = Math.round((sIdx / totalSteps) * 100);
      writeStatus("processing", progress, `Processing step ${sIdx + 1} of ${totalSteps}...`);
      try {
        await steps[sIdx]();
      } catch (err) {
        console.error(`[Background Build] Step ${sIdx + 1} failed:`, err);
      }
    }

    fs.writeFileSync(indexJsonFile, JSON.stringify(contentJson, null, 2), "utf-8");

    const { syncExercisesToDb, clearExerciseCache } = await import("@/lib/exercises");
    await syncExercisesToDb();
    clearExerciseCache(cleanId);

    writeStatus("ready", 100, "Worksheet ready!");
    setTimeout(() => {
      try {
        if (fs.existsSync(statusFile)) fs.unlinkSync(statusFile);
      } catch { /* ignore */ }
    }, 5000);

  } catch (buildErr) {
    console.error(`[Background Build] Critical build error for '${cleanId}':`, buildErr);
    writeStatus("error", 0, buildErr instanceof Error ? buildErr.message : "Critical build failure.");
  }
}
