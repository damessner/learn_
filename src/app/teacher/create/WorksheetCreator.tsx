"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { randomUUID } from "@/lib/uuid";
import { createWorksheet } from "@/lib/actions/exercise";
import { ArrowLeft, HelpCircle, Crosshair, Sparkles, BookOpen, FileText, Volume2 } from "lucide-react";
import Link from "next/link";
import { WorksheetQuestionsBuilder } from "./components/WorksheetQuestionsBuilder";
import { ImageHotspotQuizBuilder } from "./components/ImageHotspotQuizBuilder";
import { InteractiveReadingBuilder } from "./components/InteractiveReadingBuilder";
import { VocabularyBuilder } from "./components/VocabularyBuilder";
import { WritingCoachBuilder, CreatorCriterion } from "./components/WritingCoachBuilder";
import { LiveQuizBuilder, LiveQuizQuestion } from "./components/LiveQuizBuilder";

interface CreatorQuestion {
  id: string;
  type:
    | "multiple-choice"
    | "gap-fill"
    | "categorization"
    | "drag-drop"
    | "clickable-choice"
    | "matching"
    | "media"
    | "instruction"
    | "open-question"
    | "ordering";
  question: string;
  media: string;
  mediaStatus: string;
  hint: string;
  options: string[];
  correctOptionIndex: number;
  text: string;
  categories: string;
  categorizationMap: Record<string, string>;
  choices: string;
  statements: string;
  matchingPairs: Array<{
    id: string;
    leftText: string;
    leftMedia: string;
    leftMediaStatus: string;
    rightText: string;
  }>;
  keywords: string; // comma list for open questions
  orderingSentence: string; // string sentence for ordering questions
  ttsEnabled?: boolean;
}

interface ImageHotspot {
  id: string;
  name: string;
  shape: "circle" | "rect";
  coords: number[]; // [cx, cy, r] or [x, y, w, h]
}

interface HotspotQuizTask {
  id: string;
  promptText: string;
  promptAudio: string;
  promptAudioStatus: string;
  targetHotspotId: string;
  targetHotspotIds?: string[];
}

interface ReadingPageCreator {
  id: string; // unique page Key
  title: string;
  text: string;
  media: string;
  mediaStatus: string;
  choices: Array<{
    text: string;
    nextPageId: string;
  }>;
  questions: Array<{
    id: string;
    type: "multiple-choice" | "open-question";
    prompt: string;
    options: string[];
    correctOptionIdx: number;
    keywords: string;
  }>;
  ttsEnabled?: boolean;
}

export default function WorksheetCreator({ initialData, initialDataJson, courses = [] }: { initialData?: Record<string, unknown>; initialDataJson?: string; courses?: { id: string; title: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");

  // Parse initial data from JSON string to avoid Next.js server→client nesting limit
  const parsedInitialData = initialDataJson ? JSON.parse(initialDataJson) : initialData;

  // Mode: "worksheet" (standard mixed) or "image-hotspot-quiz" or "interactive-reading"
  const [creatorMode, setCreatorMode] = useState<"worksheet" | "image-hotspot-quiz" | "interactive-reading" | "vocabulary" | "oral-vocabulary" | "writing-coach" | "live-quiz">(
    parsedInitialData
      ? (parsedInitialData.type === "image-hotspot-quiz"
          ? "image-hotspot-quiz"
          : parsedInitialData.type === "interactive-reading"
          ? "interactive-reading"
          : parsedInitialData.type === "vocabulary"
          ? "vocabulary"
          : parsedInitialData.type === "oral-vocabulary"
          ? "oral-vocabulary"
          : parsedInitialData.type === "writing-coach"
          ? "writing-coach"
          : parsedInitialData.type === "live-quiz"
          ? "live-quiz"
          : "worksheet")
      : (typeParam === "image-hotspot-quiz" || typeParam === "interactive-reading" || typeParam === "vocabulary" || typeParam === "oral-vocabulary" || typeParam === "writing-coach" || typeParam === "live-quiz"
          ? typeParam
          : "worksheet")
  );

  // Basic meta
  const [id, setId] = useState(parsedInitialData?.id || "");
  const [title, setTitle] = useState(parsedInitialData?.title || "");
  const [description, setDescription] = useState(parsedInitialData?.description || "");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [tags, setTags] = useState(
    parsedInitialData
      ? (Array.isArray(parsedInitialData.tags)
          ? parsedInitialData.tags.join(", ")
          : parsedInitialData.tags || "")
      : ""
  );
  const [badgeName, setBadgeName] = useState(parsedInitialData?.badgeName || "");
  const [badgeEmoji, setBadgeEmoji] = useState(parsedInitialData?.badgeEmoji || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vocabRawText, setVocabRawText] = useState(() => {
    if (parsedInitialData && (parsedInitialData.type === "vocabulary" || parsedInitialData.type === "oral-vocabulary") && Array.isArray(parsedInitialData.vocabList)) {
      return (parsedInitialData.vocabList as Array<Record<string, unknown>>)
        .map((item) => `${(item as Record<string, string>).word} = ${(item as Record<string, string>).translation}`)
        .join("\n");
    }
    return "";
  });

  const [vocabItems, setVocabItems] = useState<Array<{ word: string; translation: string; image?: string; ttsEnabled?: boolean; wordAudio?: string; translationAudio?: string }>>(() => {
    if (parsedInitialData && (parsedInitialData.type === "vocabulary" || parsedInitialData.type === "oral-vocabulary") && Array.isArray(parsedInitialData.vocabList)) {
      return (parsedInitialData.vocabList as Array<Record<string, unknown>>).map((item) => ({
        word: String(item.word || ""),
        translation: String(item.translation || ""),
        image: item.image ? String(item.image) : undefined,
        ttsEnabled: !!item.ttsEnabled,
        wordAudio: item.wordAudio ? String(item.wordAudio) : undefined,
        translationAudio: item.translationAudio ? String(item.translationAudio) : undefined,
      }));
    }
    return [];
  });

  const [vocabPictureSupplementation, setVocabPictureSupplementation] = useState<boolean>(() => {
    if (parsedInitialData && (parsedInitialData.type === "vocabulary" || parsedInitialData.type === "oral-vocabulary")) {
      return !!(parsedInitialData as Record<string, unknown>).pictureSupplementation;
    }
    return false;
  });

  const handleVocabRawTextChange = (newText: string) => {
    setVocabRawText(newText);
    const lines = newText.split("\n").map((line) => line.trim()).filter(Boolean);
    const parsedList = lines.map((line) => {
      const parts = line.split("=");
      const word = parts[0]?.trim() || "";
      const translation = parts[1]?.trim() || "";
      return { word, translation };
    }).filter((item) => item.word || item.translation);

    const reconciled = parsedList.map((parsed) => {
      const existing = vocabItems.find(
        (item) =>
          item.word.toLowerCase() === parsed.word.toLowerCase() &&
          item.translation.toLowerCase() === parsed.translation.toLowerCase()
      );
      return {
        word: parsed.word,
        translation: parsed.translation,
        image: existing?.image,
        ttsEnabled: existing?.ttsEnabled ?? false,
        wordAudio: existing?.wordAudio,
        translationAudio: existing?.translationAudio,
      };
    });
    setVocabItems(reconciled);
  };

  const [coachPrompt, setCoachPrompt] = useState<string>(
    parsedInitialData && parsedInitialData.type === "writing-coach"
      ? parsedInitialData.prompt || ""
      : ""
  );
  const [coachSystemPrompt, setCoachSystemPrompt] = useState<string>(
    parsedInitialData && parsedInitialData.type === "writing-coach"
      ? parsedInitialData.systemPrompt || ""
      : ""
  );
  const [coachCriteria, setCoachCriteria] = useState<CreatorCriterion[]>(
    parsedInitialData && parsedInitialData.type === "writing-coach" && Array.isArray(parsedInitialData.criteria)
      ? parsedInitialData.criteria
      : []
  );

  const [liveQuestions, setLiveQuestions] = useState<LiveQuizQuestion[]>(() => {
    if (parsedInitialData && parsedInitialData.type === "live-quiz" && Array.isArray(parsedInitialData.questions)) {
      return (parsedInitialData.questions as LiveQuizQuestion[]).map((q) => ({
        id: q.id || randomUUID(),
        type: q.type || "single-choice",
        questionText: q.questionText || "",
        timeLimit: q.timeLimit || 20,
        media: q.media || undefined,
        options: q.options || ["Option A", "Option B", "Option C", "Option D"],
        correctOptionIdx: q.correctOptionIdx ?? 0,
        correctOptionIndices: q.correctOptionIndices || [],
        words: q.words || ["The", "fox", "jumps"],
        acceptedAnswers: q.acceptedAnswers || ["Correct Answer"],
      }));
    }
    return [
      {
        id: randomUUID(),
        type: "single-choice",
        questionText: "",
        timeLimit: 20,
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctOptionIdx: 0,
        correctOptionIndices: [],
        words: ["The", "fox", "jumps"],
        acceptedAnswers: ["Correct Answer"],
      },
    ];
  });

  // Helper to map exercise data back to CreatorQuestion format
  const getInitialQuestions = (): CreatorQuestion[] => {
    if (parsedInitialData && parsedInitialData.type === "worksheet" && Array.isArray(parsedInitialData.questions)) {
      return (parsedInitialData.questions as Array<Record<string, unknown>>).map((q) => {
        const qRecord = q as Record<string, unknown>;
        const categorizationMap: Record<string, string> = {};
        const qCategories = qRecord.categories as string[] | undefined;
        const qItems = qRecord.items as Array<Record<string, unknown>> | undefined;
        if (qCategories && qItems) {
          qCategories.forEach((cat: string) => {
            const itemsOfCat = qItems
              .filter((item) => (item as Record<string, unknown>).category === cat)
              .map((item) => (item as Record<string, unknown>).name as string);
            categorizationMap[cat] = itemsOfCat.join(" ## ");
          });
        }

        const qStatements = qRecord.statements as Array<Record<string, unknown>> | undefined;
        const statements = qStatements
          ? qStatements.map((s) => `${s.text}##${s.correctChoice}`).join("\n")
          : "";

        const qPairs = qRecord.pairs as Array<Record<string, unknown>> | undefined;
        const matchingPairs = qPairs
          ? qPairs.map((p) => ({
              id: ((p as Record<string, unknown>).id as string) || randomUUID(),
              leftText: ((p as Record<string, unknown>).leftText as string) || "",
              leftMedia: ((p as Record<string, unknown>).leftMedia as string) || "",
              leftMediaStatus: (p as Record<string, unknown>).leftMedia ? "✓ Loaded" : "",
              rightText: ((p as Record<string, unknown>).rightText as string) || "",
            }))
          : [{ id: "initial-pair-1", leftText: "", leftMedia: "", leftMediaStatus: "", rightText: "" }];

        const qKeywords = qRecord.keywords as string[] | undefined;
        const keywords = qKeywords
          ? qKeywords.map((k: string) => `##${k}`).join(" ")
          : "";

        const qElements = qRecord.elements as string[] | undefined;
        const orderingSentence = qElements
          ? qElements.join(" ")
          : "";

        return {
          id: (qRecord.id as string) || randomUUID(),
          type: (qRecord.type as CreatorQuestion["type"]) || "multiple-choice",
          question: (qRecord.question as string) || "",
          media: (qRecord.media as string) || "",
          mediaStatus: qRecord.media ? "✓ Loaded" : "",
          hint: (qRecord.hint as string) || "",
          options: (qRecord.options as string[]) || ["", ""],
          correctOptionIndex: (qRecord.correctOptionIndex as number) ?? 0,
          text: (qRecord.text as string) || "",
          categories: qCategories ? qCategories.join(", ") : "",
          categorizationMap,
          choices: (qRecord.choices as string[]) ? (qRecord.choices as string[]).join(", ") : "",
          statements,
          matchingPairs,
          keywords,
          orderingSentence,
          ttsEnabled: !!qRecord.ttsEnabled,
        } as CreatorQuestion;
      });
    }

    return [
      {
        id: "initial-question-1",
        type: "multiple-choice",
        question: "",
        media: "",
        mediaStatus: "",
        hint: "",
        options: ["", ""],
        correctOptionIndex: 0,
        text: "",
        categories: "",
        categorizationMap: {},
        choices: "",
        statements: "",
        matchingPairs: [{ id: "initial-pair-1", leftText: "", leftMedia: "", leftMediaStatus: "", rightText: "" }],
        keywords: "",
        orderingSentence: "",
      },
    ];
  };

  // ----------------------------------------------------
  // STANDARD WORKSHEET MODE STATE
  // ----------------------------------------------------
  const [questions, setQuestions] = useState<CreatorQuestion[]>(getInitialQuestions());

  // ----------------------------------------------------
  // IMAGE HOTSPOT QUIZ MODE STATE
  // ----------------------------------------------------
  const [hotspotBg, setHotspotBg] = useState(
    parsedInitialData && parsedInitialData.type === "image-hotspot-quiz"
      ? parsedInitialData.backgroundImage || ""
      : ""
  );
  const [hotspotBgStatus, setHotspotBgStatus] = useState(
    parsedInitialData && parsedInitialData.type === "image-hotspot-quiz" && parsedInitialData.backgroundImage
      ? "✓ Loaded"
      : ""
  );
  const [shuffleHotspotTasks, setShuffleHotspotTasks] = useState<boolean>(
    parsedInitialData && parsedInitialData.type === "image-hotspot-quiz"
      ? !!parsedInitialData.shuffleTasks
      : false
  );
  const [hotspots, setHotspots] = useState<ImageHotspot[]>(
    parsedInitialData && parsedInitialData.type === "image-hotspot-quiz"
      ? parsedInitialData.hotspots || []
      : []
  );
  const [hotspotTasks, setHotspotTasks] = useState<HotspotQuizTask[]>(
    parsedInitialData && parsedInitialData.type === "image-hotspot-quiz" && Array.isArray(parsedInitialData.tasks)
      ? (parsedInitialData.tasks as Array<Record<string, unknown>>).map((t) => ({
          id: t.id as string,
          promptText: (t.promptText as string) || "",
          promptAudio: (t.promptAudio as string) || "",
          promptAudioStatus: t.promptAudio ? "✓ Loaded" : "",
          targetHotspotId: (t.targetHotspotId as string) || "",
          targetHotspotIds: (t.targetHotspotIds as string[]) || (t.targetHotspotId ? [t.targetHotspotId as string] : []),
        }))
      : []
  );

  // Helper to map reading pages
  const getInitialReadingPages = (): ReadingPageCreator[] => {
    if (parsedInitialData && parsedInitialData.type === "interactive-reading" && parsedInitialData.pages) {
      return Object.entries(parsedInitialData.pages as Record<string, unknown>).map(([key, page]) => {
        const p = page as Record<string, unknown>;
        return {
          id: key,
          title: (p.title as string) || "",
          text: (p.text as string) || "",
          media: (p.media as string) || "",
          mediaStatus: p.media ? "✓ Loaded" : "",
          choices: (p.choices as ReadingPageCreator["choices"]) || [],
          ttsEnabled: !!p.ttsEnabled,
          questions: ((p.questions as Array<Record<string, unknown>>) || []).map((q) => ({
            id: q.id as string,
            type: q.type as string,
            prompt: (q.prompt as string) || "",
            options: (q.options as string[]) || ["", ""],
            correctOptionIdx: (q.correctOptionIdx as number) ?? 0,
            keywords: q.type === "open-question" ? ((q.keywords as string[]) || []).map((k: string) => `##${k}`).join(" ") : "",
          })),
        } as ReadingPageCreator;
      });
    }

    return [
      {
        id: "intro",
        title: "Introduction",
        text: "Welcome to this choose your own adventure story book!",
        media: "",
        mediaStatus: "",
        choices: [],
        questions: [],
      },
    ];
  };

  // ----------------------------------------------------
  // INTERACTIVE READING MODE STATE
  // ----------------------------------------------------
  const [readingPages, setReadingPages] = useState<ReadingPageCreator[]>(getInitialReadingPages());
  const [startPageId, setStartPageId] = useState(
    parsedInitialData && parsedInitialData.type === "interactive-reading"
      ? parsedInitialData.startPage || "intro"
      : "intro"
  );

  // Hotspot Drawer temporary state — used by ImageHotspotQuizBuilder internally
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [clickedCoords, setClickedCoords] = useState<[number, number] | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [newHsName, setNewHsName] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [newHsShape, setNewHsShape] = useState<"circle" | "rect">("circle");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [newHsRadius, setNewHsRadius] = useState(6);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [newHsWidth, setNewHsWidth] = useState(12);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [newHsHeight, setNewHsHeight] = useState(12);

  // ----------------------------------------------------
  // SHARED HANDLERS
  // ----------------------------------------------------
  const handleMediaUpload = async (
    file: File,
    onUploaded: (filename: string) => void,
    onStatus: (status: string) => void
  ) => {
    if (!id.trim()) {
      onStatus("❌ Enter Worksheet ID first!");
      alert("Please specify the Worksheet ID at the top of the form before uploading media.");
      return;
    }
    onStatus("Uploading...");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/exercises/${id.toLowerCase().trim()}/assets/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        onStatus(`❌ Upload failed: ${errText}`);
      } else {
        const data = await res.json();
        onUploaded(data.filepath || file.name);
        onStatus(`✓ Uploaded: ${data.filepath}`);
      }
    } catch {
      onStatus("❌ Upload failed");
    }
  };

  // ----------------------------------------------------
  // SUBMISSION LOGIC
  // ----------------------------------------------------
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !title.trim()) return;

    setLoading(true);
    setError(null);

    try {
      let contentString = "";

      if (creatorMode === "image-hotspot-quiz") {
        if (!hotspotBg) {
          throw new Error("Please upload a background image for the Hotspot Quiz.");
        }
        if (hotspots.length === 0) {
          throw new Error("Please define at least one hotspot zone on the background image.");
        }
        if (hotspotTasks.length === 0) {
          throw new Error("Please add at least one prompt task to resolve.");
        }
        hotspotTasks.forEach((t, idx) => {
          if (!t.promptText.trim() && !t.promptAudio) {
            throw new Error(`Prompt ${idx + 1}: Please enter a question prompt or upload audio.`);
          }
          const hasHotspots = (t.targetHotspotIds && t.targetHotspotIds.length > 0) || t.targetHotspotId;
          if (!hasHotspots) {
            throw new Error(`Prompt ${idx + 1}: Please mark at least one hotspot area.`);
          }
        });

        contentString = JSON.stringify({
          backgroundImage: hotspotBg,
          shuffleTasks: shuffleHotspotTasks,
          hotspots: hotspots.map((h) => ({
            id: h.id,
            name: h.name,
            shape: h.shape,
            coords: h.coords,
          })),
          tasks: hotspotTasks.map((t) => {
            const firstId = t.targetHotspotIds?.[0] || t.targetHotspotId || "";
            return {
              id: t.id,
              promptText: t.promptText.trim(),
              promptAudio: t.promptAudio.trim() || undefined,
              targetHotspotId: firstId,
              targetHotspotIds: t.targetHotspotIds || (firstId ? [firstId] : []),
            };
          }),
        });
      } else if (creatorMode === "interactive-reading") {
        if (readingPages.length === 0) {
          throw new Error("Please add at least one page to the interactive book.");
        }
        const pageIds = readingPages.map((p) => p.id.trim()).filter(Boolean);
        if (!pageIds.includes(startPageId.trim())) {
          throw new Error(`Start Page ID "${startPageId}" does not match any defined Page Key.`);
        }

        const pagesObj: Record<string, unknown> = {};

        readingPages.forEach((p, pIdx) => {
          const key = p.id.trim();
          if (!key) throw new Error(`Page ${pIdx + 1}: Page Key is required.`);
          if (pagesObj[key]) throw new Error(`Page ${pIdx + 1}: Duplicate Page Key "${key}".`);
          if (!p.text.trim()) throw new Error(`Page "${key}": Text content is required.`);

          // Validate choices
          const formattedChoices = p.choices.map((c, cIdx) => {
            if (!c.text.trim()) throw new Error(`Page "${key}" Path ${cIdx + 1}: Path text is required.`);
            if (!c.nextPageId.trim()) throw new Error(`Page "${key}" Path ${cIdx + 1}: Target Page Key is required.`);
            return {
              text: c.text.trim(),
              nextPageId: c.nextPageId.trim(),
            };
          });

          // Validate questions
          const formattedQuestions = p.questions.map((q, qIdx) => {
            const indexStr = `Page "${key}" Task ${qIdx + 1}`;
            if (!q.prompt.trim()) throw new Error(`${indexStr}: Task prompt is required.`);

            const base: Record<string, unknown> = {
              id: q.id,
              type: q.type,
              prompt: q.prompt.trim(),
            };

            if (q.type === "multiple-choice") {
              const filteredOpts = q.options.filter((o) => o.trim());
              if (filteredOpts.length < 2) throw new Error(`${indexStr}: Must provide at least 2 options.`);
              base.options = filteredOpts;
              base.correctOptionIdx = q.correctOptionIdx;
            } else if (q.type === "open-question") {
              const kws = q.keywords
                .split("##")
                .map((k) => k.trim())
                .filter(Boolean);
              if (kws.length === 0) throw new Error(`${indexStr}: Enter at least one correct keyword separated by ##.`);
              base.keywords = kws;
            }
            return base;
          });

          pagesObj[key] = {
            title: p.title.trim() || undefined,
            text: p.text.trim(),
            media: p.media.trim() || undefined,
            choices: formattedChoices,
            questions: formattedQuestions,
            ttsEnabled: p.ttsEnabled,
          };
        });

        contentString = JSON.stringify({
          startPage: startPageId.trim(),
          pages: pagesObj,
        });
      } else if (creatorMode === "vocabulary" || creatorMode === "oral-vocabulary") {
        const lines = vocabRawText.split("\n").map((line: string) => line.trim()).filter(Boolean);
        if (lines.length === 0) {
          throw new Error("Please enter at least one vocabulary word pair (e.g. apple = Apfel).");
        }

        const finalVocabList: Array<{
          word: string;
          translation: string;
          image?: string;
          ttsEnabled?: boolean;
          wordAudio?: string;
          translationAudio?: string;
        }> = [];
        lines.forEach((line: string, lIdx: number) => {
          const parts = line.split("=");
          if (parts.length < 2) {
            throw new Error(`Line ${lIdx + 1}: Word pair must have an equals sign (e.g. word = translation).`);
          }
          const word = parts[0].trim();
          const translation = parts[1].trim();

          if (!word || !translation) {
            throw new Error(`Line ${lIdx + 1}: Both the source word and translation must be specified.`);
          }

          const matchedItem = vocabItems.find(
            (item) =>
              item.word.toLowerCase() === word.toLowerCase() &&
              item.translation.toLowerCase() === translation.toLowerCase()
          );

          finalVocabList.push({
            word,
            translation,
            image: matchedItem?.image || undefined,
            ttsEnabled: matchedItem?.ttsEnabled,
            wordAudio: matchedItem?.wordAudio,
            translationAudio: matchedItem?.translationAudio,
          });
        });

        contentString = JSON.stringify({
          vocabList: finalVocabList,
          pictureSupplementation: vocabPictureSupplementation,
        });
      } else if (creatorMode === "writing-coach") {
        if (!coachPrompt.trim()) {
          throw new Error("Writing prompt is required.");
        }
        const formattedCriteria = coachCriteria.filter((c) => c.name.trim() && c.description.trim());
        if (formattedCriteria.length === 0) {
          throw new Error("Please add at least one feedback goal.");
        }
        contentString = JSON.stringify({
          prompt: coachPrompt.trim(),
          systemPrompt: coachSystemPrompt.trim() || undefined,
          criteria: formattedCriteria.map((c) => ({
            id: c.id,
            name: c.name.trim(),
            description: c.description.trim(),
            tip: c.tip?.trim() || undefined,
          })),
        });
      } else if (creatorMode === "live-quiz") {
        if (liveQuestions.length === 0) {
          throw new Error("Please add at least one question to the Live Quiz.");
        }

        const formattedQuestions = liveQuestions.map((q, idx) => {
          const indexStr = `Question ${idx + 1}`;
          if (!q.questionText.trim()) {
            throw new Error(`${indexStr}: Question text is required.`);
          }

          const base: Record<string, unknown> = {
            id: q.id,
            type: q.type,
            questionText: q.questionText.trim(),
            timeLimit: q.timeLimit,
          };

          if (q.media?.trim()) {
            base.media = q.media.trim();
          }

          if (q.type === "single-choice") {
            const opts = q.options.map((o) => o.trim()).filter(Boolean);
            if (opts.length < 2) {
              throw new Error(`${indexStr}: Please add at least 2 options for Single Choice.`);
            }
            base.options = opts;
            base.correctOptionIdx = q.correctOptionIdx;
          } else if (q.type === "multiple-choice") {
            const opts = q.options.map((o) => o.trim()).filter(Boolean);
            if (opts.length < 2) {
              throw new Error(`${indexStr}: Please add at least 2 options for Multiple Choice.`);
            }
            if (q.correctOptionIndices.length === 0) {
              throw new Error(`${indexStr}: Please select at least one correct option.`);
            }
            base.options = opts;
            base.correctOptionIndices = q.correctOptionIndices;
          } else if (q.type === "word-ordering") {
            if (q.words.length < 2) {
              throw new Error(`${indexStr}: Please specify at least 2 words to order.`);
            }
            base.words = q.words;
          } else if (q.type === "text-input") {
            const ans = q.acceptedAnswers.map((a) => a.trim()).filter(Boolean);
            if (ans.length === 0) {
              throw new Error(`${indexStr}: Please enter at least one accepted answer.`);
            }
            base.acceptedAnswers = ans;
          }

          return base;
        });

        contentString = JSON.stringify({
          questions: formattedQuestions,
        });
      } else {
        if (questions.length === 0) {
          throw new Error("Please add at least one task to the worksheet.");
        }

        const formattedQuestions = questions.map((q, idx) => {
          const indexStr = `Question ${idx + 1}`;

          const base: Record<string, unknown> = {
            id: q.id,
            type: q.type,
            question: q.question.trim(),
          };

          if (q.ttsEnabled) base.ttsEnabled = true;
          if (q.media.trim()) base.media = q.media.trim();
          if (q.hint.trim()) base.hint = q.hint.trim();

          if (q.type === "multiple-choice") {
            if (!q.question.trim()) throw new Error(`${indexStr}: Question text is required.`);
            const filteredOptions = q.options.filter((opt) => opt.trim());
            if (filteredOptions.length < 2) throw new Error(`${indexStr}: Must provide at least 2 options.`);
            return {
              ...base,
              options: filteredOptions,
              correctOptionIndex: q.correctOptionIndex,
            };
          } else if (q.type === "gap-fill" || q.type === "drag-drop") {
            if (!q.question.trim()) throw new Error(`${indexStr}: Instructions prompt is required.`);
            if (!q.text.trim()) throw new Error(`${indexStr}: Text with gaps is required.`);
            return {
              ...base,
              text: q.text.trim(),
            };
          } else if (q.type === "categorization") {
            if (!q.question.trim()) throw new Error(`${indexStr}: Instructions prompt is required.`);
            const categories = q.categories
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean);

            if (categories.length < 2) throw new Error(`${indexStr}: Enter at least 2 categories.`);

            const items: Array<{ id: string; name: string; category: string }> = [];
            categories.forEach((cat) => {
              const itemsString = q.categorizationMap[cat] || "";
              const parsedItems = itemsString
                .split("##")
                .map((i) => i.trim())
                .filter(Boolean);

              parsedItems.forEach((name) => {
                items.push({
                  id: randomUUID(),
                  name,
                  category: cat,
                });
              });
            });

            if (items.length === 0) throw new Error(`${indexStr}: Please list at least one sorting item.`);
            return {
              ...base,
              categories,
              items,
            };
          } else if (q.type === "clickable-choice") {
            if (!q.question.trim()) throw new Error(`${indexStr}: Instructions prompt is required.`);
            const choices = q.choices
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean);

            if (choices.length < 2) throw new Error(`${indexStr}: Enter at least 2 choices.`);

            const lines = q.statements.split("\n").filter((l) => l.trim());
            if (lines.length === 0) throw new Error(`${indexStr}: Please add statements in Statement##Choice format.`);

            const statements = lines.map((line, lIdx) => {
              const parts = line.split("##");
              if (parts.length < 2) throw new Error(`${indexStr} Line ${lIdx + 1}: Must be Statement##Choice.`);
              const correctChoice = parts[1].trim();

              if (!choices.includes(correctChoice)) {
                throw new Error(`${indexStr} Line ${lIdx + 1}: Correct choice "${correctChoice}" is not in choices list.`);
              }

              return {
                id: randomUUID(),
                text: parts[0].trim(),
                correctChoice,
              };
            });

            return {
              ...base,
              choices,
              statements,
            };
          } else if (q.type === "matching") {
            if (!q.question.trim()) throw new Error(`${indexStr}: Instructions prompt is required.`);
            const validPairs = q.matchingPairs.filter((p) => p.rightText.trim() && (p.leftText.trim() || p.leftMedia.trim()));
            if (validPairs.length < 2) throw new Error(`${indexStr}: Provide at least 2 matching pairs.`);
            return {
              ...base,
              pairs: validPairs.map((p) => ({
                id: p.id,
                leftText: p.leftText.trim() || undefined,
                leftMedia: p.leftMedia.trim() || undefined,
                rightText: p.rightText.trim(),
              })),
            };
          } else if (q.type === "media") {
            if (!q.media.trim()) throw new Error(`${indexStr}: Please upload or specify a media file.`);
            return {
              id: q.id,
              type: "media",
              media: q.media.trim(),
            };
          } else if (q.type === "instruction") {
            if (!q.text.trim()) throw new Error(`${indexStr}: Instruction text cannot be empty.`);
            return {
              id: q.id,
              type: "instruction",
              text: q.text.trim(),
            };
          } else if (q.type === "open-question") {
            if (!q.question.trim()) throw new Error(`${indexStr}: Question text is required.`);
            const keywords = q.keywords
              .split("##")
              .map((k) => k.trim())
              .filter(Boolean);

            return {
              ...base,
              keywords,
            };
          } else if (q.type === "ordering") {
            if (!q.question.trim()) throw new Error(`${indexStr}: Question instruction is required.`);
            const elements = q.orderingSentence
              .split(" ")
              .map((e) => e.trim())
              .filter(Boolean);

            if (elements.length < 2) throw new Error(`${indexStr}: Sentence must have at least 2 words.`);
            return {
              ...base,
              elements,
            };
          }

          return base;
        });

        contentString = JSON.stringify({ questions: formattedQuestions });
      }

      const res = await createWorksheet(
        id.toLowerCase().trim(),
        creatorMode,
        title,
        description,
        contentString,
        !!parsedInitialData,
        selectedCourseId || null,
        tags,
        badgeName.trim(),
        badgeEmoji.trim()
      );

      if (res?.error) {
        setError(res.error);
      } else {
        router.push("/teacher");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <Link
            href="/teacher"
            className="flex items-center gap-1 text-xs font-semibold uppercase font-mono text-neutral-500 hover:text-black dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="text-sm font-bold font-mono uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
            {parsedInitialData ? `✍️ Editing: ${parsedInitialData.id}` : "🆕 Create New Exercise"}
          </span>
        </div>
        {!parsedInitialData && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreatorMode("worksheet")}
              className={`px-3 py-1 text-xs font-semibold uppercase font-mono rounded border transition ${
                creatorMode === "worksheet"
                  ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                  : "border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              Mixed Worksheet
            </button>
            <button
              type="button"
              onClick={() => setCreatorMode("image-hotspot-quiz")}
              className={`px-3 py-1 text-xs font-semibold uppercase font-mono rounded border transition flex items-center gap-1 ${
                creatorMode === "image-hotspot-quiz"
                  ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                  : "border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
              Image Hotspot Quiz
            </button>
            <button
              type="button"
              onClick={() => setCreatorMode("interactive-reading")}
              className={`px-3 py-1 text-xs font-semibold uppercase font-mono rounded border transition flex items-center gap-1 ${
                creatorMode === "interactive-reading"
                  ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                  : "border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              Interactive Reading
            </button>
            <button
              type="button"
              onClick={() => setCreatorMode("vocabulary")}
              className={`px-3 py-1 text-xs font-semibold uppercase font-mono rounded border transition flex items-center gap-1 ${
                creatorMode === "vocabulary"
                  ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                  : "border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-green-500" />
              Vocabulary Practice
            </button>
            <button
              type="button"
              onClick={() => setCreatorMode("oral-vocabulary")}
              className={`px-3 py-1 text-xs font-semibold uppercase font-mono rounded border transition flex items-center gap-1 ${
                creatorMode === "oral-vocabulary"
                  ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                  : "border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              <Volume2 className="w-3.5 h-3.5 text-blue-500" />
              Oral Vocabulary Quiz
            </button>
            <button
              type="button"
              onClick={() => setCreatorMode("writing-coach")}
              className={`px-3 py-1 text-xs font-semibold uppercase font-mono rounded border transition flex items-center gap-1 ${
                creatorMode === "writing-coach"
                  ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                  : "border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-500 animate-pulse" />
              AI Writing Coach
            </button>
            <button
              type="button"
              onClick={() => setCreatorMode("live-quiz")}
              className={`px-3 py-1 text-xs font-semibold uppercase font-mono rounded border transition flex items-center gap-1 ${
                creatorMode === "live-quiz"
                  ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                  : "border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-purple-500" />
              Live Quiz
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Block */}
          <div className="border p-6 rounded bg-white dark:bg-neutral-900 shadow-sm space-y-4">
            <h2 className="text-sm font-bold font-mono uppercase tracking-wide border-b pb-2">
              Worksheet Specifications
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Worksheet Key (kebab-case)
                </label>
                <input
                  type="text"
                  required
                  disabled={!!parsedInitialData}
                  placeholder="e.g. math-decimals-1"
                  value={id}
                  onChange={(e) => setId(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                  className="w-full text-base border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white font-mono disabled:opacity-60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Quiz Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Decimals & Fractions quiz"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-base border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Classroom Directions
              </label>
              <textarea
                placeholder="Give general directions for this worksheet..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full text-base border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Tags (comma-separated, optional)
              </label>
              <input
                type="text"
                placeholder="e.g. spelling, vocabulary, verbs"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full text-base border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Custom Badge Name (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Decimal Master (defaults to quiz title)"
                  value={badgeName}
                  onChange={(e) => setBadgeName(e.target.value)}
                  className="w-full text-base border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Custom Badge Emoji (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 💡 (defaults to 🏆)"
                  value={badgeEmoji}
                  onChange={(e) => setBadgeEmoji(e.target.value)}
                  className="w-full text-base border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
                />
              </div>
            </div>

            {courses.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Course (optional)
                </label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full text-base border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-white dark:bg-neutral-900 outline-none focus:border-black dark:focus:border-white"
                >
                  <option value="">— No course (standalone) —</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {creatorMode === "worksheet" && (
            <WorksheetQuestionsBuilder
              exerciseId={id}
              questions={questions}
              setQuestions={setQuestions}
              handleMediaUpload={handleMediaUpload}
            />
          )}

          {creatorMode === "image-hotspot-quiz" && (
            <ImageHotspotQuizBuilder
              id={id}
              hotspotBg={hotspotBg}
              setHotspotBg={setHotspotBg}
              hotspotBgStatus={hotspotBgStatus}
              setHotspotBgStatus={setHotspotBgStatus}
              hotspots={hotspots}
              setHotspots={setHotspots}
              hotspotTasks={hotspotTasks}
              setHotspotTasks={setHotspotTasks}
              shuffleTasks={shuffleHotspotTasks}
              setShuffleTasks={setShuffleHotspotTasks}
              handleMediaUpload={handleMediaUpload}
            />
          )}

          {creatorMode === "interactive-reading" && (
            <InteractiveReadingBuilder
              id={id}
              readingPages={readingPages}
              setReadingPages={setReadingPages}
              startPageId={startPageId}
              setStartPageId={setStartPageId}
              handleMediaUpload={handleMediaUpload}
            />
          )}

          {(creatorMode === "vocabulary" || creatorMode === "oral-vocabulary") && (
            <VocabularyBuilder
              exerciseId={id}
              vocabRawText={vocabRawText}
              setVocabRawText={handleVocabRawTextChange}
              vocabItems={vocabItems}
              setVocabItems={setVocabItems}
              pictureSupplementation={vocabPictureSupplementation}
              setPictureSupplementation={setVocabPictureSupplementation}
              handleMediaUpload={handleMediaUpload}
              isOralVocabulary={creatorMode === "oral-vocabulary"}
            />
          )}

          {creatorMode === "writing-coach" && (
            <WritingCoachBuilder
              coachPrompt={coachPrompt}
              setCoachPrompt={setCoachPrompt}
              coachSystemPrompt={coachSystemPrompt}
              setCoachSystemPrompt={setCoachSystemPrompt}
              coachCriteria={coachCriteria}
              setCoachCriteria={setCoachCriteria}
            />
          )}

          {creatorMode === "live-quiz" && (
            <LiveQuizBuilder
              questions={liveQuestions}
              setQuestions={setLiveQuestions}
            />
          )}
        </div>

        {/* Sidebar Info/Submit Column */}
        <div className="space-y-6">
          {/* Syntax Tips Panel */}
          <div className="p-5 bg-neutral-50 dark:bg-neutral-950/40 border rounded text-xs space-y-4 text-neutral-600 dark:text-neutral-400">
            <h4 className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1 border-b pb-2">
              <HelpCircle className="w-3.5 h-3.5 text-neutral-500" />
              Creator Assistance
            </h4>

            {creatorMode === "worksheet" ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    Write Into Gap syntax:
                  </span>
                  <p className="leading-relaxed">
                    Wrap gaps in double brackets: <code>&lt;&lt;ran&gt;&gt;</code>. Add options separated by <code>##</code>: <code>&lt;&lt;is##was##were&gt;&gt;</code> (first item is correct).
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    Open Question keywords:
                  </span>
                  <p className="leading-relaxed">
                    Specify keywords using <code>##keyword</code>. Example: <code>##apple ##red ##fruit</code>. Correct if the text contains any keyword.
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    Solely Media tasks:
                  </span>
                  <p className="leading-relaxed">
                    Insert images or audios directly into the quiz timeline. Counts as 0 points.
                  </p>
                </div>
              </div>
            ) : creatorMode === "image-hotspot-quiz" ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block flex items-center gap-1">
                    <Crosshair className="w-3.5 h-3.5 text-red-500" />
                    How to map coordinates:
                  </span>
                  <p className="leading-relaxed">
                    1. Upload an image file.<br />
                    2. Click anywhere on the preview picture canvas.<br />
                    3. A red locator dot will appear. Fill in the label name (e.g. <code>fridge</code>) and radius, then click &ldquo;Save Zone&rdquo;.
                  </p>
                </div>
              </div>
            ) : creatorMode === "interactive-reading" ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    CYOA Storybook Setup:
                  </span>
                  <p className="leading-relaxed">
                    Define multiple scene pages. Each page has text story and optional image media.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    Page Tasks Lock:
                  </span>
                  <p className="leading-relaxed">
                    Add MC or keyword open questions on a page. The student must solve them to unlock the path choices.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    Choices & Paths:
                  </span>
                  <p className="leading-relaxed">
                    Connect choices to other page keys to create branches. If no choices are defined, it serves as a story ending.
                  </p>
                </div>
              </div>
            ) : (creatorMode === "vocabulary" || creatorMode === "oral-vocabulary") ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    {creatorMode === "oral-vocabulary" ? "Oral Quiz Setup:" : "Vocabulary Setup:"}
                  </span>
                  <p className="leading-relaxed">
                    Copy and paste list in the format <code>word = translation</code> (e.g. <code>apple = Apfel</code>), one pair per line.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    {creatorMode === "oral-vocabulary" ? "Audio Translation Test:" : "Tiered Study Loop:"}
                  </span>
                  <p className="leading-relaxed">
                    {creatorMode === "oral-vocabulary"
                      ? "Pupils hear the German audio automatically generated for the translation (e.g. Apfel) and translate to and write the English word (apple)."
                      : "Generates recognition flashcards, multiple-choice options, and spelling stages for pupils."}
                  </p>
                </div>
              </div>
            ) : creatorMode === "writing-coach" ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    Writing Coach Setup:
                  </span>
                  <p className="leading-relaxed">
                    Enter the student writing prompt instructions, optional coach context, and add goal check criteria.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    Socratic Loop:
                  </span>
                  <p className="leading-relaxed">
                    Students write multiple drafts and request formative suggestions on criteria checks powered by Google Gemini.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    Live Quiz Setup:
                  </span>
                  <p className="leading-relaxed">
                    Create Kahoot-like quiz questions. Supports choice, word ordering, and text inputs.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    Hosting live:
                  </span>
                  <p className="leading-relaxed">
                    Click &ldquo;Host Live&rdquo; on the teacher dashboard to launch the real-time session, generate a PIN, and share it with students.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-350 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !id.trim() || !title.trim()}
            className="w-full bg-black text-white dark:bg-white dark:text-black font-semibold font-mono text-xs py-3 rounded uppercase tracking-wider hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow"
          >
            {loading
              ? parsedInitialData
                ? "Saving Changes..."
                : "Writing Worksheet..."
              : parsedInitialData
              ? "Save Changes"
              : "Register Worksheet"}
          </button>
        </div>
      </form>
    </div>
  );
}
