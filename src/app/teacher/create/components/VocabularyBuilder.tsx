"use client";

import React, { useState } from "react";
import { FileText, Sparkles, Search, Trash, Loader2 } from "lucide-react";
import { PixabaySearchModal } from "@/components/PixabaySearchModal";

interface VocabularyBuilderProps {
  exerciseId: string;
  vocabRawText: string;
  setVocabRawText: (text: string) => void;
  vocabItems: Array<{
    word: string;
    translation: string;
    image?: string;
    ttsEnabled?: boolean;
    wordAudio?: string;
    translationAudio?: string;
  }>;
  setVocabItems: React.Dispatch<
    React.SetStateAction<Array<{
      word: string;
      translation: string;
      image?: string;
      ttsEnabled?: boolean;
      wordAudio?: string;
      translationAudio?: string;
    }>>
  >;
  pictureSupplementation: boolean;
  setPictureSupplementation: (val: boolean) => void;
  handleMediaUpload: (
    file: File,
    onUploaded: (filename: string) => void,
    onStatus: (status: string) => void
  ) => Promise<void>;
  isOralVocabulary?: boolean;
}

export function VocabularyBuilder({
  exerciseId,
  vocabRawText,
  setVocabRawText,
  vocabItems,
  setVocabItems,
  pictureSupplementation,
  setPictureSupplementation,
  handleMediaUpload,
  isOralVocabulary = false,
}: VocabularyBuilderProps) {
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchWordIdx, setSearchWordIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Upload state
  const [, setUploadStatusIdx] = useState<number | null>(null);
  const [, setUploadStatusText] = useState("");

  // Auto-supplement state
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);

  const handleAutoSupplement = async () => {
    if (!exerciseId.trim()) {
      alert("Please specify the Exercise ID at the top of the form before supplementing.");
      return;
    }
    if (vocabItems.length === 0) {
      alert("Please enter some vocabulary word pairs first.");
      return;
    }

    setAutoLoading(true);
    setAutoStatus("Auto-supplementing word images from Pixabay...");

    try {
      const updated = [...vocabItems];
      for (let i = 0; i < updated.length; i++) {
        const item = updated[i];
        if (!item.image) {
          setAutoStatus(`Searching Pixabay for "${item.word}"...`);
          const searchRes = await fetch(`/api/pixabay/search?q=${encodeURIComponent(item.word)}`);
          if (searchRes.ok) {
            const data = await searchRes.json();
            if (data.hits && data.hits.length > 0) {
              const firstHit = data.hits[0];
              setAutoStatus(`Downloading image for "${item.word}"...`);
              const dlRes = await fetch(
                `/api/exercises/${exerciseId.toLowerCase().trim()}/assets/download-url`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ url: firstHit.webformatURL }),
                }
              );
              if (dlRes.ok) {
                const dlData = await dlRes.json();
                updated[i] = { ...updated[i], image: dlData.filepath };
              }
            }
          }
        }
      }
      setVocabItems(updated);
      setAutoStatus("✓ All images auto-supplemented successfully!");
      setTimeout(() => setAutoStatus(null), 3000);
    } catch (err: unknown) {
      console.error(err);
      setAutoStatus("❌ Failed to complete auto-supplementation.");
      setTimeout(() => setAutoStatus(null), 3000);
    } finally {
      setAutoLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 border rounded border-neutral-300 dark:border-neutral-850 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-sm font-bold font-mono uppercase tracking-wide flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-green-500" />
            Vocabulary Word List Builder
          </h3>
          <p className="text-xs text-neutral-450 mt-1 font-sans">
            Enter your vocabulary pairs below. Place each pair on a new line, using an equals sign (<code>=</code>) to separate the term and its translation.
          </p>
        </div>

        {/* Text Area */}
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
            Copy & Paste Vocabulary List
          </label>
          <textarea
            required
            rows={10}
            value={vocabRawText}
            onChange={(e) => setVocabRawText(e.target.value)}
            placeholder={`apple = Apfel\nhorse = Pferd\nchair = Stuhl\nsun = Sonne`}
            className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded p-3 bg-transparent font-mono outline-none focus:border-black dark:focus:border-white leading-relaxed"
          />
        </div>

        {/* Checkbox for picture supplementation */}
        {!isOralVocabulary && (
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-850">
            <input
              type="checkbox"
              id="enable-picture-supplementation"
              checked={pictureSupplementation}
              onChange={(e) => setPictureSupplementation(e.target.checked)}
              className="h-4 w-4 cursor-pointer"
            />
            <label
              htmlFor="enable-picture-supplementation"
              className="text-xs font-semibold select-none cursor-pointer text-neutral-750 dark:text-neutral-300"
            >
              Enable experimental picture supplementation (Picture Quiz)
            </label>
          </div>
        )}
      </div>

      {/* Vocabulary items list card */}
      {vocabItems.length > 0 && (
        <div className="p-6 border rounded border-neutral-300 dark:border-neutral-850 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-2">
            <div>
              <h4 className="text-xs font-extrabold uppercase font-mono tracking-wider text-purple-650 dark:text-purple-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
                Vocabulary Item Settings
              </h4>
              <p className="text-[11px] text-neutral-450 mt-0.5">
                {isOralVocabulary 
                  ? "Oral Vocabulary Quiz: Pupils will listen to the German audio and translate to English." 
                  : "Enable TTS audio or images for your vocabulary words."}
              </p>
            </div>

            {pictureSupplementation && !isOralVocabulary && (
              <button
                type="button"
                disabled={autoLoading}
                onClick={handleAutoSupplement}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-mono font-bold text-[10px] uppercase px-3.5 py-2 rounded-lg flex items-center gap-1 transition cursor-pointer self-start shadow-sm shrink-0"
              >
                {autoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Auto-Supplement All
              </button>
            )}
          </div>

          {autoStatus && pictureSupplementation && !isOralVocabulary && (
            <div className="p-3 bg-purple-55/10 border border-purple-200 text-xs text-purple-800 dark:text-purple-300 rounded-lg flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-purple-500" />
              <span>{autoStatus}</span>
            </div>
          )}

          {/* List of vocabulary words */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {vocabItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3 border rounded-lg bg-neutral-50/50 dark:bg-neutral-955/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-neutral-800 dark:text-neutral-250 truncate">
                      {item.word}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">&rarr;</span>
                    <span className="text-xs text-neutral-600 dark:text-neutral-450 truncate">
                      {item.translation}
                    </span>
                  </div>
                  {pictureSupplementation && !isOralVocabulary && (
                    item.image ? (
                      <span className="text-[9px] font-mono text-neutral-450 block mt-0.5 truncate">
                        File: {item.image}
                      </span>
                    ) : (
                      <span className="text-[9px] text-neutral-400 italic block mt-0.5">
                        No image attached
                      </span>
                    )
                  )}
                  {(item.wordAudio || item.translationAudio) && (
                    <span className="text-[9px] text-green-600 dark:text-green-400 font-mono block mt-0.5">
                      ✓ Audio Generated {item.wordAudio && "(EN)"} {item.translationAudio && "(DE)"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0 self-end sm:self-auto">
                  {/* TTS Checkbox or Required Indicator */}
                  {!isOralVocabulary ? (
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!item.ttsEnabled}
                        onChange={(e) => {
                          const updated = [...vocabItems];
                          updated[idx] = { ...updated[idx], ttsEnabled: e.target.checked };
                          setVocabItems(updated);
                        }}
                        className="h-3.5 w-3.5 cursor-pointer rounded"
                      />
                      <span>TTS Audio</span>
                    </label>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold font-mono rounded">
                      Audio Required
                    </span>
                  )}

                  {/* Picture supplementation tools (if enabled) */}
                  {pictureSupplementation && !isOralVocabulary && (
                    <>
                      {/* Preview thumbnail */}
                      {item.image && (
                        <div className="w-10 h-10 rounded border bg-neutral-100 dark:bg-neutral-950 overflow-hidden relative shadow-xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/exercises/${exerciseId.toLowerCase().trim()}/assets/${item.image}`}
                            alt={item.word}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        {/* Pixabay search selector */}
                        <button
                          type="button"
                          disabled={autoLoading}
                          onClick={() => {
                            if (!exerciseId.trim()) {
                              alert("Please specify the Exercise ID at the top of the form first.");
                              return;
                            }
                            setSearchWordIdx(idx);
                            setSearchQuery(item.word);
                            setIsModalOpen(true);
                          }}
                          className="flex items-center gap-0.5 border border-neutral-350 dark:border-neutral-750 bg-white dark:bg-neutral-900 px-2 py-1 rounded text-[10px] font-bold font-mono uppercase hover:bg-neutral-100 dark:hover:bg-neutral-850 cursor-pointer transition"
                        >
                          <Search className="w-3 h-3 text-purple-500" />
                          Pixabay
                        </button>

                        {/* Manual uploader */}
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            disabled={autoLoading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setUploadStatusIdx(idx);
                                setUploadStatusText("Uploading...");
                                handleMediaUpload(
                                  file,
                                  (fn) => {
                                    const updated = [...vocabItems];
                                    updated[idx] = { ...updated[idx], image: fn };
                                    setVocabItems(updated);
                                    setUploadStatusIdx(null);
                                  },
                                  (st) => {
                                    setUploadStatusText(st);
                                    if (st.startsWith("❌") || st.startsWith("✓")) {
                                      setTimeout(() => setUploadStatusIdx(null), 3000);
                                    }
                                  }
                                );
                              }
                            }}
                            className="hidden"
                            id={`vocab-upload-${idx}`}
                          />
                          <label
                            htmlFor={`vocab-upload-${idx}`}
                            className="border border-neutral-350 dark:border-neutral-750 bg-white dark:bg-neutral-900 px-2 py-1 rounded text-[10px] font-bold font-mono uppercase hover:bg-neutral-100 dark:hover:bg-neutral-850 cursor-pointer transition block"
                          >
                            Upload
                          </label>
                        </div>

                        {/* Delete button */}
                        {item.image && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...vocabItems];
                              updated[idx] = { ...updated[idx], image: undefined };
                              setVocabItems(updated);
                            }}
                            className="text-red-500 hover:text-red-700 p-1 border rounded hover:bg-red-50 dark:hover:bg-red-955/20 cursor-pointer transition"
                            title="Remove Image"
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pixabay Picker Modal */}
      <PixabaySearchModal
        exerciseId={exerciseId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={(fn) => {
          if (searchWordIdx !== null) {
            const updated = [...vocabItems];
            updated[searchWordIdx] = { ...updated[searchWordIdx], image: fn };
            setVocabItems(updated);
          }
        }}
        defaultQuery={searchQuery}
      />
    </div>
  );
}
