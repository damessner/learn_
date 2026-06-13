"use client";

import React, { useState } from "react";
import { Upload, X, Plus, Trash, Shuffle, Focus } from "lucide-react";

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
  targetHotspotIds?: string[];
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
  shuffleTasks: boolean;
  setShuffleTasks: (val: boolean) => void;
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
  shuffleTasks,
  setShuffleTasks,
  handleMediaUpload,
}: ImageHotspotQuizBuilderProps) {
  // Expanded task ID in the editor
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(
    hotspotTasks[0]?.id || null
  );

  // Temporary coordinate drawer state for the active task
  const [clickedCoords, setClickedCoords] = useState<[number, number] | null>(null);
  const [newHsName, setNewHsName] = useState("");
  const [newHsShape, setNewHsShape] = useState<"circle" | "rect">("circle");
  const [newHsRadius, setNewHsRadius] = useState(6);
  const [newHsWidth, setNewHsWidth] = useState(12);
  const [newHsHeight, setNewHsHeight] = useState(12);

  // Hover state to highlight hotspots on the canvas
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);

  const handleCanvasClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(1));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(1));
    setClickedCoords([x, y]);
    // Pre-populate name based on coordinates
    setNewHsName(`target-${x.toFixed(0)}-${y.toFixed(0)}`);
  };

  const saveHotspot = (taskId: string) => {
    if (!clickedCoords || !newHsName.trim()) return;

    let coords: number[] = [];
    if (newHsShape === "circle") {
      coords = [clickedCoords[0], clickedCoords[1], newHsRadius];
    } else {
      coords = [
        clickedCoords[0] - newHsWidth / 2,
        clickedCoords[1] - newHsHeight / 2,
        newHsWidth,
        newHsHeight,
      ];
    }

    const newHotspotId = `hs-${Math.random().toString(36).substring(7)}`;

    // 1. Add globally
    setHotspots((prev) => [
      ...prev,
      {
        id: newHotspotId,
        name: newHsName.trim(),
        shape: newHsShape,
        coords,
      },
    ]);

    // 2. Link to this task
    setHotspotTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const list = t.targetHotspotIds || [];
          return {
            ...t,
            targetHotspotId: t.targetHotspotId || newHotspotId,
            targetHotspotIds: [...list, newHotspotId],
          };
        }
        return t;
      })
    );

    setNewHsName("");
    setClickedCoords(null);
  };

  const removeHotspotFromTask = (taskId: string, hsId: string) => {
    // 1. Remove from global list
    setHotspots((prev) => prev.filter((h) => h.id !== hsId));

    // 2. Unlink from this task
    setHotspotTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const list = (t.targetHotspotIds || []).filter((id) => id !== hsId);
          return {
            ...t,
            targetHotspotId: list[0] || "",
            targetHotspotIds: list,
          };
        }
        return t;
      })
    );
  };

  const addHotspotTask = () => {
    const newId = `t-${Math.random().toString(36).substring(7)}`;
    setHotspotTasks((prev) => [
      ...prev,
      {
        id: newId,
        promptText: "",
        promptAudio: "",
        promptAudioStatus: "",
        targetHotspotId: "",
        targetHotspotIds: [],
      },
    ]);
    setExpandedTaskId(newId);
    setClickedCoords(null);
  };

  const removeHotspotTask = (taskId: string) => {
    // 1. Find target hotspots associated with this task
    const task = hotspotTasks.find((t) => t.id === taskId);
    const linkedIds = task?.targetHotspotIds || [];

    // 2. Remove those hotspots from global list
    setHotspots((prev) => prev.filter((h) => !linkedIds.includes(h.id)));

    // 3. Remove the task itself
    setHotspotTasks((prev) => prev.filter((t) => t.id !== taskId));

    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      setClickedCoords(null);
    }
  };

  const updateHotspotTask = (taskId: string, fields: Partial<HotspotQuizTask>) => {
    setHotspotTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...fields } : t))
    );
  };

  return (
    <div className="space-y-6">
      {/* Background image & settings */}
      <div className="p-6 border rounded border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-3 gap-3">
          <div>
            <h3 className="text-sm font-bold font-mono uppercase tracking-wide">
              1. Quiz Background Image & Settings
            </h3>
            <p className="text-xs text-neutral-450 mt-1 font-sans">
              Choose the visual layout and toggle random shuffling.
            </p>
          </div>
          {/* Shuffling toggle checkbox */}
          <button
            type="button"
            onClick={() => setShuffleTasks(!shuffleTasks)}
            className={`px-3 py-1.5 border rounded-lg text-xs font-semibold uppercase font-mono transition flex items-center gap-1.5 ${
              shuffleTasks
                ? "bg-purple-50 border-purple-300 text-purple-700 dark:bg-purple-950/20 dark:border-purple-900 dark:text-purple-300"
                : "border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            }`}
          >
            <Shuffle className="w-3.5 h-3.5" />
            Shuffle Prompts: {shuffleTasks ? "ON" : "OFF"}
          </button>
        </div>

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

      {/* Prompts / Questions Setup */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <h3 className="text-sm font-bold font-mono uppercase tracking-wide flex items-center gap-2">
              2. Questions & Click Targets ({hotspotTasks.length})
            </h3>
            <p className="text-xs text-neutral-450 mt-1 font-sans">
              Define each task prompt, configure prompt audio, and draw clickable target zones.
            </p>
          </div>
          <button
            type="button"
            onClick={addHotspotTask}
            className="px-3 py-1.5 border border-purple-300 hover:bg-purple-50 hover:border-purple-400 dark:border-purple-900/60 dark:hover:bg-purple-950/20 text-purple-750 dark:text-purple-300 text-xs font-semibold uppercase font-mono rounded-lg transition active:scale-95 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>

        {hotspotTasks.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg text-xs text-neutral-400">
            No questions defined yet. Click &quot;Add Question&quot; to begin.
          </div>
        ) : (
          <div className="space-y-4">
            {hotspotTasks.map((task, idx) => {
              const isExpanded = expandedTaskId === task.id;
              const taskHotspots = hotspots.filter(
                (h) => task.targetHotspotIds?.includes(h.id) || h.id === task.targetHotspotId
              );

              return (
                <div
                  key={task.id}
                  className={`p-5 border rounded-xl bg-white dark:bg-neutral-900 transition-all ${
                    isExpanded
                      ? "border-purple-300 shadow-md ring-1 ring-purple-100 dark:ring-purple-950/30"
                      : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-750 shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between border-b dark:border-neutral-800/80 pb-3 mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedTaskId(isExpanded ? null : task.id);
                        setClickedCoords(null);
                      }}
                      className="flex items-center gap-2 text-left cursor-pointer group"
                    >
                      <span className="text-xs font-bold font-mono uppercase tracking-wider text-purple-650 dark:text-purple-400">
                        Question #{idx + 1}
                      </span>
                      {!isExpanded && (
                        <span className="text-xs text-neutral-400 group-hover:text-neutral-600 font-sans transition">
                          {task.promptText || "(No prompt text defined)"} · {taskHotspots.length} target(s)
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedTaskId(isExpanded ? null : task.id);
                          setClickedCoords(null);
                        }}
                        className="text-[10px] font-mono font-bold uppercase text-neutral-450 hover:text-black dark:hover:text-white transition cursor-pointer"
                      >
                        {isExpanded ? "Collapse" : "Edit Zones"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeHotspotTask(task.id)}
                        className="p-1 text-neutral-400 hover:text-red-650 transition cursor-pointer"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Edit Form */}
                  {isExpanded && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
                            Question Prompt Text
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Touch the letter A"
                            value={task.promptText}
                            onChange={(e) =>
                              updateHotspotTask(task.id, { promptText: e.target.value })
                            }
                            className="w-full text-xs border border-neutral-350 dark:border-neutral-700 bg-transparent rounded px-3 py-2 outline-none focus:border-black dark:focus:border-white transition font-sans"
                          />
                        </div>

                        {/* Audio Media Uploader */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-50 block font-mono">
                            Optional Audio Instruction voice (e.g. letter-a.mp3)
                          </label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Audio filename (e.g. touch_a.mp3)"
                              value={task.promptAudio}
                              onChange={(e) =>
                                updateHotspotTask(task.id, { promptAudio: e.target.value })
                              }
                              className="flex-1 text-xs border border-neutral-350 dark:border-neutral-700 bg-transparent rounded px-3 py-2 outline-none font-mono"
                            />
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
                              id={`audio-file-${task.id}`}
                            />
                            <label
                              htmlFor={`audio-file-${task.id}`}
                              className="flex items-center gap-1 border border-neutral-350 dark:border-neutral-750 bg-white dark:bg-neutral-900 px-3 py-2 rounded text-xs font-semibold hover:bg-neutral-100 transition cursor-pointer select-none font-mono uppercase"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Upload Audio
                            </label>
                          </div>
                          {task.promptAudioStatus && (
                            <span className="text-[9px] font-mono block text-neutral-450 italic mt-0.5">
                              {task.promptAudioStatus}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Click Target Drawer Overlay */}
                      <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-neutral-550 flex items-center gap-1">
                            <Focus className="w-3.5 h-3.5 text-purple-500" />
                            Coordinate Click Targets for this question
                          </span>
                          <span className="text-[10px] font-sans text-neutral-450 italic">
                            Click coordinates directly on the image preview below to draw a target.
                          </span>
                        </div>

                        {hotspotBg ? (
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                            {/* Canvas Drawing Area */}
                            <div className="lg:col-span-7 relative border rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-950/20 max-w-sm mx-auto select-none">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={
                                  hotspotBg.startsWith("http") || hotspotBg.startsWith("/")
                                    ? hotspotBg
                                    : `/api/exercises/${id}/assets/${hotspotBg}`
                                }
                                alt="Hotspot Drawer Preview"
                                onClick={handleCanvasClick}
                                className="w-full h-auto cursor-crosshair object-contain block"
                                draggable={false}
                              />

                              <svg
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                              >
                                {/* Draw only hotspots belonging to this task */}
                                {taskHotspots.map((hs) => {
                                  const isHovered = hoveredHotspotId === hs.id;
                                  const shapeProps = {
                                    className: `transition duration-150 ${
                                      isHovered
                                        ? "fill-purple-500/35 stroke-purple-500/80 stroke-2 animate-pulse"
                                        : "fill-blue-500/20 stroke-blue-500/60 stroke-2"
                                    }`,
                                  };

                                  if (hs.shape === "circle" && hs.coords.length >= 3) {
                                    const [cx, cy, r] = hs.coords;
                                    return <circle key={hs.id} cx={cx} cy={cy} r={r} {...shapeProps} />;
                                  }

                                  if (hs.shape === "rect" && hs.coords.length >= 4) {
                                    const [x, y, w, h] = hs.coords;
                                    return <rect key={hs.id} x={x} y={y} width={w} height={h} {...shapeProps} />;
                                  }
                                  return null;
                                })}

                                {/* Draw selected coord pulse */}
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

                            {/* Coordinate Panel */}
                            <div className="lg:col-span-5 space-y-4">
                              {clickedCoords ? (
                                <div className="p-4 border rounded-xl bg-neutral-55 bg-neutral-50 dark:bg-neutral-950/20 space-y-3 animate-fade-in-up">
                                  <div className="flex items-center justify-between border-b pb-1">
                                    <span className="text-[10px] font-bold font-mono text-neutral-600 dark:text-neutral-350">
                                      Coord Selected: {clickedCoords[0]}%, {clickedCoords[1]}%
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setClickedCoords(null)}
                                      className="text-[10px] text-neutral-500 hover:text-red-650 font-semibold underline cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>

                                  <div className="space-y-3">
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-450">
                                        Zone label identifier
                                      </label>
                                      <input
                                        type="text"
                                        required
                                        placeholder="e.g. letter-a"
                                        value={newHsName}
                                        onChange={(e) =>
                                          setNewHsName(
                                            e.target.value.replace(/[^a-zA-Z0-9-]/g, "")
                                          )
                                        }
                                        className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none font-mono"
                                      />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-0.5">
                                        <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-450">
                                          Shape
                                        </label>
                                        <select
                                          value={newHsShape}
                                          onChange={(e) =>
                                            setNewHsShape(e.target.value as "circle" | "rect")
                                          }
                                          className="w-full text-[11px] border border-neutral-300 dark:border-neutral-750 bg-transparent rounded px-2 py-1 outline-none"
                                        >
                                          <option value="circle">Circle</option>
                                          <option value="rect">Rectangle</option>
                                        </select>
                                      </div>

                                      {newHsShape === "circle" ? (
                                        <div className="space-y-0.5">
                                          <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-450 block">
                                            Radius ({newHsRadius}%)
                                          </label>
                                          <input
                                            type="range"
                                            min={3}
                                            max={25}
                                            value={newHsRadius}
                                            onChange={(e) => setNewHsRadius(parseInt(e.target.value))}
                                            className="w-full cursor-ew-resize accent-black h-5"
                                          />
                                        </div>
                                      ) : (
                                        <div className="space-y-0.5">
                                          <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-450 block">
                                            Size ({newHsWidth}x{newHsHeight}%)
                                          </label>
                                          <div className="flex gap-1">
                                            <input
                                              type="range"
                                              min={4}
                                              max={30}
                                              value={newHsWidth}
                                              onChange={(e) => setNewHsWidth(parseInt(e.target.value))}
                                              className="w-1/2 cursor-ew-resize accent-black h-5"
                                            />
                                            <input
                                              type="range"
                                              min={4}
                                              max={30}
                                              value={newHsHeight}
                                              onChange={(e) => setNewHsHeight(parseInt(e.target.value))}
                                              className="w-1/2 cursor-ew-resize accent-black h-5"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={!newHsName.trim()}
                                    onClick={() => saveHotspot(task.id)}
                                    className="w-full bg-purple-650 hover:bg-purple-750 text-white font-semibold font-mono text-[10px] py-2 rounded uppercase transition disabled:opacity-50 cursor-pointer"
                                  >
                                    Save Target Zone
                                  </button>
                                </div>
                              ) : (
                                <div className="p-4 border border-dashed rounded-xl text-center text-xs text-neutral-400 bg-neutral-50/50 dark:bg-neutral-900/10">
                                  Click coordinates on image preview to define a new target zone.
                                </div>
                              )}

                              {/* Click zones checklist for this active task */}
                              <div className="space-y-2">
                                <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-neutral-400 block border-b pb-1">
                                  Linked targets ({taskHotspots.length})
                                </span>
                                {taskHotspots.length === 0 ? (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-450 italic block leading-relaxed">
                                    ⚠️ Add at least one click target so students can click something.
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {taskHotspots.map((hs) => (
                                      <span
                                        key={hs.id}
                                        onMouseEnter={() => setHoveredHotspotId(hs.id)}
                                        onMouseLeave={() => setHoveredHotspotId(null)}
                                        className="inline-flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/20 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-900/40 px-2 py-0.5 rounded text-[11px] font-mono font-medium transition hover:border-purple-400"
                                      >
                                        <span>{hs.name} ({hs.shape})</span>
                                        <button
                                          type="button"
                                          onClick={() => removeHotspotFromTask(task.id, hs.id)}
                                          className="text-purple-400 hover:text-red-650 cursor-pointer transition"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-xs text-neutral-450 italic border border-dashed rounded bg-neutral-50/40 dark:bg-neutral-950/10">
                            Upload a background picture in step 1 to draw targets.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
