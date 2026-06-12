"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { WidgetProps, ImageHotspotQuizConfig } from "./types";
import { Play, Check, X, Award } from "lucide-react";

export const ImageHotspotQuiz: React.FC<WidgetProps<ImageHotspotQuizConfig>> = ({
  config,
  assetsPath,
  savedState,
  onChange,
  isReadOnly = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // States
  const [activeTaskIdx, setActiveTaskIdx] = useState<number>(
    savedState?.activeTaskIdx ?? 0
  );
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(
    savedState?.completedTaskIds || []
  );
  const [attempts, setAttempts] = useState<Record<string, number>>(
    savedState?.attempts || {}
  );
  const [popupText, setPopupText] = useState<string | null>(null);
  const [popupTimeout, setPopupTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(
    savedState?.isCompleted || false
  );

  // Cleanup audio/timeout
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (popupTimeout) clearTimeout(popupTimeout);
    };
  }, [popupTimeout]);

  // Report state changes to parent runner
  useEffect(() => {
    const total = config.tasks.length;
    if (total === 0) return;

    // A task is solved if it is in completedTaskIds
    const solvedCount = completedTaskIds.length;
    const complete = solvedCount === total || isCompleted;

    // Score based on first-try correctness:
    // If solved and attempts === 0 for that task, they get a point.
    let points = 0;
    config.tasks.forEach((t) => {
      const isSolved = completedTaskIds.includes(t.id);
      const isFirstTry = (attempts[t.id] || 0) === 0;
      if (isSolved && isFirstTry) {
        points++;
      }
    });

    const score = (points / total) * 100;
    onChange(
      {
        activeTaskIdx,
        completedTaskIds,
        attempts,
        isCompleted: complete,
      },
      complete,
      score
    );
  }, [activeTaskIdx, completedTaskIds, attempts, isCompleted, config.tasks, onChange]);

  const showPopup = (text: string) => {
    setPopupText(text);
    if (popupTimeout) clearTimeout(popupTimeout);
    const timeout = setTimeout(() => setPopupText(null), 3000);
    setPopupTimeout(timeout);
  };

  const playSound = (file: string) => {
    if (!file) return;
    const url = file.startsWith("http") || file.startsWith("/") ? file : `${assetsPath}${file}`;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch((err) => console.warn("Audio play failed:", err));
  };

  // Get current active task
  const currentTask = useMemo(() => {
    if (isReadOnly || isCompleted) return null;
    return config.tasks[activeTaskIdx] || null;
  }, [config.tasks, activeTaskIdx, isReadOnly, isCompleted]);

  const playPromptAudio = () => {
    if (currentTask?.promptAudio) {
      playSound(currentTask.promptAudio);
    }
  };

  // Play prompt audio on task change
  useEffect(() => {
    if (currentTask) {
      playPromptAudio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTaskIdx]);

  const handleImageClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isReadOnly || isCompleted || !currentTask) return;

    // Get click location relative to SVG viewBox (0-100)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Find if click hit any hotspot
    let hitHotspotId: string | null = null;
    for (const hs of config.hotspots) {
      if (hs.shape === "circle" && hs.coords.length >= 3) {
        const [cx, cy, r] = hs.coords;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist <= r) {
          hitHotspotId = hs.id;
          break;
        }
      } else if (hs.shape === "rect" && hs.coords.length >= 4) {
        const [rx, ry, rw, rh] = hs.coords;
        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
          hitHotspotId = hs.id;
          break;
        }
      }
    }

    if (hitHotspotId === currentTask.targetHotspotId) {
      // Correct!
      showPopup("Correct! 🎉");
      setCompletedTaskIds((prev) => [...prev, currentTask.id]);

      const nextIdx = activeTaskIdx + 1;
      if (nextIdx < config.tasks.length) {
        setActiveTaskIdx(nextIdx);
      } else {
        setIsCompleted(true);
        showPopup("Quiz Completed! 🌟");
      }
    } else {
      // Incorrect click
      setAttempts((prev) => ({
        ...prev,
        [currentTask.id]: (prev[currentTask.id] || 0) + 1,
      }));
      showPopup("Try again! ❌");
    }
  };

  const imageUrl = config.backgroundImage.startsWith("http") || config.backgroundImage.startsWith("/")
    ? config.backgroundImage
    : `${assetsPath}${config.backgroundImage}`;

  return (
    <div className="space-y-4">
      {/* Title & Progress */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-2">
        <div>
          <h3 className="font-semibold text-neutral-850 dark:text-neutral-200">
            {config.title}
          </h3>
          {config.description && (
            <p className="text-xs text-neutral-550">{config.description}</p>
          )}
        </div>
        <div className="text-xs font-mono bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded text-neutral-600 dark:text-neutral-350">
          Progress: {completedTaskIds.length} / {config.tasks.length} solved
        </div>
      </div>

      {/* Task Prompt Area */}
      {!isReadOnly && !isCompleted && currentTask && (
        <div className="p-4 bg-neutral-900 text-white dark:bg-white dark:text-black rounded shadow flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block">
              Task {activeTaskIdx + 1} of {config.tasks.length}
            </span>
            <p className="text-sm font-semibold">{currentTask.promptText}</p>
          </div>
          {currentTask.promptAudio && (
            <button
              onClick={playPromptAudio}
              className="flex items-center gap-1 text-xs border border-neutral-750 dark:border-neutral-350 rounded px-2.5 py-1 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              Listen
            </button>
          )}
        </div>
      )}

      {/* Completion screen */}
      {isCompleted && !isReadOnly && (
        <div className="p-6 border border-green-300 bg-green-50/10 dark:bg-green-950/5 rounded text-center space-y-3">
          <Award className="w-8 h-8 text-green-500 mx-auto" />
          <h4 className="font-bold text-green-700 dark:text-green-350">Quiz Completed!</h4>
          <p className="text-xs text-neutral-550">You successfully mapped all items on the picture.</p>
        </div>
      )}

      {/* Interactive Coordinate Canvas */}
      <div className="relative border border-neutral-300 dark:border-neutral-800 rounded overflow-hidden bg-neutral-100/50 dark:bg-neutral-950/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="TipToi Click Quiz Background"
          className="w-full h-auto max-h-[70vh] object-contain block mx-auto select-none"
          draggable={false}
        />

        {/* SVG Overlay to capture coordinate clicks */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onClick={handleImageClick}
          className={`absolute top-0 left-0 w-full h-full ${
            isReadOnly || isCompleted ? "pointer-events-none" : "cursor-crosshair pointer-events-auto"
          }`}
        >
          {/* In read-only or completed mode, draw the hotspots to visualize them */}
          {(isReadOnly || isCompleted) &&
            config.hotspots.map((hs) => {
              const matchedTask = config.tasks.find((t) => t.targetHotspotId === hs.id);
              if (!matchedTask) return null;

              const isSolved = completedTaskIds.includes(matchedTask.id);
              const shapeProps = {
                key: hs.id,
                className: `transition duration-150 ${
                  isSolved
                    ? "fill-green-500/20 stroke-green-500/50"
                    : "fill-red-500/10 stroke-red-500/30"
                }`,
              };

              if (hs.shape === "circle" && hs.coords.length >= 3) {
                const [cx, cy, r] = hs.coords;
                return <circle cx={cx} cy={cy} r={r} {...shapeProps} />;
              }
              if (hs.shape === "rect" && hs.coords.length >= 4) {
                const [rx, ry, rw, rh] = hs.coords;
                return <rect x={rx} y={ry} width={rw} height={rh} {...shapeProps} />;
              }
              return null;
            })}
        </svg>

        {popupText && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/90 dark:bg-white/95 text-white dark:text-black px-4 py-2 rounded shadow text-xs font-semibold animate-fade-in-up">
            {popupText}
          </div>
        )}
      </div>

      {/* Review Mode details list */}
      {isReadOnly && (
        <div className="border rounded divide-y divide-neutral-200 dark:divide-neutral-800">
          <div className="p-3 bg-neutral-50 dark:bg-neutral-950/20 font-bold text-xs uppercase font-mono tracking-wider">
            Tasks review
          </div>
          {config.tasks.map((task, idx) => {
            const isSolved = completedTaskIds.includes(task.id);
            const isFirstTry = (attempts[task.id] || 0) === 0;
            const correctHotspot = config.hotspots.find((h) => h.id === task.targetHotspotId);

            return (
              <div key={task.id} className="p-3 text-xs flex items-center justify-between gap-4">
                <div>
                  <span className="font-semibold text-neutral-850 dark:text-neutral-250 block">
                    Task {idx + 1}: {task.promptText}
                  </span>
                  <span className="text-[10px] text-neutral-450 italic">
                    Correct Zone: {correctHotspot?.name || task.targetHotspotId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isSolved ? (
                    <span className="flex items-center gap-1 text-green-650 dark:text-green-400 font-semibold font-mono">
                      <Check className="w-3.5 h-3.5" />
                      {isFirstTry ? "1 Point (First Try)" : "0 Points (Retry)"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-650 dark:text-red-400 font-semibold font-mono">
                      <X className="w-3.5 h-3.5" />
                      0 Points (Unsolved)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ImageHotspotQuiz;
