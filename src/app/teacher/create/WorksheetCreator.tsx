"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createWorksheet, uploadMedia } from "@/app/actions";
import { ArrowLeft, HelpCircle, Plus, Trash, Upload, Crosshair, Sparkles, X, BookOpen, FileText } from "lucide-react";
import Link from "next/link";

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
}

export default function WorksheetCreator({ initialData, initialDataJson, courses = [] }: { initialData?: any; initialDataJson?: string; courses?: { id: string; title: string }[] }) {
  const router = useRouter();

  // Parse initial data from JSON string to avoid Next.js server→client nesting limit
  const parsedInitialData = initialDataJson ? JSON.parse(initialDataJson) : initialData;

  // Mode: "worksheet" (standard mixed) or "image-hotspot-quiz" or "interactive-reading"
  const [creatorMode, setCreatorMode] = useState<"worksheet" | "image-hotspot-quiz" | "interactive-reading" | "vocabulary">(
    parsedInitialData
      ? (parsedInitialData.type === "image-hotspot-quiz"
          ? "image-hotspot-quiz"
          : parsedInitialData.type === "interactive-reading"
          ? "interactive-reading"
          : parsedInitialData.type === "vocabulary"
          ? "vocabulary"
          : "worksheet")
      : "worksheet"
  );

  // Basic meta
  const [id, setId] = useState(parsedInitialData?.id || "");
  const [title, setTitle] = useState(parsedInitialData?.title || "");
  const [description, setDescription] = useState(parsedInitialData?.description || "");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vocabRawText, setVocabRawText] = useState(() => {
    if (parsedInitialData && parsedInitialData.type === "vocabulary" && Array.isArray(parsedInitialData.vocabList)) {
      return parsedInitialData.vocabList
        .map((item: any) => `${item.word} = ${item.translation}`)
        .join("\n");
    }
    return "";
  });

  // Helper to map exercise data back to CreatorQuestion format
  const getInitialQuestions = (): CreatorQuestion[] => {
    if (parsedInitialData && parsedInitialData.type === "worksheet" && Array.isArray(parsedInitialData.questions)) {
      return parsedInitialData.questions.map((q: any) => {
        const categorizationMap: Record<string, string> = {};
        if (q.categories && q.items) {
          q.categories.forEach((cat: string) => {
            const itemsOfCat = q.items
              .filter((item: any) => item.category === cat)
              .map((item: any) => item.name);
            categorizationMap[cat] = itemsOfCat.join(" ## ");
          });
        }

        const statements = q.statements
          ? q.statements.map((s: any) => `${s.text}##${s.correctChoice}`).join("\n")
          : "";

        const matchingPairs = q.pairs
          ? q.pairs.map((p: any) => ({
              id: p.id || Math.random().toString(36).substring(7),
              leftText: p.leftText || "",
              leftMedia: p.leftMedia || "",
              leftMediaStatus: p.leftMedia ? "✓ Loaded" : "",
              rightText: p.rightText || "",
            }))
          : [{ id: "initial-pair-1", leftText: "", leftMedia: "", leftMediaStatus: "", rightText: "" }];

        const keywords = q.keywords
          ? q.keywords.map((k: string) => `##${k}`).join(" ")
          : "";

        const orderingSentence = q.elements
          ? q.elements.join(" ")
          : "";

        return {
          id: q.id || Math.random().toString(36).substring(7),
          type: q.type || "multiple-choice",
          question: q.question || "",
          media: q.media || "",
          mediaStatus: q.media ? "✓ Loaded" : "",
          hint: q.hint || "",
          options: q.options || ["", ""],
          correctOptionIndex: q.correctOptionIndex ?? 0,
          text: q.text || "",
          categories: q.categories ? q.categories.join(", ") : "",
          categorizationMap,
          choices: q.choices ? q.choices.join(", ") : "",
          statements,
          matchingPairs,
          keywords,
          orderingSentence,
        };
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
  const [hotspots, setHotspots] = useState<ImageHotspot[]>(
    parsedInitialData && parsedInitialData.type === "image-hotspot-quiz"
      ? parsedInitialData.hotspots || []
      : []
  );
  const [hotspotTasks, setHotspotTasks] = useState<HotspotQuizTask[]>(
    parsedInitialData && parsedInitialData.type === "image-hotspot-quiz" && Array.isArray(parsedInitialData.tasks)
      ? parsedInitialData.tasks.map((t: any) => ({
          id: t.id,
          promptText: t.promptText || "",
          promptAudio: t.promptAudio || "",
          promptAudioStatus: t.promptAudio ? "✓ Loaded" : "",
          targetHotspotId: t.targetHotspotId || "",
        }))
      : []
  );

  // Helper to map reading pages
  const getInitialReadingPages = (): ReadingPageCreator[] => {
    if (parsedInitialData && parsedInitialData.type === "interactive-reading" && parsedInitialData.pages) {
      return Object.entries(parsedInitialData.pages).map(([key, page]: [string, any]) => ({
        id: key,
        title: page.title || "",
        text: page.text || "",
        media: page.media || "",
        mediaStatus: page.media ? "✓ Loaded" : "",
        choices: page.choices || [],
        questions: (page.questions || []).map((q: any) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt || "",
          options: q.options || ["", ""],
          correctOptionIdx: q.correctOptionIdx ?? 0,
          keywords: q.type === "open-question" ? (q.keywords || []).map((k: string) => `##${k}`).join(" ") : "",
        })),
      }));
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

  // Hotspot Drawer temporary state
  const [clickedCoords, setClickedCoords] = useState<[number, number] | null>(null);
  const [newHsName, setNewHsName] = useState("");
  const [newHsShape, setNewHsShape] = useState<"circle" | "rect">("circle");
  const [newHsRadius, setNewHsRadius] = useState(6);
  const [newHsWidth, setNewHsWidth] = useState(12);
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
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const res = await uploadMedia(id.toLowerCase().trim(), file.name, base64);
        if (res?.error) {
          onStatus(`❌ ${res.error}`);
        } else {
          onUploaded(res.filepath || file.name);
          onStatus(`✓ Uploaded: ${res.filepath}`);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      onStatus("❌ Upload failed");
    }
  };

  // ----------------------------------------------------
  // MIXED STANDARD HANDLERS
  // ----------------------------------------------------
  const addQuestion = (type: CreatorQuestion["type"]) => {
    setQuestions((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        type,
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
        matchingPairs: [{ id: Math.random().toString(36).substring(7), leftText: "", leftMedia: "", leftMediaStatus: "", rightText: "" }],
        keywords: "",
        orderingSentence: "",
      },
    ]);
  };

  const removeQuestion = (qId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  const updateQuestion = (qId: string, fields: Partial<CreatorQuestion>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, ...fields } : q))
    );
  };

  const updateCategorizationMap = (qId: string, category: string, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === qId) {
          return {
            ...q,
            categorizationMap: {
              ...q.categorizationMap,
              [category]: value,
            },
          };
        }
        return q;
      })
    );
  };

  // ----------------------------------------------------
  // IMAGE HOTSPOT HANDLERS
  // ----------------------------------------------------
  const handleCanvasClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(1));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(1));
    setClickedCoords([x, y]);
  };

  const saveHotspot = () => {
    if (!clickedCoords || !newHsName.trim()) return;

    let coords: number[] = [];
    if (newHsShape === "circle") {
      coords = [clickedCoords[0], clickedCoords[1], newHsRadius];
    } else {
      coords = [clickedCoords[0] - newHsWidth / 2, clickedCoords[1] - newHsHeight / 2, newHsWidth, newHsHeight];
    }

    setHotspots((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        name: newHsName.trim(),
        shape: newHsShape,
        coords,
      },
    ]);

    // Reset drawer state
    setNewHsName("");
    setClickedCoords(null);
  };

  const removeHotspot = (hsId: string) => {
    setHotspots((prev) => prev.filter((h) => h.id !== hsId));
    setHotspotTasks((prev) => prev.map((t) => t.targetHotspotId === hsId ? { ...t, targetHotspotId: "" } : t));
  };

  const addHotspotTask = () => {
    setHotspotTasks((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        promptText: "",
        promptAudio: "",
        promptAudioStatus: "",
        targetHotspotId: "",
      },
    ]);
  };

  const removeHotspotTask = (taskId: string) => {
    setHotspotTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const updateHotspotTask = (taskId: string, fields: Partial<HotspotQuizTask>) => {
    setHotspotTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...fields } : t))
    );
  };

  // ----------------------------------------------------
  // INTERACTIVE READING HANDLERS
  // ----------------------------------------------------
  const addReadingPage = () => {
    const newId = `page-${Math.random().toString(36).substring(7)}`;
    setReadingPages((prev) => [
      ...prev,
      {
        id: newId,
        title: "",
        text: "",
        media: "",
        mediaStatus: "",
        choices: [],
        questions: [],
      },
    ]);
  };

  const removeReadingPage = (pageId: string) => {
    setReadingPages((prev) => prev.filter((p) => p.id !== pageId));
  };

  const updateReadingPage = (pageId: string, fields: Partial<ReadingPageCreator>) => {
    setReadingPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, ...fields } : p))
    );
  };

  const addReadingPageChoice = (pageId: string) => {
    setReadingPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          choices: [...p.choices, { text: "", nextPageId: "" }],
        };
      })
    );
  };

  const updateReadingPageChoice = (
    pageId: string,
    choiceIdx: number,
    fields: Partial<{ text: string; nextPageId: string }>
  ) => {
    setReadingPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        const updatedChoices = p.choices.map((c, idx) =>
          idx === choiceIdx ? { ...c, ...fields } : c
        );
        return { ...p, choices: updatedChoices };
      })
    );
  };

  const removeReadingPageChoice = (pageId: string, choiceIdx: number) => {
    setReadingPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          choices: p.choices.filter((_, idx) => idx !== choiceIdx),
        };
      })
    );
  };

  const addReadingPageQuestion = (pageId: string) => {
    setReadingPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        const newQId = `q-${Math.random().toString(36).substring(7)}`;
        return {
          ...p,
          questions: [
            ...p.questions,
            {
              id: newQId,
              type: "multiple-choice",
              prompt: "",
              options: ["", ""],
              correctOptionIdx: 0,
              keywords: "",
            },
          ],
        };
      })
    );
  };

  const updateReadingPageQuestion = (
    pageId: string,
    qId: string,
    fields: Partial<any>
  ) => {
    setReadingPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        const updatedQs = p.questions.map((q) =>
          q.id === qId ? { ...q, ...fields } : q
        );
        return { ...p, questions: updatedQs };
      })
    );
  };

  const removeReadingPageQuestion = (pageId: string, qId: string) => {
    setReadingPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          questions: p.questions.filter((q) => q.id !== qId),
        };
      })
    );
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
          if (!t.promptText.trim()) throw new Error(`Prompt ${idx + 1}: Prompt text is required.`);
          if (!t.targetHotspotId) throw new Error(`Prompt ${idx + 1}: Please select a target hotspot zone.`);
        });

        contentString = JSON.stringify({
          backgroundImage: hotspotBg,
          hotspots: hotspots.map((h) => ({
            id: h.id,
            name: h.name,
            shape: h.shape,
            coords: h.coords,
          })),
          tasks: hotspotTasks.map((t) => ({
            id: t.id,
            promptText: t.promptText.trim(),
            promptAudio: t.promptAudio.trim() || undefined,
            targetHotspotId: t.targetHotspotId,
          })),
        });
      } else if (creatorMode === "interactive-reading") {
        if (readingPages.length === 0) {
          throw new Error("Please add at least one page to the interactive book.");
        }
        const pageIds = readingPages.map((p) => p.id.trim()).filter(Boolean);
        if (!pageIds.includes(startPageId.trim())) {
          throw new Error(`Start Page ID "${startPageId}" does not match any defined Page Key.`);
        }

        const pagesObj: Record<string, any> = {};

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

            const base: any = {
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
          };
        });

        contentString = JSON.stringify({
          startPage: startPageId.trim(),
          pages: pagesObj,
        });
      } else if (creatorMode === "vocabulary") {
        const lines = vocabRawText.split("\n").map((line: string) => line.trim()).filter(Boolean);
        if (lines.length === 0) {
          throw new Error("Please enter at least one vocabulary word pair (e.g. apple = Apfel).");
        }

        const vocabList: Array<{ word: string; translation: string }> = [];
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

          vocabList.push({ word, translation });
        });

        contentString = JSON.stringify({ vocabList });
      } else {
        if (questions.length === 0) {
          throw new Error("Please add at least one task to the worksheet.");
        }

        const formattedQuestions = questions.map((q, idx) => {
          const indexStr = `Question ${idx + 1}`;

          const base: any = {
            id: q.id,
            type: q.type,
            question: q.question.trim(),
          };

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

            const items: any[] = [];
            categories.forEach((cat) => {
              const itemsString = q.categorizationMap[cat] || "";
              const parsedItems = itemsString
                .split("##")
                .map((i) => i.trim())
                .filter(Boolean);

              parsedItems.forEach((name) => {
                items.push({
                  id: Math.random().toString(36).substring(7),
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
                id: Math.random().toString(36).substring(7),
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
        selectedCourseId || null
      );

      if (res?.error) {
        setError(res.error);
      } else {
        router.push("/teacher");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
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
                  className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white font-mono disabled:opacity-60"
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
                  className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
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
                className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
              />
            </div>

            {courses.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Course (optional)
                </label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-white dark:bg-neutral-900 outline-none focus:border-black dark:focus:border-white"
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

          {/* ---------------------------------------------------- */}
          {/* MIXED STANDARD WORKSHEET MODE */}
          {/* ---------------------------------------------------- */}
          {creatorMode === "worksheet" && (
            <div className="space-y-6">
              <h2 className="text-base font-bold font-mono uppercase tracking-wide border-b pb-2">
                Tasks & Questions List ({questions.length})
              </h2>

              {questions.map((q, qIdx) => {
                const activeCats = q.categories
                  .split(",")
                  .map((c) => c.trim())
                  .filter(Boolean);

                return (
                  <div
                    key={q.id}
                    className="p-6 border rounded border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-neutral-600 dark:text-neutral-350">
                          Task {qIdx + 1}
                        </span>
                        <select
                          value={q.type}
                          onChange={(e: any) => updateQuestion(q.id, { type: e.target.value })}
                          className="text-xs font-mono font-bold bg-transparent border border-neutral-350 dark:border-neutral-750 rounded px-2 py-0.5 outline-none"
                        >
                          <option value="multiple-choice">Multiple Choice</option>
                          <option value="gap-fill">Write into the Gap</option>
                          <option value="drag-drop">Word Drag & Drop</option>
                          <option value="categorization">Categorization Sorting</option>
                          <option value="clickable-choice">Clickable Choice</option>
                          <option value="matching">Connections Match</option>
                          <option value="open-question">Open Question</option>
                          <option value="ordering">Word Ordering</option>
                          <option value="media">Solely Media Embed</option>
                          <option value="instruction">Instruction Card</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQuestion(q.id)}
                        className="text-neutral-400 hover:text-red-500 cursor-pointer transition"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Question prompt inputs */}
                    {q.type !== "media" && q.type !== "instruction" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                            Task Prompt / Prompt Instructions
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Solve the equation:"
                            value={q.question}
                            onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                            className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-3 py-1.5 outline-none focus:border-black dark:focus:border-white"
                          />
                        </div>

                        {/* Optional Hint */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                            Optional Hint (Shown if stuck)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Try listing prime factors first"
                            value={q.hint}
                            onChange={(e) => updateQuestion(q.id, { hint: e.target.value })}
                            className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-3 py-1.5 outline-none focus:border-black dark:focus:border-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* Media attachments uploader */}
                    {q.type !== "instruction" && (
                      <div className="p-3 bg-neutral-50/50 dark:bg-neutral-950/10 border rounded space-y-2">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                          Optional Question Media (Image / Audio / Video)
                        </label>
                        <div className="flex flex-col md:flex-row gap-3 items-center">
                          <input
                            type="text"
                            placeholder="Media file name (e.g. audio.mp3)"
                            value={q.media}
                            onChange={(e) => updateQuestion(q.id, { media: e.target.value })}
                            className="flex-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none font-mono"
                          />
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*,audio/*,video/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleMediaUpload(
                                    file,
                                    (fn) => updateQuestion(q.id, { media: fn }),
                                    (st) => updateQuestion(q.id, { mediaStatus: st })
                                  );
                                }
                              }}
                              className="hidden"
                              id={`upload-${q.id}`}
                            />
                            <label
                              htmlFor={`upload-${q.id}`}
                              className="flex items-center gap-1 border border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded text-xs font-semibold hover:bg-neutral-100 transition cursor-pointer select-none font-mono uppercase"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Upload file
                            </label>
                          </div>
                        </div>
                        {q.mediaStatus && (
                          <span className="text-[10px] font-mono block text-neutral-500 italic">
                            {q.mediaStatus}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Question Type Specific Inputs */}
                    {q.type === "multiple-choice" && (
                      <div className="space-y-3 pl-4 border-l-2 border-neutral-200 dark:border-neutral-850">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              checked={q.correctOptionIndex === oIdx}
                              onChange={() => updateQuestion(q.id, { correctOptionIndex: oIdx })}
                              className="h-4 w-4 accent-black cursor-pointer"
                            />
                            <input
                              type="text"
                              required
                              placeholder={`Option ${oIdx + 1}`}
                              value={opt}
                              onChange={(e) =>
                                updateQuestion(q.id, {
                                  options: q.options.map((o, idx) =>
                                    idx === oIdx ? e.target.value : o
                                  ),
                                })
                              }
                              className="flex-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded px-2.5 py-1.5 outline-none bg-transparent"
                            />
                            {q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuestion(q.id, {
                                    options: q.options.filter((_, idx) => idx !== oIdx),
                                    correctOptionIndex:
                                      q.correctOptionIndex >= q.options.length - 1
                                        ? 0
                                        : q.correctOptionIndex,
                                  })
                                }
                                className="text-neutral-400 hover:text-red-500 cursor-pointer"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => updateQuestion(q.id, { options: [...q.options, ""] })}
                          className="text-xs text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white underline font-semibold cursor-pointer block mt-1"
                        >
                          + Add Option
                        </button>
                      </div>
                    )}

                    {(q.type === "gap-fill" || q.type === "drag-drop") && (
                      <div className="space-y-2 pl-4 border-l-2 border-neutral-250 dark:border-neutral-800">
                        <textarea
                          required
                          placeholder={
                            q.type === "gap-fill"
                              ? "Sentence with gaps. E.g. The mouse <<ran>> (run) into the hole."
                              : "Drag drop text. E.g. The cows produce <<milk>> and live on the <<farm>>."
                          }
                          value={q.text}
                          onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                          rows={4}
                          className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded px-3 py-1.5 outline-none bg-transparent font-mono"
                        />
                      </div>
                    )}

                    {q.type === "categorization" && (
                      <div className="space-y-4 pl-4 border-l-2 border-neutral-250 dark:border-neutral-800">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                            Categories (Comma-separated)
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Herbivores, Carnivores"
                            value={q.categories}
                            onChange={(e) => updateQuestion(q.id, { categories: e.target.value })}
                            className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-3 py-1.5 outline-none"
                          />
                        </div>

                        {activeCats.length > 0 && (
                          <div className="space-y-2">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block border-b pb-1">
                              Categorization Columns (Items separated by ##)
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {activeCats.map((cat) => (
                                <div
                                  key={cat}
                                  className="border rounded p-3 bg-neutral-50 dark:bg-neutral-950/20 space-y-1.5"
                                >
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-350 block">
                                    Category: {cat}
                                  </span>
                                  <textarea
                                    required
                                    placeholder="Cow ## Sheep ## Rabbit"
                                    value={q.categorizationMap[cat] || ""}
                                    onChange={(e) => updateCategorizationMap(q.id, cat, e.target.value)}
                                    rows={3}
                                    className="w-full text-xs border border-neutral-300 dark:border-neutral-750 bg-transparent rounded px-2.5 py-1.5 outline-none font-mono"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {q.type === "clickable-choice" && (
                      <div className="space-y-4 pl-4 border-l-2 border-neutral-250 dark:border-neutral-800">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                            Clickable Option Buttons Bank (Comma-separated)
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Yes, No, Unsure"
                            value={q.choices}
                            onChange={(e) => updateQuestion(q.id, { choices: e.target.value })}
                            className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-3 py-1.5 outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                            Statements List (One statement per line, formatted with Statement##Option)
                          </label>
                          <textarea
                            required
                            placeholder="Is 7 a prime number?##Yes&#13;Is 8 a prime number?##No"
                            value={q.statements}
                            onChange={(e) => updateQuestion(q.id, { statements: e.target.value })}
                            rows={4}
                            className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded px-3 py-1.5 outline-none bg-transparent font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {q.type === "matching" && (
                      <div className="space-y-4 pl-4 border-l-2 border-neutral-250 dark:border-neutral-800">
                        <div className="space-y-2.5">
                          {q.matchingPairs.map((pair, pIdx) => (
                            <div
                              key={pair.id}
                              className="p-3 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50/50 dark:bg-neutral-950/10 flex flex-col md:flex-row gap-3 items-end"
                            >
                              <div className="flex-1 space-y-1">
                                <label className="text-[9px] uppercase tracking-wider font-semibold text-neutral-450 block">
                                  Left Column Text
                                </label>
                                <input
                                  type="text"
                                  placeholder="Text label"
                                  value={pair.leftText}
                                  onChange={(e) =>
                                    updateQuestion(q.id, {
                                      matchingPairs: q.matchingPairs.map((p) =>
                                        p.id === pair.id ? { ...p, leftText: e.target.value } : p
                                      ),
                                    })
                                  }
                                  className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded px-2.5 py-1 outline-none bg-transparent"
                                />
                              </div>

                              <div className="flex-1 space-y-1">
                                <label className="text-[9px] uppercase tracking-wider font-semibold text-neutral-450 block font-mono">
                                  Left Media (File Upload)
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="e.g. apple.jpg"
                                    value={pair.leftMedia}
                                    onChange={(e) =>
                                      updateQuestion(q.id, {
                                        matchingPairs: q.matchingPairs.map((p) =>
                                          p.id === pair.id ? { ...p, leftMedia: e.target.value } : p
                                        ),
                                      })
                                    }
                                    className="flex-1 text-[11px] border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 outline-none bg-transparent font-mono"
                                  />
                                  <input
                                    type="file"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleMediaUpload(
                                          file,
                                          (fn) =>
                                            updateQuestion(q.id, {
                                              matchingPairs: q.matchingPairs.map((p) =>
                                                p.id === pair.id ? { ...p, leftMedia: fn } : p
                                              ),
                                            }),
                                          (st) =>
                                            updateQuestion(q.id, {
                                              matchingPairs: q.matchingPairs.map((p) =>
                                                p.id === pair.id ? { ...p, leftMediaStatus: st } : p
                                              ),
                                            })
                                        );
                                      }
                                    }}
                                    className="hidden"
                                    id={`pair-upload-${pair.id}`}
                                  />
                                  <label
                                    htmlFor={`pair-upload-${pair.id}`}
                                    className="border border-neutral-350 dark:border-neutral-700 px-2 py-1 rounded text-[10px] font-bold font-mono uppercase hover:bg-neutral-100 dark:hover:bg-neutral-850 cursor-pointer"
                                  >
                                    Upload
                                  </label>
                                </div>
                              </div>

                              <div className="flex-1 space-y-1">
                                <label className="text-[9px] uppercase tracking-wider font-semibold text-neutral-450 block">
                                  Right Target Match
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Matching text"
                                  value={pair.rightText}
                                  onChange={(e) =>
                                    updateQuestion(q.id, {
                                      matchingPairs: q.matchingPairs.map((p) =>
                                        p.id === pair.id ? { ...p, rightText: e.target.value } : p
                                      ),
                                    })
                                  }
                                  className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded px-2.5 py-1 outline-none bg-transparent"
                                />
                              </div>

                              {q.matchingPairs.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuestion(q.id, {
                                      matchingPairs: q.matchingPairs.filter((p) => p.id !== pair.id),
                                    })
                                  }
                                  className="text-neutral-400 hover:text-red-500 rounded p-1 mb-1"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(q.id, {
                              matchingPairs: [
                                ...q.matchingPairs,
                                { id: Math.random().toString(36).substring(7), leftText: "", leftMedia: "", leftMediaStatus: "", rightText: "" },
                              ],
                            })
                          }
                          className="text-xs text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white underline font-semibold cursor-pointer block mt-1"
                        >
                          + Add Matching Pair
                        </button>
                      </div>
                    )}

                    {q.type === "instruction" && (
                      <div className="space-y-2 pl-4 border-l-2 border-neutral-250 dark:border-neutral-800">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                          Instruction Cards Text (Supports Markdown/Whitespace prewrap)
                        </label>
                        <textarea
                          required
                          placeholder="Type directions, section warnings, or readings here..."
                          value={q.text}
                          onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                          rows={4}
                          className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded px-3 py-1.5 outline-none bg-transparent"
                        />
                      </div>
                    )}

                    {q.type === "open-question" && (
                      <div className="space-y-3 pl-4 border-l-2 border-neutral-250 dark:border-neutral-800">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                            Keywords for correct checking (Separated by ##)
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. ##apple ##fruit ##pear"
                            value={q.keywords}
                            onChange={(e) => updateQuestion(q.id, { keywords: e.target.value })}
                            className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-3 py-1.5 outline-none font-mono"
                          />
                          <span className="text-[9px] text-neutral-450 italic block">
                            Case-insensitive. If any keyword is found in the student's text area response, 1 point is awarded.
                          </span>
                        </div>
                      </div>
                    )}

                    {q.type === "ordering" && (
                      <div className="space-y-3 pl-4 border-l-2 border-neutral-250 dark:border-neutral-800">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                            Correct Ordered Sentence Text
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. The quick brown fox jumps over the lazy dog"
                            value={q.orderingSentence}
                            onChange={(e) => updateQuestion(q.id, { orderingSentence: e.target.value })}
                            className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-3 py-1.5 outline-none"
                          />
                          <span className="text-[9px] text-neutral-450 italic block">
                            Words will be automatically shuffled. The student must reconstruct this exact sentence sequence.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Quick Add Buttons at bottom */}
              <div className="p-4 border border-dashed rounded flex flex-wrap gap-2 items-center justify-center bg-neutral-50/50 dark:bg-neutral-950/10">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500 mr-2">
                  + Add task:
                </span>
                <button
                  type="button"
                  onClick={() => addQuestion("multiple-choice")}
                  className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
                >
                  Multiple Choice
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion("gap-fill")}
                  className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
                >
                  Write Into Gap
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion("drag-drop")}
                  className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
                >
                  Drag & Drop
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion("categorization")}
                  className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
                >
                  Categorization Sorting
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion("clickable-choice")}
                  className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
                >
                  Clickable Choice
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion("matching")}
                  className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
                >
                  Connections Match
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion("open-question")}
                  className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
                >
                  Open Question
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion("ordering")}
                  className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
                >
                  Word Ordering
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion("media")}
                  className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs border-dashed"
                >
                  Solely Media
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion("instruction")}
                  className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs border-dashed"
                >
                  Instructions Card
                </button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* IMAGE HOTSPOT QUIZ MODE */}
          {/* ---------------------------------------------------- */}
          {creatorMode === "image-hotspot-quiz" && (
            <div className="space-y-6">
              {/* Background image upload block */}
              <div className="p-6 border rounded border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
                <h3 className="text-sm font-bold font-mono uppercase tracking-wide border-b pb-2">
                  1. Upload Quiz Background Picture
                </h3>

                <div className="flex flex-col md:flex-row gap-3 items-center">
                  <input
                    type="text"
                    required
                    placeholder="Background image name (e.g. classroom.jpg)"
                    value={hotspotBg}
                    onChange={(e) => setHotspotBg(e.target.value)}
                    className="flex-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none font-mono"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleMediaUpload(
                          file,
                          (fn) => setHotspotBg(fn),
                          (st) => setHotspotBgStatus(st)
                        );
                      }
                    }}
                    className="hidden"
                    id="hotspot-bg-file"
                  />
                  <label
                    htmlFor="hotspot-bg-file"
                    className="flex items-center gap-1 border border-neutral-350 dark:border-neutral-750 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded text-xs font-semibold hover:bg-neutral-100 transition cursor-pointer select-none font-mono uppercase"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Browse Image
                  </label>
                </div>
                {hotspotBgStatus && (
                  <span className="text-[10px] font-mono block text-neutral-550 italic">
                    {hotspotBgStatus}
                  </span>
                )}
              </div>

              {/* Hotspots Interactive Coordinates Drawer */}
              <div className="p-6 border rounded border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
                <h3 className="text-sm font-bold font-mono uppercase tracking-wide border-b pb-2">
                  2. Define Hotspot Click Zones (Coordinates Overlay)
                </h3>

                {hotspotBg ? (
                  <div className="space-y-4">
                    <p className="text-xs text-neutral-500 italic">
                      Click directly on the image below to automatically place a hotspot at that coordinate!
                    </p>

                    <div className="relative border rounded max-w-md mx-auto overflow-hidden bg-neutral-100 dark:bg-neutral-950/20 select-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          hotspotBg.startsWith("http") || hotspotBg.startsWith("/")
                            ? hotspotBg
                            : `/api/exercises/${id}/assets/${hotspotBg}`
                        }
                        alt="Hotspot Background Preview"
                        onClick={handleCanvasClick}
                        className="w-full h-auto cursor-crosshair object-contain block mx-auto"
                        draggable={false}
                      />

                      {/* Overlays to display saved hotspots */}
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                      >
                        {hotspots.map((hs) => {
                          const shapeProps = {
                            key: hs.id,
                            className: "fill-blue-500/20 stroke-blue-500/60 stroke-2",
                          };

                          if (hs.shape === "circle" && hs.coords.length >= 3) {
                            const [cx, cy, r] = hs.coords;
                            return <circle cx={cx} cy={cy} r={r} {...shapeProps} />;
                          }

                          if (hs.shape === "rect" && hs.coords.length >= 4) {
                            const [x, y, w, h] = hs.coords;
                            return <rect x={x} y={y} width={w} height={h} {...shapeProps} />;
                          }
                          return null;
                        })}

                        {/* Drawing temporary coordinates */}
                        {clickedCoords && (
                          <circle
                            cx={clickedCoords[0]}
                            cy={clickedCoords[1]}
                            r={3}
                            className="fill-red-500 animate-pulse stroke-white stroke-2"
                          />
                        )}
                      </svg>
                    </div>

                    {/* Hotspot details input box */}
                    {clickedCoords && (
                      <div className="p-4 border rounded bg-neutral-50 dark:bg-neutral-950/20 space-y-3">
                        <div className="flex items-center justify-between border-b pb-1">
                          <span className="text-xs font-bold font-mono text-neutral-600 dark:text-neutral-350">
                            Coordinate selected: {clickedCoords[0]}%, {clickedCoords[1]}%
                          </span>
                          <button
                            type="button"
                            onClick={() => setClickedCoords(null)}
                            className="text-xs text-neutral-500 hover:text-red-650 font-semibold underline"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                              Zone Identifier Label
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. red-balloon"
                              value={newHsName}
                              onChange={(e) => setNewHsName(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                              className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                              Shape Format
                            </label>
                            <select
                              value={newHsShape}
                              onChange={(e: any) => setNewHsShape(e.target.value)}
                              className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none"
                            >
                              <option value="circle">Circle Zone</option>
                              <option value="rect">Rectangle Zone</option>
                            </select>
                          </div>
                        </div>

                        {newHsShape === "circle" ? (
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                              Radius size ({newHsRadius}%)
                            </label>
                            <input
                              type="range"
                              min={3}
                              max={25}
                              value={newHsRadius}
                              onChange={(e) => setNewHsRadius(parseInt(e.target.value))}
                              className="w-full cursor-ew-resize accent-black"
                            />
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                                Width size ({newHsWidth}%)
                              </label>
                              <input
                                type="range"
                                min={4}
                                max={35}
                                value={newHsWidth}
                                onChange={(e) => setNewHsWidth(parseInt(e.target.value))}
                                className="w-full cursor-ew-resize accent-black"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                                Height size ({newHsHeight}%)
                              </label>
                              <input
                                type="range"
                                min={4}
                                max={35}
                                value={newHsHeight}
                                onChange={(e) => setNewHsHeight(parseInt(e.target.value))}
                                className="w-full cursor-ew-resize accent-black"
                              />
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={!newHsName.trim()}
                          onClick={saveHotspot}
                          className="w-full bg-black text-white dark:bg-white dark:text-black font-semibold font-mono text-[11px] py-2 rounded uppercase hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                        >
                          Save Zone
                        </button>
                      </div>
                    )}

                    {/* Saved Hotspots zones list */}
                    {hotspots.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block border-b pb-1">
                          Saved Clickable Hotspots ({hotspots.length})
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {hotspots.map((hs) => (
                            <span
                              key={hs.id}
                              className="inline-flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-850 px-2.5 py-1 rounded text-xs font-mono font-medium border border-neutral-250 dark:border-neutral-750"
                            >
                              <span>{hs.name} ({hs.shape})</span>
                              <button
                                type="button"
                                onClick={() => removeHotspot(hs.id)}
                                className="text-neutral-450 hover:text-red-500 transition cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-neutral-450 italic border border-dashed rounded bg-neutral-50/50 dark:bg-neutral-950/10">
                    Upload a background image above to define hotspot click zones interactively!
                  </div>
                )}
              </div>

              {/* Hotspot Tasks list */}
              <div className="p-6 border rounded border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
                <h3 className="text-sm font-bold font-mono uppercase tracking-wide border-b pb-2 flex items-center justify-between">
                  <span>3. Click Prompts List ({hotspotTasks.length})</span>
                  <button
                    type="button"
                    disabled={hotspots.length === 0}
                    onClick={addHotspotTask}
                    className="flex items-center gap-1 text-xs border border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 rounded font-semibold hover:bg-neutral-100 transition disabled:opacity-50 cursor-pointer select-none uppercase font-mono"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add prompt
                  </button>
                </h3>

                {hotspots.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                    ⚠️ Define at least one hotspot zone first to connect prompts to click targets.
                  </p>
                )}

                {hotspotTasks.map((task, tIdx) => (
                  <div
                    key={task.id}
                    className="p-4 border rounded border-neutral-250 dark:border-neutral-850 bg-neutral-50/40 dark:bg-neutral-950/10 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b pb-1">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
                        Prompt {tIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeHotspotTask(task.id)}
                        className="text-neutral-400 hover:text-red-500 cursor-pointer transition"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                          Prompt Text Instruction
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Find the kitchen clock"
                          value={task.promptText}
                          onChange={(e) => updateHotspotTask(task.id, { promptText: e.target.value })}
                          className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                          Target Zone click answer
                        </label>
                        <select
                          required
                          value={task.targetHotspotId}
                          onChange={(e) => updateHotspotTask(task.id, { targetHotspotId: e.target.value })}
                          className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded px-2.5 py-1.5 outline-none font-mono font-bold"
                        >
                          <option value="">-- Choose Target Zone --</option>
                          {hotspots.map((hs) => (
                            <option key={hs.id} value={hs.id}>
                              {hs.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Audio prompt uploader */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block font-mono">
                        Optional Audio Instruction voice (e.g. clocksound.mp3)
                      </label>
                      <div className="flex flex-col md:flex-row gap-3 items-center">
                        <input
                          type="text"
                          placeholder="Audio file name (e.g. find_clock.mp3)"
                          value={task.promptAudio}
                          onChange={(e) => updateHotspotTask(task.id, { promptAudio: e.target.value })}
                          className="flex-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none font-mono"
                        />
                        <div className="relative">
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleMediaUpload(
                                  file,
                                  (fn) => updateHotspotTask(task.id, { promptAudio: fn }),
                                  (st) => updateHotspotTask(task.id, { promptAudioStatus: st })
                                );
                              }
                            }}
                            className="hidden"
                            id={`audio-upload-${task.id}`}
                          />
                          <label
                            htmlFor={`audio-upload-${task.id}`}
                            className="flex items-center gap-1 border border-neutral-350 dark:border-neutral-750 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded text-xs font-semibold hover:bg-neutral-100 transition cursor-pointer select-none font-mono uppercase"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Browse Audio
                          </label>
                        </div>
                      </div>
                      {task.promptAudioStatus && (
                        <span className="text-[10px] font-mono block text-neutral-550 italic font-medium">
                          {task.promptAudioStatus}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* INTERACTIVE READING BOOK MODE */}
          {/* ---------------------------------------------------- */}
          {creatorMode === "interactive-reading" && (
            <div className="space-y-6">
              {/* Start page selector */}
              <div className="p-6 border rounded border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
                <h3 className="text-sm font-bold font-mono uppercase tracking-wide border-b pb-2">
                  📖 Choose Your Adventure Config
                </h3>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                    Starting Story Page Key
                  </label>
                  <select
                    value={startPageId}
                    onChange={(e) => setStartPageId(e.target.value)}
                    className="w-full max-w-xs text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded px-2.5 py-1.5 outline-none font-mono font-bold"
                  >
                    {readingPages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} {p.title ? `(${p.title})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pages header with add button */}
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold font-mono uppercase tracking-wide text-neutral-600 dark:text-neutral-350">
                  Book Pages Trail ({readingPages.length})
                </h3>
                <button
                  type="button"
                  onClick={addReadingPage}
                  className="flex items-center gap-1 text-xs border border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer select-none uppercase font-mono"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Story Page
                </button>
              </div>

              {/* List of reading pages */}
              {readingPages.map((p, pIdx) => (
                <div
                  key={p.id}
                  className="p-6 border rounded border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-5 relative"
                >
                  {/* Page header controls */}
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-neutral-250 dark:border-neutral-750">
                        Page {pIdx + 1}
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Page ID Key (e.g. entry, escape-path)"
                        value={p.id}
                        onChange={(e) => {
                          const cleaned = e.target.value.toLowerCase().replace(/[^a-zA-Z0-9-]/g, "");
                          updateReadingPage(p.id, { id: cleaned });
                        }}
                        className="text-xs border-b border-dashed border-neutral-400 focus:border-black outline-none font-mono font-bold w-48 bg-transparent"
                      />
                    </div>
                    {readingPages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeReadingPage(p.id)}
                        className="text-neutral-400 hover:text-red-500 cursor-pointer transition"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Title and Media Illustration Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                        Page Title Header
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Inside the Giant Castle"
                        value={p.title}
                        onChange={(e) => updateReadingPage(p.id, { title: e.target.value })}
                        className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none"
                      />
                    </div>

                    {/* Image illustration uploader */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                        Optional Illustration Picture (e.g. castle.png)
                      </label>
                      <div className="flex flex-col md:flex-row gap-3 items-center">
                        <input
                          type="text"
                          placeholder="Image filename (e.g. forest.png)"
                          value={p.media}
                          onChange={(e) => updateReadingPage(p.id, { media: e.target.value })}
                          className="flex-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none font-mono"
                        />
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleMediaUpload(
                                  file,
                                  (fn) => updateReadingPage(p.id, { media: fn }),
                                  (st) => updateReadingPage(p.id, { mediaStatus: st })
                                );
                              }
                            }}
                            className="hidden"
                            id={`page-upload-${p.id}`}
                          />
                          <label
                            htmlFor={`page-upload-${p.id}`}
                            className="flex items-center gap-1 border border-neutral-350 dark:border-neutral-750 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded text-xs font-semibold hover:bg-neutral-100 transition cursor-pointer select-none font-mono uppercase"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Browse Image
                          </label>
                        </div>
                      </div>
                      {p.mediaStatus && (
                        <span className="text-[10px] font-mono block text-neutral-500 italic">
                          {p.mediaStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Main Story Content Text */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                      Main Story Paragraph text
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Write the text describing this scene/page in the story adventure..."
                      value={p.text}
                      onChange={(e) => updateReadingPage(p.id, { text: e.target.value })}
                      className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none"
                    />
                  </div>

                  {/* Required Page Tasks (Unlock gate) */}
                  <div className="p-4 bg-neutral-50/50 dark:bg-neutral-950/10 border border-neutral-200 dark:border-neutral-800 rounded space-y-3">
                    <div className="flex items-center justify-between border-b pb-1">
                      <span className="text-[10px] font-semibold font-mono uppercase tracking-wider text-neutral-500">
                        🔒 Required tasks to unlock pathways ({p.questions.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => addReadingPageQuestion(p.id)}
                        className="text-[10px] text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white underline font-bold"
                      >
                        + Add Task
                      </button>
                    </div>

                    {p.questions.map((q, qIdx) => (
                      <div
                        key={q.id}
                        className="p-3 border rounded border-neutral-250 dark:border-neutral-750 bg-white dark:bg-neutral-900 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b pb-1">
                          <span className="text-[10px] font-mono font-bold text-neutral-500">
                            Task {qIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeReadingPageQuestion(p.id, q.id)}
                            className="text-neutral-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2 space-y-1">
                            <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-450 block">
                              Task Question / Prompt
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Find the correct passcode"
                              value={q.prompt}
                              onChange={(e) => updateReadingPageQuestion(p.id, q.id, { prompt: e.target.value })}
                              className="w-full text-xs border border-neutral-300 dark:border-neutral-750 bg-transparent rounded px-2.5 py-1 outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-450 block">
                              Task Answer Type
                            </label>
                            <select
                              value={q.type}
                              onChange={(e: any) =>
                                updateReadingPageQuestion(p.id, q.id, {
                                  type: e.target.value,
                                  options: e.target.value === "multiple-choice" ? ["", ""] : undefined,
                                })
                              }
                              className="w-full text-xs border border-neutral-300 dark:border-neutral-750 bg-transparent rounded px-2.5 py-1 outline-none"
                            >
                              <option value="multiple-choice">Multiple Choice</option>
                              <option value="open-question">Open Question</option>
                            </select>
                          </div>
                        </div>

                        {q.type === "multiple-choice" ? (
                          <div className="space-y-2 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-450">
                                Options List (Mark correct radio button)
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  updateReadingPageQuestion(p.id, q.id, {
                                    options: [...q.options, ""],
                                  })
                                }
                                className="text-[9px] text-neutral-600 hover:text-black underline font-bold"
                              >
                                + Add Option
                              </button>
                            </div>

                            <div className="space-y-2">
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`correct-${p.id}-${q.id}`}
                                    checked={q.correctOptionIdx === oIdx}
                                    onChange={() => updateReadingPageQuestion(p.id, q.id, { correctOptionIdx: oIdx })}
                                    className="accent-black cursor-pointer"
                                  />
                                  <input
                                    type="text"
                                    required
                                    placeholder={`Option ${oIdx + 1}`}
                                    value={opt}
                                    onChange={(e) => {
                                      const updatedOpts = q.options.map((o, idx) =>
                                        idx === oIdx ? e.target.value : o
                                      );
                                      updateReadingPageQuestion(p.id, q.id, { options: updatedOpts });
                                    }}
                                    className="flex-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2 py-1 outline-none"
                                  />
                                  {q.options.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedOpts = q.options.filter((_, idx) => idx !== oIdx);
                                        const newCorrect = q.correctOptionIdx >= updatedOpts.length ? 0 : q.correctOptionIdx;
                                        updateReadingPageQuestion(p.id, q.id, {
                                          options: updatedOpts,
                                          correctOptionIdx: newCorrect,
                                        });
                                      }}
                                      className="text-neutral-400 hover:text-red-500"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                            <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-450 block">
                              Accepted Answer Keywords (separated by ##, e.g. keys##key##gold)
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. passcode##gate##open"
                              value={q.keywords}
                              onChange={(e) => updateReadingPageQuestion(p.id, q.id, { keywords: e.target.value })}
                              className="w-full text-xs border border-neutral-300 dark:border-neutral-750 bg-transparent rounded px-2.5 py-1 outline-none font-mono"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pathway Choices (Adventure paths) */}
                  <div className="p-4 bg-neutral-50/50 dark:bg-neutral-950/10 border border-neutral-200 dark:border-neutral-800 rounded space-y-3">
                    <div className="flex items-center justify-between border-b pb-1">
                      <span className="text-[10px] font-semibold font-mono uppercase tracking-wider text-neutral-500">
                        🗺️ Choose Your Path Choices ({p.choices.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => addReadingPageChoice(p.id)}
                        className="text-[10px] text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white underline font-bold"
                      >
                        + Add Choice Path
                      </button>
                    </div>

                    {p.choices.map((choice, cIdx) => (
                      <div key={cIdx} className="flex flex-col md:flex-row gap-3 items-center bg-white dark:bg-neutral-900 p-2.5 border rounded border-neutral-250 dark:border-neutral-750">
                        <input
                          type="text"
                          required
                          placeholder="Choice option text (e.g. Open the wooden door)"
                          value={choice.text}
                          onChange={(e) => updateReadingPageChoice(p.id, cIdx, { text: e.target.value })}
                          className="flex-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1 outline-none"
                        />

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-semibold text-neutral-450">Leads to Page:</span>
                          <select
                            required
                            value={choice.nextPageId}
                            onChange={(e) => updateReadingPageChoice(p.id, cIdx, { nextPageId: e.target.value })}
                            className="text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded px-2.5 py-1 outline-none font-mono font-bold"
                          >
                            <option value="">-- Choose Page --</option>
                            {readingPages.map((pg) => (
                              <option key={pg.id} value={pg.id}>
                                {pg.id} {pg.title ? `(${pg.title})` : ""}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => removeReadingPageChoice(p.id, cIdx)}
                            className="text-neutral-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {p.choices.length === 0 && (
                      <p className="text-[10px] text-green-650 dark:text-green-400 italic">
                        No choice paths defined: this page will serve as a Story Adventure ending.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* VOCABULARY PRACTICE MODE */}
          {/* ---------------------------------------------------- */}
          {creatorMode === "vocabulary" && (
            <div className="p-6 border rounded border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-sm font-bold font-mono uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-green-500" />
                  Vocabulary Word List Builder
                </h3>
                <p className="text-xs text-neutral-450 mt-1 font-sans">
                  Enter your vocabulary pairs below. Place each pair on a new line, using an equals sign (<code>=</code>) to separate the term and its translation.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
                  Copy & Paste Vocabulary List
                </label>
                <textarea
                  required
                  rows={15}
                  value={vocabRawText}
                  onChange={(e) => setVocabRawText(e.target.value)}
                  placeholder={`apple = Apfel\nhorse = Pferd\nchair = Stuhl\nsun = Sonne`}
                  className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded p-3 bg-transparent font-mono outline-none focus:border-black dark:focus:border-white leading-relaxed"
                />
              </div>

              {vocabRawText.trim() && (
                <div className="p-3 bg-neutral-50 dark:bg-neutral-950/40 border rounded text-[11px] font-mono space-y-1">
                  <span className="font-bold text-neutral-500 block">Parsed Words Preview:</span>
                  <div className="max-h-36 overflow-y-auto divide-y">
                    {vocabRawText
                      .split("\n")
                      .map((line: string) => line.trim())
                      .filter(Boolean)
                      .map((line: string, idx: number) => {
                        const parts = line.split("=");
                        const word = parts[0]?.trim() || "";
                        const translation = parts[1]?.trim() || "";
                        return (
                          <div key={idx} className="py-1 flex justify-between gap-4">
                            <span className="font-medium text-neutral-800 dark:text-neutral-250">
                              {word || <span className="text-red-500">(missing)</span>}
                            </span>
                            <span className="text-neutral-450">→</span>
                            <span className="font-medium text-neutral-700 dark:text-neutral-300">
                              {translation || <span className="text-red-500">(missing)</span>}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
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
                    3. A red locator dot will appear. Fill in the label name (e.g. <code>fridge</code>) and radius, then click "Save Zone".
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
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    Vocabulary Setup:
                  </span>
                  <p className="leading-relaxed">
                    Copy and paste list in the format <code>word = translation</code> (e.g. <code>apple = Apfel</code>), one pair per line.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    Tiered Study Loop:
                  </span>
                  <p className="leading-relaxed">
                    Generates recognition flashcards, multiple-choice options, and spelling stages for pupils.
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
