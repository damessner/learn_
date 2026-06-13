"use client";

import React, { useState } from "react";
import { Upload, X, Plus, Trash } from "lucide-react";

export interface ImageHotspot {
  id: string;
  name: string;
  shape: "circle" | "rect";
  coords: number[]; // [cx, cy, r] or [x, y, w, h]
}

export interface HotspotQuizTask {
  id: string;
  promptText: string;
  promptAudio: string;
  promptAudioStatus: string;
  targetHotspotId: string;
}

interface ImageHotspotQuizBuilderProps {
  id: string;
  hotspotBg: string;
  setHotspotBg: (val: string) => void;
  hotspotBgStatus: string;
  setHotspotBgStatus: (val: string) => void;
  hotspots: ImageHotspot[];
  setHotspots: React.Dispatch<React.SetStateAction<ImageHotspot[]>>;
  hotspotTasks: HotspotQuizTask[];
  setHotspotTasks: React.Dispatch<React.SetStateAction<HotspotQuizTask[]>>;
  handleMediaUpload: (
    file: File,
    onUploaded: (filename: string) => void,
    onStatus: (status: string) => void
  ) => Promise<void>;
}

export function ImageHotspotQuizBuilder({
  id,
  hotspotBg,
  setHotspotBg,
  hotspotBgStatus,
  setHotspotBgStatus,
  hotspots,
  setHotspots,
  hotspotTasks,
  setHotspotTasks,
  handleMediaUpload,
}: ImageHotspotQuizBuilderProps) {
  // Temporary coordinate drawer state
  const [clickedCoords, setClickedCoords] = useState<[number, number] | null>(null);
  const [newHsName, setNewHsName] = useState("");
  const [newHsShape, setNewHsShape] = useState<"circle" | "rect">("circle");
  const [newHsRadius, setNewHsRadius] = useState(6);
  const [newHsWidth, setNewHsWidth] = useState(12);
  const [newHsHeight, setNewHsHeight] = useState(12);

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

  return (
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
                className="w-full h-auto cursor-crosshair object-contain block mx-auto animate-fade-in"
                draggable={false}
              />

              {/* Overlays to display saved hotspots */}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              >
                {hotspots.map((hs) => {
                  if (hs.shape === "circle" && hs.coords.length >= 3) {
                    const [cx, cy, r] = hs.coords;
                    return <circle key={hs.id} cx={cx} cy={cy} r={r} className="fill-blue-500/20 stroke-blue-500/60 stroke-2" />;
                  }

                  if (hs.shape === "rect" && hs.coords.length >= 4) {
                    const [x, y, w, h] = hs.coords;
                    return <rect key={hs.id} x={x} y={y} width={w} height={h} className="fill-blue-500/20 stroke-blue-500/60 stroke-2" />;
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
              <div className="p-4 border rounded bg-neutral-50 dark:bg-neutral-955/20 space-y-3">
                <div className="flex items-center justify-between border-b pb-1">
                  <span className="text-xs font-bold font-mono text-neutral-600 dark:text-neutral-350">
                    Coordinate selected: {clickedCoords[0]}%, {clickedCoords[1]}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setClickedCoords(null)}
                    className="text-xs text-neutral-555 hover:text-red-650 font-semibold underline cursor-pointer"
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
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewHsShape(e.target.value as "circle" | "rect")}
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
                        className="text-neutral-455 hover:text-red-500 transition cursor-pointer"
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
          <div className="text-center py-6 text-xs text-neutral-455 italic border border-dashed rounded bg-neutral-50/50 dark:bg-neutral-950/10">
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
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-455">
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
  );
}
