import { spawn } from "child_process";
import path from "path";
import fs from "fs";

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
  question?: string;
  ttsEnabled?: boolean;
  media?: string;
  mediaStatus?: string;
}

interface TTSVocabItem {
  ttsEnabled?: boolean;
  word?: string;
  translation?: string;
  wordAudio?: string;
  translationAudio?: string;
}

interface TTSReadingPage {
  text?: string;
  ttsEnabled?: boolean;
  media?: string;
  mediaStatus?: string;
}

interface TTSContentJson {
  questions?: TTSWorksheetQuestion[];
  vocabList?: TTSVocabItem[];
  pages?: Record<string, TTSReadingPage>;
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
    if (Array.isArray(contentJson.questions)) {
      for (const q of contentJson.questions) {
        if (q.ttsEnabled && q.question) {
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
    }
  } else if (type === "vocabulary" || type === "oral-vocabulary") {
    if (Array.isArray(contentJson.vocabList)) {
      for (let i = 0; i < contentJson.vocabList.length; i++) {
        const item = contentJson.vocabList[i];
        // For oral-vocabulary, TTS is mandatory for translated word (German) to query pupils.
        // For standard vocabulary, it is manual per-item toggle.
        const shouldGenerate = item.ttsEnabled || type === "oral-vocabulary";
        
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
    if (contentJson.pages && typeof contentJson.pages === "object") {
      for (const pageKey of Object.keys(contentJson.pages)) {
        const page = contentJson.pages[pageKey];
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
  }

  return contentJson;
}
