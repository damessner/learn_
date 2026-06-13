"use client";

import React, { useState } from "react";
import { Search, X, Loader2, Image as ImageIcon } from "lucide-react";

interface PixabayImage {
  id: number;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
  tags: string;
}

interface PixabaySearchModalProps {
  exerciseId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (localFilename: string) => void;
  defaultQuery?: string;
}

export function PixabaySearchModal({
  exerciseId,
  isOpen,
  onClose,
  onSelect,
  defaultQuery = "",
}: PixabaySearchModalProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [hits, setHits] = useState<PixabayImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pixabay/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to search images.");
      }
      const data = await res.json();
      setHits(data.hits || []);
      if (data.hits.length === 0) {
        setError("No images found for this query.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load images.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectImage = async (img: PixabayImage) => {
    if (!exerciseId.trim()) {
      setError("Please specify the Exercise ID first.");
      return;
    }
    setDownloadingId(img.id);
    setError(null);
    try {
      const res = await fetch(`/api/exercises/${exerciseId.toLowerCase().trim()}/assets/download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: img.webformatURL }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to download image.");
      }

      const data = await res.json();
      onSelect(data.filepath);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to import image.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-purple-500" />
            <h3 className="font-bold text-sm font-mono uppercase tracking-wide">
              Pixabay Image Search
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-450 hover:text-neutral-800 dark:hover:text-white transition p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input bar */}
        <div className="p-4 border-b flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="Search for images (e.g. apples, door, sunset)..."
            className="flex-1 text-sm border border-neutral-300 dark:border-neutral-750 rounded-lg px-3 py-2 bg-transparent outline-none focus:border-purple-500 font-sans"
            autoFocus
          />
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="bg-purple-650 hover:bg-purple-750 disabled:opacity-45 text-white font-semibold font-mono text-xs uppercase px-4 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {/* Body content scrollable grid */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[30vh]">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg text-xs text-red-700 dark:text-red-300 text-center font-medium mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <p className="text-xs text-neutral-450 font-mono">Searching Pixabay photos...</p>
            </div>
          ) : hits.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {hits.map((hit) => {
                const isDownloading = downloadingId === hit.id;
                return (
                  <button
                    key={hit.id}
                    type="button"
                    disabled={downloadingId !== null}
                    onClick={() => handleSelectImage(hit)}
                    className="group relative aspect-video border dark:border-neutral-800 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-purple-500 transition cursor-pointer hover:scale-[1.02] duration-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={hit.previewURL}
                      alt={hit.tags}
                      className="w-full h-full object-cover group-hover:opacity-90 transition"
                      loading="lazy"
                    />
                    {isDownloading ? (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-end p-1.5 opacity-0 group-hover:opacity-100">
                        <span className="text-[9px] text-white font-mono truncate w-full">
                          Select
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400 dark:text-neutral-500 space-y-1">
              <ImageIcon className="w-8 h-8 opacity-40" />
              <p className="text-xs">Search for terms to import images from Pixabay.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
