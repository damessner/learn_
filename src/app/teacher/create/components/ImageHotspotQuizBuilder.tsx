"use client";

import React, { useState, useEffect } from "react";
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

  // Hover state to highlight hotspots on the canvas
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);

  // Graphical Hotspot Editor States
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [drawingTool, setDrawingTool] = useState<"select" | "circle" | "rect">("select");
  const [rectCorner1, setRectCorner1] = useState<[number, number] | null>(null);
  const [tempMousePos, setTempMousePos] = useState<[number, number] | null>(null);
  const [isEnlarged, setIsEnlarged] = useState(false);

  interface DragState {
    hsId: string;
    type: "move" | "resize-circle" | "resize-rect-tl" | "resize-rect-tr" | "resize-rect-bl" | "resize-rect-br";
    startX: number; // percentage
    startY: number; // percentage
    startCoords: number[]; // original coords
  }
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Pointer drag event handlers for moving and resizing
  useEffect(() => {
    if (!dragState) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const svg = document.getElementById("hotspot-svg-canvas");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      const dx = x - dragState.startX;
      const dy = y - dragState.startY;

      setHotspots((prev) =>
        prev.map((hs) => {
          if (hs.id !== dragState.hsId) return hs;

          let newCoords = [...dragState.startCoords];
          if (dragState.type === "move") {
            if (hs.shape === "circle") {
              newCoords[0] = Math.max(0, Math.min(100, dragState.startCoords[0] + dx));
              newCoords[1] = Math.max(0, Math.min(100, dragState.startCoords[1] + dy));
            } else {
              newCoords[0] = Math.max(0, Math.min(100 - dragState.startCoords[2], dragState.startCoords[0] + dx));
              newCoords[1] = Math.max(0, Math.min(100 - dragState.startCoords[3], dragState.startCoords[1] + dy));
            }
          } else if (dragState.type === "resize-circle") {
            newCoords[2] = Math.max(1, Math.min(50, dragState.startCoords[2] + dx));
          } else if (dragState.type === "resize-rect-tl") {
            const newW = Math.max(2, dragState.startCoords[2] - dx);
            const newH = Math.max(2, dragState.startCoords[3] - dy);
            const newX = dragState.startCoords[0] + (dragState.startCoords[2] - newW);
            const newY = dragState.startCoords[1] + (dragState.startCoords[3] - newH);
            if (newX >= 0 && newY >= 0) {
              newCoords = [newX, newY, newW, newH];
            }
          } else if (dragState.type === "resize-rect-tr") {
            const newW = Math.max(2, dragState.startCoords[2] + dx);
            const newH = Math.max(2, dragState.startCoords[3] - dy);
            const newY = dragState.startCoords[1] + (dragState.startCoords[3] - newH);
            if (newY >= 0) {
              newCoords = [dragState.startCoords[0], newY, newW, newH];
            }
          } else if (dragState.type === "resize-rect-bl") {
            const newW = Math.max(2, dragState.startCoords[2] - dx);
            const newH = Math.max(2, dragState.startCoords[3] + dy);
            const newX = dragState.startCoords[0] + (dragState.startCoords[2] - newW);
            if (newX >= 0) {
              newCoords = [newX, dragState.startCoords[1], newW, newH];
            }
          } else if (dragState.type === "resize-rect-br") {
            const newW = Math.max(2, dragState.startCoords[2] + dx);
            const newH = Math.max(2, dragState.startCoords[3] + dy);
            newCoords = [dragState.startCoords[0], dragState.startCoords[1], newW, newH];
          }

          return { ...hs, coords: newCoords };
        })
      );
    };

    const handleWindowPointerUp = () => {
      setDragState(null);
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [dragState, setHotspots]);

  // Track pointer movements for rectangular drawing feedback
  useEffect(() => {
    if (drawingTool !== "rect" || !rectCorner1) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const svg = document.getElementById("hotspot-svg-canvas");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      setTempMousePos([x, y]);
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
    };
  }, [drawingTool, rectCorner1]);

  const handleCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // Left click only

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    if (drawingTool === "circle") {
      const newHotspotId = `hs-${crypto.randomUUID()}`;
      const task = hotspotTasks.find((t) => t.id === expandedTaskId);
      const name = task?.promptText 
        ? `${task.promptText.substring(0, 15)} - Zone ${(task.targetHotspotIds?.length || 0) + 1}`
        : `Zone ${hotspots.length + 1}`;

      const newHotspot: ImageHotspot = {
        id: newHotspotId,
        name,
        shape: "circle",
        coords: [x, y, 6],
      };

      setHotspots((prev) => [...prev, newHotspot]);
      if (expandedTaskId) {
        setHotspotTasks((prev) =>
          prev.map((t) => {
            if (t.id === expandedTaskId) {
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
      }
      setSelectedHotspotId(newHotspotId);
      setDrawingTool("select");
    } else if (drawingTool === "rect") {
      if (!rectCorner1) {
        setRectCorner1([x, y]);
        setTempMousePos([x, y]);
      } else {
        const xMin = Math.min(rectCorner1[0], x);
        const yMin = Math.min(rectCorner1[1], y);
        const w = Math.max(2, Math.abs(rectCorner1[0] - x));
        const h = Math.max(2, Math.abs(rectCorner1[1] - y));

        const newHotspotId = `hs-${crypto.randomUUID()}`;
        const task = hotspotTasks.find((t) => t.id === expandedTaskId);
        const name = task?.promptText 
          ? `${task.promptText.substring(0, 15)} - Zone ${(task.targetHotspotIds?.length || 0) + 1}`
          : `Zone ${hotspots.length + 1}`;

        const newHotspot: ImageHotspot = {
          id: newHotspotId,
          name,
          shape: "rect",
          coords: [xMin, yMin, w, h],
        };

        setHotspots((prev) => [...prev, newHotspot]);
        if (expandedTaskId) {
          setHotspotTasks((prev) =>
            prev.map((t) => {
              if (t.id === expandedTaskId) {
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
        }
        setSelectedHotspotId(newHotspotId);
        setDrawingTool("select");
        setRectCorner1(null);
        setTempMousePos(null);
      }
    } else if (drawingTool === "select") {
      // Clicked background, deselect
      setSelectedHotspotId(null);
    }
  };

  const deleteHotspot = (hsId: string) => {
    // 1. Remove from global list
    setHotspots((prev) => prev.filter((h) => h.id !== hsId));

    // 2. Unlink from all tasks
    setHotspotTasks((prev) =>
      prev.map((t) => {
        const list = (t.targetHotspotIds || []).filter((id) => id !== hsId);
        return {
          ...t,
          targetHotspotId: list[0] || "",
          targetHotspotIds: list,
        };
      })
    );

    if (selectedHotspotId === hsId) {
      setSelectedHotspotId(null);
    }
  };

  const removeHotspotFromTask = (taskId: string, hsId: string) => {
    deleteHotspot(hsId);
  };

  const addHotspotTask = () => {
    const newId = `t-${crypto.randomUUID()}`;
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
    setSelectedHotspotId(null);
    setRectCorner1(null);
    setTempMousePos(null);
    // Auto-enlarge the editor so the user can immediately draw click zones.
    setIsEnlarged(true);
  };

  const removeHotspotTask = (taskId: string) => {
    const task = hotspotTasks.find((t) => t.id === taskId);
    const linkedIds = task?.targetHotspotIds || [];

    setHotspots((prev) => prev.filter((h) => !linkedIds.includes(h.id)));
    setHotspotTasks((prev) => prev.filter((t) => t.id !== taskId));

    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      setSelectedHotspotId(null);
      setRectCorner1(null);
      setTempMousePos(null);
      setIsEnlarged(false);
    }
  };

  const updateHotspotTask = (taskId: string, fields: Partial<HotspotQuizTask>) => {
    setHotspotTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...fields } : t))
    );
  };

  const selectedHs = hotspots.find((h) => h.id === selectedHotspotId);

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
            className="flex items-center gap-1 border border-neutral-350 dark:border-neutral-755 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded text-xs font-semibold hover:bg-neutral-100 transition cursor-pointer select-none font-mono uppercase"
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
                        const next = isExpanded ? null : task.id;
                        setExpandedTaskId(next);
                        setSelectedHotspotId(null);
                        setRectCorner1(null);
                        setTempMousePos(null);
                        // Auto-enlarge the image canvas on edit, auto-collapse on close.
                        setIsEnlarged(next !== null);
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
                          const next = isExpanded ? null : task.id;
                          setExpandedTaskId(next);
                          setSelectedHotspotId(null);
                          setRectCorner1(null);
                          setTempMousePos(null);
                          setIsEnlarged(next !== null);
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
                              className="flex items-center gap-1 border border-neutral-350 dark:border-neutral-755 bg-white dark:bg-neutral-900 px-3 py-2 rounded text-xs font-semibold hover:bg-neutral-100 transition cursor-pointer select-none font-mono uppercase"
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
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-neutral-550 flex items-center gap-1">
                            <Focus className="w-3.5 h-3.5 text-purple-500" />
                            Coordinate Click Targets for this question
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsEnlarged(!isEnlarged)}
                            className="text-[10px] font-bold font-mono uppercase border border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer flex items-center gap-1 shadow-sm"
                          >
                            🔍 {isEnlarged ? "Collapse Editor" : "Enlarge Editor"}
                          </button>
                        </div>

                        {isEnlarged && (
                          <div
                            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 cursor-pointer"
                            onClick={() => setIsEnlarged(false)}
                          />
                        )}

                        {hotspotBg ? (
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                            {/* Canvas Drawing Area */}
                            <div
                              className={
                                isEnlarged
                                  ? "fixed inset-4 md:inset-10 z-50 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 overflow-y-auto max-w-5xl mx-auto"
                                  : "lg:col-span-7 space-y-2 w-full max-w-2xl mx-auto"
                              }
                            >
                              {isEnlarged && (
                                <div className="flex items-center justify-between border-b pb-2">
                                  <span className="font-mono font-bold text-xs uppercase text-purple-650 dark:text-purple-400">
                                    Enlarged Editor (Wimmelbild Mode)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setIsEnlarged(false)}
                                    className="text-[10px] font-bold font-mono uppercase border border-neutral-300 dark:border-neutral-700 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 px-2 py-1 rounded cursor-pointer"
                                  >
                                    Close Editor [X]
                                  </button>
                                </div>
                              )}
                              {/* Drawing Tool Selector Button Group */}
                              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDrawingTool("select");
                                    setRectCorner1(null);
                                    setTempMousePos(null);
                                  }}
                                  className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase rounded-md transition ${
                                    drawingTool === "select"
                                      ? "bg-purple-650 text-white shadow-xs"
                                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                                  }`}
                                >
                                  Select
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDrawingTool("circle");
                                    setSelectedHotspotId(null);
                                    setRectCorner1(null);
                                    setTempMousePos(null);
                                  }}
                                  className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase rounded-md transition ${
                                    drawingTool === "circle"
                                      ? "bg-purple-650 text-white shadow-xs"
                                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                                  }`}
                                >
                                  Circle
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDrawingTool("rect");
                                    setSelectedHotspotId(null);
                                    setRectCorner1(null);
                                    setTempMousePos(null);
                                  }}
                                  className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase rounded-md transition ${
                                    drawingTool === "rect"
                                      ? "bg-purple-650 text-white shadow-xs"
                                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                                  }`}
                                >
                                  Rectangle
                                </button>
                              </div>

                              <div className="relative border rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-950/20 select-none">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={
                                    hotspotBg.startsWith("http") || hotspotBg.startsWith("/")
                                      ? hotspotBg
                                      : `/api/exercises/${id}/assets/${hotspotBg}`
                                  }
                                  alt="Hotspot Drawer Preview"
                                  className="w-full h-auto object-contain block pointer-events-none"
                                  draggable={false}
                                />

                                <svg
                                  id="hotspot-svg-canvas"
                                  viewBox="0 0 100 100"
                                  preserveAspectRatio="none"
                                  onPointerDown={handleCanvasPointerDown}
                                  className="absolute top-0 left-0 w-full h-full cursor-crosshair select-none pointer-events-auto"
                                  style={{ touchAction: "none" }}
                                >
                                  {/* Draw hotspots for this task */}
                                  {taskHotspots.map((hs) => {
                                    const isSelected = selectedHotspotId === hs.id;
                                    const isHovered = hoveredHotspotId === hs.id;

                                    const shapeProps = {
                                      className: `transition duration-150 cursor-pointer pointer-events-auto ${
                                        isSelected
                                          ? "fill-purple-500/25 stroke-purple-650 stroke-[1.2]"
                                          : isHovered
                                          ? "fill-purple-500/15 stroke-purple-500/80 stroke-[0.8]"
                                          : "fill-blue-500/15 stroke-blue-500/60 stroke-[0.6]"
                                      }`,
                                      onPointerDown: (e: React.PointerEvent) => {
                                        e.stopPropagation();
                                        setSelectedHotspotId(hs.id);
                                        setHoveredHotspotId(hs.id);
                                        
                                        const svgEl = document.getElementById("hotspot-svg-canvas");
                                        if (!svgEl) return;
                                        const bbox = svgEl.getBoundingClientRect();
                                        const startX = Math.max(0, Math.min(100, ((e.clientX - bbox.left) / bbox.width) * 100));
                                        const startY = Math.max(0, Math.min(100, ((e.clientY - bbox.top) / bbox.height) * 100));
                                        
                                        setDragState({
                                          hsId: hs.id,
                                          type: "move",
                                          startX,
                                          startY,
                                          startCoords: [...hs.coords],
                                        });
                                      },
                                      onMouseEnter: () => setHoveredHotspotId(hs.id),
                                      onMouseLeave: () => setHoveredHotspotId(null),
                                    };

                                    return (
                                      <g key={hs.id}>
                                        {hs.shape === "circle" && hs.coords.length >= 3 && (
                                          <circle cx={hs.coords[0]} cy={hs.coords[1]} r={hs.coords[2]} {...shapeProps} />
                                        )}
                                        {hs.shape === "rect" && hs.coords.length >= 4 && (
                                          <rect x={hs.coords[0]} y={hs.coords[1]} width={hs.coords[2]} height={hs.coords[3]} {...shapeProps} />
                                        )}

                                        {/* Drag handles for selected hotspot */}
                                        {isSelected && (
                                          <>
                                            {hs.shape === "circle" && hs.coords.length >= 3 && (
                                              <circle
                                                cx={hs.coords[0] + hs.coords[2]}
                                                cy={hs.coords[1]}
                                                r={1.5}
                                                className="fill-white stroke-purple-650 stroke-[0.4] cursor-ew-resize pointer-events-auto"
                                                onPointerDown={(e) => {
                                                  e.stopPropagation();
                                                  const svgEl = document.getElementById("hotspot-svg-canvas");
                                                  if (!svgEl) return;
                                                  const bbox = svgEl.getBoundingClientRect();
                                                  const startX = Math.max(0, Math.min(100, ((e.clientX - bbox.left) / bbox.width) * 100));
                                                  const startY = Math.max(0, Math.min(100, ((e.clientY - bbox.top) / bbox.height) * 100));
                                                  setDragState({
                                                    hsId: hs.id,
                                                    type: "resize-circle",
                                                    startX,
                                                    startY,
                                                    startCoords: [...hs.coords],
                                                  });
                                                }}
                                              />
                                            )}

                                            {hs.shape === "rect" && hs.coords.length >= 4 && (
                                              <>
                                                {/* Top-Left handle */}
                                                <rect
                                                  x={hs.coords[0] - 0.8}
                                                  y={hs.coords[1] - 0.8}
                                                  width={1.6}
                                                  height={1.6}
                                                  className="fill-white stroke-purple-650 stroke-[0.4] cursor-nwse-resize pointer-events-auto"
                                                  onPointerDown={(e) => {
                                                    e.stopPropagation();
                                                    const svgEl = document.getElementById("hotspot-svg-canvas");
                                                    if (!svgEl) return;
                                                    const bbox = svgEl.getBoundingClientRect();
                                                    const startX = Math.max(0, Math.min(100, ((e.clientX - bbox.left) / bbox.width) * 100));
                                                    const startY = Math.max(0, Math.min(100, ((e.clientY - bbox.top) / bbox.height) * 100));
                                                    setDragState({
                                                      hsId: hs.id,
                                                      type: "resize-rect-tl",
                                                      startX,
                                                      startY,
                                                      startCoords: [...hs.coords],
                                                    });
                                                  }}
                                                />
                                                {/* Top-Right handle */}
                                                <rect
                                                  x={hs.coords[0] + hs.coords[2] - 0.8}
                                                  y={hs.coords[1] - 0.8}
                                                  width={1.6}
                                                  height={1.6}
                                                  className="fill-white stroke-purple-655 stroke-[0.4] cursor-nesw-resize pointer-events-auto"
                                                  onPointerDown={(e) => {
                                                    e.stopPropagation();
                                                    const svgEl = document.getElementById("hotspot-svg-canvas");
                                                    if (!svgEl) return;
                                                    const bbox = svgEl.getBoundingClientRect();
                                                    const startX = Math.max(0, Math.min(100, ((e.clientX - bbox.left) / bbox.width) * 100));
                                                    const startY = Math.max(0, Math.min(100, ((e.clientY - bbox.top) / bbox.height) * 100));
                                                    setDragState({
                                                      hsId: hs.id,
                                                      type: "resize-rect-tr",
                                                      startX,
                                                      startY,
                                                      startCoords: [...hs.coords],
                                                    });
                                                  }}
                                                />
                                                {/* Bottom-Left handle */}
                                                <rect
                                                  x={hs.coords[0] - 0.8}
                                                  y={hs.coords[1] + hs.coords[3] - 0.8}
                                                  width={1.6}
                                                  height={1.6}
                                                  className="fill-white stroke-purple-655 stroke-[0.4] cursor-nesw-resize pointer-events-auto"
                                                  onPointerDown={(e) => {
                                                    e.stopPropagation();
                                                    const svgEl = document.getElementById("hotspot-svg-canvas");
                                                    if (!svgEl) return;
                                                    const bbox = svgEl.getBoundingClientRect();
                                                    const startX = Math.max(0, Math.min(100, ((e.clientX - bbox.left) / bbox.width) * 100));
                                                    const startY = Math.max(0, Math.min(100, ((e.clientY - bbox.top) / bbox.height) * 100));
                                                    setDragState({
                                                      hsId: hs.id,
                                                      type: "resize-rect-bl",
                                                      startX,
                                                      startY,
                                                      startCoords: [...hs.coords],
                                                    });
                                                  }}
                                                />
                                                {/* Bottom-Right handle */}
                                                <rect
                                                  x={hs.coords[0] + hs.coords[2] - 0.8}
                                                  y={hs.coords[1] + hs.coords[3] - 0.8}
                                                  width={1.6}
                                                  height={1.6}
                                                  className="fill-white stroke-purple-655 stroke-[0.4] cursor-nwse-resize pointer-events-auto"
                                                  onPointerDown={(e) => {
                                                    e.stopPropagation();
                                                    const svgEl = document.getElementById("hotspot-svg-canvas");
                                                    if (!svgEl) return;
                                                    const bbox = svgEl.getBoundingClientRect();
                                                    const startX = Math.max(0, Math.min(100, ((e.clientX - bbox.left) / bbox.width) * 100));
                                                    const startY = Math.max(0, Math.min(100, ((e.clientY - bbox.top) / bbox.height) * 100));
                                                    setDragState({
                                                      hsId: hs.id,
                                                      type: "resize-rect-br",
                                                      startX,
                                                      startY,
                                                      startCoords: [...hs.coords],
                                                    });
                                                  }}
                                                />
                                              </>
                                            )}
                                          </>
                                        )}
                                      </g>
                                    );
                                  })}

                                  {/* Dashed drawing outline for rectangle */}
                                  {drawingTool === "rect" && rectCorner1 && tempMousePos && (
                                    <rect
                                      x={Math.min(rectCorner1[0], tempMousePos[0])}
                                      y={Math.min(rectCorner1[1], tempMousePos[1])}
                                      width={Math.abs(rectCorner1[0] - tempMousePos[0])}
                                      height={Math.abs(rectCorner1[1] - tempMousePos[1])}
                                      className="fill-purple-500/10 stroke-purple-500 stroke-[1.2]"
                                      strokeDasharray="2,2"
                                    />
                                  )}
                                </svg>
                              </div>
                            </div>

                            {/* Coordinate / Editing Panel */}
                            <div className="lg:col-span-5 space-y-4">
                              {selectedHs ? (
                                <div className="p-4 border rounded-xl bg-purple-50/10 dark:bg-purple-955/5 border-purple-200 dark:border-purple-900/40 space-y-3 animate-fade-in-up">
                                  <div className="flex items-center justify-between border-b pb-1.5 border-neutral-200 dark:border-neutral-800">
                                    <span className="text-[10px] font-bold font-mono text-purple-750 dark:text-purple-300 uppercase tracking-wider">
                                      Edit Hotspot
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedHotspotId(null)}
                                      className="text-[10px] text-neutral-450 hover:text-neutral-700 dark:hover:text-white underline font-semibold cursor-pointer"
                                    >
                                      Deselect
                                    </button>
                                  </div>

                                  <div className="space-y-3">
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-450 block">
                                        Zone label identifier
                                      </label>
                                      <input
                                        type="text"
                                        value={selectedHs.name}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(/[^a-zA-Z0-9-\s]/g, "");
                                          setHotspots((prev) =>
                                            prev.map((h) => (h.id === selectedHs.id ? { ...h, name: val } : h))
                                          );
                                        }}
                                        className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none font-sans"
                                      />
                                    </div>

                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-450 block">
                                          Shape
                                        </label>
                                        <div className="flex rounded-md shadow-xs">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (selectedHs.shape === "circle") return;
                                              const [x, y, w, h] = selectedHs.coords;
                                              const newCoords = [x + w / 2, y + h / 2, Math.min(w, h) / 2];
                                              setHotspots((prev) =>
                                                prev.map((h) =>
                                                  h.id === selectedHs.id
                                                    ? { ...h, shape: "circle", coords: newCoords }
                                                    : h
                                                )
                                              );
                                            }}
                                            className={`px-2.5 py-1 text-[10px] font-bold font-mono border rounded-l-md transition ${
                                              selectedHs.shape === "circle"
                                                ? "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300"
                                                : "bg-transparent border-neutral-300 dark:border-neutral-750 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                            }`}
                                          >
                                            Circle
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (selectedHs.shape === "rect") return;
                                              const [cx, cy, r] = selectedHs.coords;
                                              const newCoords = [cx - r, cy - r, 2 * r, 2 * r];
                                              setHotspots((prev) =>
                                                prev.map((h) =>
                                                  h.id === selectedHs.id
                                                    ? { ...h, shape: "rect", coords: newCoords }
                                                    : h
                                                )
                                              );
                                            }}
                                            className={`px-2.5 py-1 text-[10px] font-bold font-mono border-y border-r rounded-r-md transition ${
                                              selectedHs.shape === "rect"
                                                ? "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300"
                                                : "bg-transparent border-neutral-300 dark:border-neutral-750 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                            }`}
                                          >
                                            Rectangle
                                          </button>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => deleteHotspot(selectedHs.id)}
                                        className="px-3 py-1.5 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-955/20 text-red-650 dark:text-red-400 font-bold font-mono text-[10px] uppercase rounded-lg hover:bg-red-100 transition self-end"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-4 border border-dashed rounded-xl text-center text-xs text-neutral-400 bg-neutral-50/50 dark:bg-neutral-900/10 space-y-1">
                                  <p className="font-semibold text-neutral-500">Canvas Controls</p>
                                  {drawingTool === "select" && (
                                    <p className="text-[10px]">Select a hotspot shape to resize or relocate it.</p>
                                  )}
                                  {drawingTool === "circle" && (
                                    <p className="text-[10px]">Click anywhere on the background image to add a circle zone.</p>
                                  )}
                                  {drawingTool === "rect" && (
                                    <p className="text-[10px]">
                                      {rectCorner1
                                        ? "Click the opposite corner on the image to define the box."
                                        : "Click a starting corner on the image to start drawing a rectangle."}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Linked targets list */}
                              <div className="space-y-2">
                                <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-neutral-400 block border-b pb-1">
                                  Linked targets ({taskHotspots.length})
                                </span>
                                {taskHotspots.length === 0 ? (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-450 italic block leading-relaxed">
                                    ⚠️ Add at least one click target so students can click something.
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                                    {taskHotspots.map((hs) => (
                                      <span
                                        key={hs.id}
                                        onMouseEnter={() => setHoveredHotspotId(hs.id)}
                                        onMouseLeave={() => setHoveredHotspotId(null)}
                                        onClick={() => setSelectedHotspotId(hs.id)}
                                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium transition border cursor-pointer ${
                                          selectedHotspotId === hs.id
                                            ? "bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-955/35 dark:border-purple-900 dark:text-purple-300"
                                            : "bg-purple-50/60 dark:bg-purple-950/10 border-purple-100 dark:border-purple-900/30 text-purple-750 dark:text-purple-400 hover:border-purple-300"
                                        }`}
                                      >
                                        <span>{hs.name}</span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeHotspotFromTask(task.id, hs.id);
                                          }}
                                          className="text-purple-400 hover:text-red-650 cursor-pointer transition p-0.5"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-xs text-neutral-450 italic border border-dashed rounded bg-neutral-50/40 dark:bg-neutral-955/10">
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
