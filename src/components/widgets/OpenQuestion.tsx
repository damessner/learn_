import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { WidgetProps, OpenQuestionConfig } from "./types";
import { CheckCircle, AlertTriangle, Mic, Square, Trash2, Upload, Loader2 } from "lucide-react";

function getLevenshteinDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function matchesKeyword(text: string, kw: string, spellingTolerance: string): boolean {
  const cleanText = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ").replace(/\s+/g, " ").trim();
  const cleanKw = kw.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ").replace(/\s+/g, " ").trim();
  if (spellingTolerance === "strict" || spellingTolerance === "off" || !spellingTolerance) {
    return cleanText.includes(cleanKw);
  }
  // Lenient: Levenshtein distance <= 1 for each word
  const textWords = cleanText.split(" ").filter(Boolean);
  const kwWords = cleanKw.split(" ").filter(Boolean);
  if (kwWords.length === 0) return false;
  if (kwWords.length === 1) {
    return textWords.some(w => getLevenshteinDistance(w, cleanKw) <= 1);
  }
  // Multi-word phrase check
  for (let i = 0; i <= textWords.length - kwWords.length; i++) {
    let match = true;
    for (let j = 0; j < kwWords.length; j++) {
      if (getLevenshteinDistance(textWords[i + j], kwWords[j]) > 1) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

export const OpenQuestion: React.FC<WidgetProps<OpenQuestionConfig>> = ({
  config,
  savedState,
  onChange,
  isReadOnly = false,
}) => {
  const [response, setResponse] = useState<string>(savedState?.response || "");
  const [audioUrl, setAudioUrl] = useState<string>(savedState?.audioUrl || "");
  const [imageUrl, setImageUrl] = useState<string>(savedState?.imageUrl || "");
  const [uploading, setUploading] = useState(false);

  // Audio recording states
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable onChange ref
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const { score, isComplete, matchedRequired, matchedBonus, matchedForbidden } = useMemo(() => {
    const isComplete = response.trim().length > 0 || !!audioUrl || !!imageUrl;
    const cleanedInput = response.toLowerCase().trim();

    const required = config.required || [];
    const bonus = config.bonus || [];
    const forbidden = config.forbidden || [];
    const tolerance = config.spellingTolerance || "strict";

    // If text is empty and there's a media submission (audio/image)
    if (response.trim().length === 0 && (audioUrl || imageUrl)) {
      return {
        score: 100, // Default to 100% until reviewed by teacher
        isComplete,
        matchedRequired: [],
        matchedBonus: [],
        matchedForbidden: [],
      };
    }

    // Helper to parse keyword and optional weight (e.g. apple##2)
    const parseKw = (kwStr: string) => {
      const parts = kwStr.split("##");
      const kw = parts[0].trim();
      const weight = parts.length > 1 ? parseFloat(parts[1]) : 1.0;
      return { kw, weight: isNaN(weight) ? 1.0 : weight, original: kwStr };
    };

    // 1. Check forbidden keywords
    const forbiddenParsed = forbidden.map(parseKw);
    const matchedForbiddenParsed = forbiddenParsed.filter(p => matchesKeyword(cleanedInput, p.kw, tolerance));
    if (matchedForbiddenParsed.length > 0) {
      return {
        score: 0,
        isComplete,
        matchedRequired: [],
        matchedBonus: [],
        matchedForbidden: matchedForbiddenParsed.map(p => p.kw),
      };
    }

    // 2. Legacy fallback (if no new fields exist)
    const hasNewFields = required.length > 0 || bonus.length > 0 || forbidden.length > 0;
    if (!hasNewFields) {
      const legacyKeywords = config.keywords || [];
      if (legacyKeywords.length === 0) {
        return { score: isComplete ? 100 : 0, isComplete, matchedRequired: [], matchedBonus: [], matchedForbidden: [] };
      }
      const matchesLegacy = legacyKeywords.some(kw => matchesKeyword(cleanedInput, kw, "strict"));
      return { score: matchesLegacy ? 100 : 0, isComplete, matchedRequired: matchesLegacy ? [legacyKeywords[0]] : [], matchedBonus: [], matchedForbidden: [] };
    }

    // 3. New Advanced Rubric with optional weights
    const requiredParsed = required.map(parseKw);
    const bonusParsed = bonus.map(parseKw);

    const matchedRequiredParsed = requiredParsed.filter(p => matchesKeyword(cleanedInput, p.kw, tolerance));
    const matchedBonusParsed = bonusParsed.filter(p => matchesKeyword(cleanedInput, p.kw, tolerance));

    let finalScore = 0;
    if (requiredParsed.length > 0) {
      const totalRequiredWeight = requiredParsed.reduce((acc, p) => acc + p.weight, 0);
      const matchedRequiredWeight = matchedRequiredParsed.reduce((acc, p) => acc + p.weight, 0);
      const baseScore = totalRequiredWeight > 0 ? (matchedRequiredWeight / totalRequiredWeight) * 100 : 0;

      // Each bonus keyword weight adds weight * 15 points
      const bonusEarned = matchedBonusParsed.reduce((acc, p) => acc + (p.weight * 15), 0);
      finalScore = Math.min(100, baseScore + bonusEarned);
    } else if (bonusParsed.length > 0) {
      const totalBonusWeight = bonusParsed.reduce((acc, p) => acc + p.weight, 0);
      const matchedBonusWeight = matchedBonusParsed.reduce((acc, p) => acc + p.weight, 0);
      finalScore = totalBonusWeight > 0 ? (matchedBonusWeight / totalBonusWeight) * 100 : 0;
    } else {
      finalScore = isComplete ? 100 : 0;
    }

    return {
      score: Math.round(finalScore),
      isComplete,
      matchedRequired: matchedRequiredParsed.map(p => p.original),
      matchedBonus: matchedBonusParsed.map(p => p.original),
      matchedForbidden: matchedForbiddenParsed.map(p => p.original),
    };
  }, [response, audioUrl, imageUrl, config]);

  useEffect(() => {
    onChangeRef.current({ response, audioUrl, imageUrl }, isComplete, score);
  }, [response, audioUrl, imageUrl, isComplete, score]);

  // Audio Recording Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.wav");
        
        try {
          setUploading(true);
          const res = await fetch("/api/submissions/upload", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) throw new Error("Upload failed");
          const data = await res.json();
          setAudioUrl(data.url);
        } catch (err) {
          console.error("Failed to upload audio:", err);
          alert("Failed to upload audio recording. Please try again.");
        } finally {
          setUploading(false);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Microphone access is required to record audio.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const deleteAudio = () => {
    setAudioUrl("");
  };

  // Image Upload Handlers
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      const res = await fetch("/api/submissions/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setImageUrl(data.url);
    } catch (err) {
      console.error("Failed to upload image:", err);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = () => {
    setImageUrl("");
  };

  const isPassing = score >= 50;

  return (
    <div className="space-y-4">
      {config.description && (
        <p className="text-xs text-neutral-500 italic mb-2">{config.description}</p>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          {config.question}
        </label>
        <textarea
          disabled={isReadOnly}
          rows={3}
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Type your answer here..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck="false"
          className={`w-full text-base md:text-sm border rounded p-3 bg-transparent outline-none transition ${
            isReadOnly
              ? isPassing
                ? "border-green-500 bg-green-50/10"
                : "border-red-500 bg-red-50/10"
              : "border-neutral-300 dark:border-neutral-700 focus:border-black dark:focus:border-white"
          }`}
        />
      </div>

      {/* Media Submission Options (Audio/Image) */}
      {(config.allowAudio || config.allowImage) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Audio Recorder widget */}
          {config.allowAudio && (
            <div className="border border-neutral-200 dark:border-neutral-800 rounded p-4 bg-neutral-50/50 dark:bg-neutral-950/20 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-450 block font-mono">
                Audio Recording
              </span>
              
              {isReadOnly ? (
                audioUrl ? (
                  <audio src={audioUrl} controls className="w-full" />
                ) : (
                  <span className="text-xs italic text-neutral-450">No audio recording submitted.</span>
                )
              ) : (
                <div className="space-y-2">
                  {audioUrl ? (
                    <div className="flex flex-col gap-2">
                      <audio src={audioUrl} controls className="w-full" />
                      <button
                        type="button"
                        onClick={deleteAudio}
                        className="text-[10px] font-bold font-mono text-red-600 hover:text-red-700 dark:hover:text-red-400 flex items-center gap-1 self-start"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete &amp; Re-record
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {recording ? (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="flex items-center gap-2 bg-red-655 hover:bg-red-700 text-white px-4 py-2 rounded text-xs font-bold uppercase font-mono transition"
                        >
                          <Square className="w-4 h-4 fill-current animate-pulse" />
                          Stop ({recordingTime}s)
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={startRecording}
                          className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-black px-4 py-2 rounded text-xs font-bold uppercase font-mono transition disabled:opacity-50"
                        >
                          <Mic className="w-4 h-4" />
                          Record Audio
                        </button>
                      )}
                      {uploading && (
                        <span className="text-xs font-mono text-neutral-500 flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-450" />
                          Uploading...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Picture Submission widget */}
          {config.allowImage && (
            <div className="border border-neutral-200 dark:border-neutral-800 rounded p-4 bg-neutral-50/50 dark:bg-neutral-950/20 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-450 block font-mono">
                Picture Submission
              </span>

              {isReadOnly ? (
                  imageUrl ? (
                  <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded border border-neutral-350 dark:border-neutral-700 h-48">
                    <Image src={imageUrl} alt="Submission" fill className="object-cover group-hover:scale-105 transition duration-200" sizes="(max-width: 768px) 100vw, 50vw" />
                    <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-mono font-bold uppercase">
                      Open Full Image
                    </span>
                  </a>
                ) : (
                  <span className="text-xs italic text-neutral-450">No picture submitted.</span>
                )
              ) : (
                <div className="space-y-2">
                  {imageUrl ? (
                    <div className="flex flex-col gap-2">
                      <div className="relative rounded overflow-hidden border border-neutral-350 dark:border-neutral-700 h-48">
                        <Image src={imageUrl} alt="Submission preview" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
                      </div>
                      <button
                        type="button"
                        onClick={deleteImage}
                        className="text-[10px] font-bold font-mono text-red-650 hover:text-red-700 dark:hover:text-red-400 flex items-center gap-1 self-start"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove Picture
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-black px-4 py-2 rounded text-xs font-bold uppercase font-mono transition cursor-pointer disabled:opacity-50">
                        <Upload className="w-4 h-4" />
                        Upload Picture
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          disabled={uploading}
                          className="sr-only"
                        />
                      </label>
                      {uploading && (
                        <span className="text-xs font-mono text-neutral-500 flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-450" />
                          Uploading...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isReadOnly && response.trim().length > 0 && (
        <div className={`text-xs p-3 rounded border flex flex-col gap-2 ${
          isPassing
            ? "border-green-300 bg-green-50/20 text-green-700 dark:text-green-350"
            : "border-red-300 bg-red-50/20 text-red-700 dark:text-red-350"
        }`}>
          <div className="flex items-center gap-2">
            {isPassing ? (
              <CheckCircle className="w-4 h-4 shrink-0 text-green-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            )}
            <p className="font-bold">
              {isPassing ? `Passable answer! (${score}%)` : `Needs improvement (${score}%)`}
            </p>
          </div>

          <div className="mt-1 space-y-1.5 opacity-90 pl-6">
            {config.required && config.required.length > 0 && (
              <p>
                Required words:{" "}
                {config.required.map((w, i) => {
                  const parts = w.split("##");
                  const cleanKw = parts[0].trim();
                  const weight = parts.length > 1 ? parseFloat(parts[1]) : 1.0;
                  const label = !isNaN(weight) && weight !== 1.0 ? `${cleanKw} (${weight}x)` : cleanKw;
                  return (
                    <span
                      key={i}
                      className={`inline-block px-1 rounded mr-1 ${
                        matchedRequired.includes(w)
                          ? "bg-green-200/50 text-green-800 dark:bg-green-900/30 dark:text-green-350"
                          : "bg-red-200/50 text-red-800 dark:bg-red-900/30 dark:text-red-350"
                      }`}
                    >
                      {label}
                    </span>
                  );
                })}
              </p>
            )}

            {config.bonus && config.bonus.length > 0 && (
              <p>
                Bonus words:{" "}
                {config.bonus.map((w, i) => {
                  const parts = w.split("##");
                  const cleanKw = parts[0].trim();
                  const weight = parts.length > 1 ? parseFloat(parts[1]) : 1.0;
                  const label = !isNaN(weight) && weight !== 1.0 ? `${cleanKw} (${weight}x)` : cleanKw;
                  return (
                    <span
                      key={i}
                      className={`inline-block px-1 rounded mr-1 ${
                        matchedBonus.includes(w)
                          ? "bg-green-200/50 text-green-800 dark:bg-green-900/30 dark:text-green-350 font-bold"
                          : "bg-neutral-200/50 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                      }`}
                    >
                      {label}
                    </span>
                  );
                })}
              </p>
            )}

            {matchedForbidden.length > 0 && (
              <p className="text-red-650 font-bold">
                Forbidden words used: {matchedForbidden.join(", ")}
              </p>
            )}

            {!(config.required?.length || config.bonus?.length || config.forbidden?.length) && config.keywords && config.keywords.length > 0 && (
              <p>
                Keywords required (any):{" "}
                <code className="font-mono bg-white/40 px-1 rounded">{config.keywords.join(", ")}</code>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OpenQuestion;
