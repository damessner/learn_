"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { WidgetProps, ExploreImageMapConfig } from "./types";
import { Play, RotateCcw } from "lucide-react";

export const ExploreImageMap: React.FC<WidgetProps<ExploreImageMapConfig>> = ({
  config,
  assetsPath,
  savedState,
  onChange,
  isReadOnly = false,
}) => {
  // Current active scene ID
  const [currentSceneId, setCurrentSceneId] = useState<string>(
    savedState?.currentSceneId || config.startScene
  );

  // Active scene config
  const scene = useMemo(() => {
    return config.scenes[currentSceneId] || config.scenes[config.startScene];
  }, [config.scenes, currentSceneId, config.startScene]);

  // Audio elements ref to prevent overlay sounds
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Popup bubble text overlay state
  const [popupText, setPopupText] = useState<string | null>(null);
  const [popupTimeout, setPopupTimeout] = useState<NodeJS.Timeout | null>(null);

  // Quiz game state
  const isQuizEnabled = !!config.gameMode?.enabled;
  const [quizActive, setQuizActive] = useState<boolean>(
    savedState?.quizActive || false
  );
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState<number>(
    savedState?.currentChallengeIdx || 0
  );
  // Track incorrect attempts per challenge to count first-try correctness
  const [attempts, setAttempts] = useState<Record<string, number>>(
    savedState?.attempts || {}
  );
  // Track which challenges have been completed
  const [completedChallenges, setCompletedChallenges] = useState<string[]>(
    savedState?.completedChallenges || []
  );

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (popupTimeout) {
        clearTimeout(popupTimeout);
      }
    };
  }, [popupTimeout]);

  // Report state to parent runner
  useEffect(() => {
    if (!isQuizEnabled) {
      // If no quiz, TipToi is an exploratory sandbox. It's always complete with a 100 score.
      onChange(
        { currentSceneId },
        true,
        100
      );
      return;
    }

    const challenges = config.gameMode?.challenges || [];
    const totalChallenges = challenges.length;
    if (totalChallenges === 0) return;

    const isComplete = completedChallenges.length === totalChallenges;

    // Score based on first-try correctness
    let firstTryCorrect = 0;
    challenges.forEach((ch) => {
      const isCompleted = completedChallenges.includes(ch.id);
      const wasFirstTry = (attempts[ch.id] || 0) === 0;
      if (isCompleted && wasFirstTry) {
        firstTryCorrect++;
      }
    });

    const score = totalChallenges > 0 ? (firstTryCorrect / totalChallenges) * 100 : 0;

    onChange(
      {
        currentSceneId,
        quizActive,
        currentChallengeIdx,
        attempts,
        completedChallenges,
      },
      isComplete,
      score
    );
  }, [
    currentSceneId,
    quizActive,
    currentChallengeIdx,
    attempts,
    completedChallenges,
    isQuizEnabled,
    config.gameMode,
    onChange,
  ]);

  const playSound = (soundFile: string) => {
    if (!soundFile) return;
    const url = soundFile.startsWith("http") || soundFile.startsWith("/")
      ? soundFile
      : `${assetsPath}${soundFile}`;

    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch((err) => console.warn("Audio play failed:", err));
  };

  const showPopup = (text: string) => {
    setPopupText(text);
    if (popupTimeout) clearTimeout(popupTimeout);
    const timeout = setTimeout(() => {
      setPopupText(null);
    }, 4000);
    setPopupTimeout(timeout);
  };

  // Current challenge target
  const currentChallenge = useMemo(() => {
    const challenges = config.gameMode?.challenges || [];
    return challenges[currentChallengeIdx] || null;
  }, [config.gameMode, currentChallengeIdx]);

  // Play current challenge prompt sound
  const playChallengePrompt = () => {
    if (currentChallenge?.promptAudio) {
      playSound(currentChallenge.promptAudio);
    }
  };

  // Play challenge prompt when challenge changes
  useEffect(() => {
    if (quizActive && currentChallenge) {
      playChallengePrompt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallengeIdx, quizActive]);

  const handleHotspotClick = (hotspot: any) => {
    // Normal exploratory interaction
    if (!quizActive || isReadOnly) {
      if (hotspot.popupText) {
        showPopup(hotspot.popupText);
      }
      if (hotspot.action.type === "play-audio" && hotspot.action.audio) {
        playSound(hotspot.action.audio);
      } else if (hotspot.action.type === "change-scene" && hotspot.action.scene) {
        setCurrentSceneId(hotspot.action.scene);
      }
      return;
    }

    // Quiz Game Mode interaction
    if (quizActive && currentChallenge) {
      const isMatch = hotspot.label && hotspot.label.toLowerCase() === currentChallenge.targetLabel.toLowerCase();

      if (isMatch) {
        // Correct!
        if (currentChallenge.successAudio) {
          playSound(currentChallenge.successAudio);
        } else {
          // Play default success beep
          showPopup("Correct! 🎉");
        }

        setCompletedChallenges((prev) => [...prev, currentChallenge.id]);

        const nextIdx = currentChallengeIdx + 1;
        const total = config.gameMode?.challenges.length || 0;
        if (nextIdx < total) {
          setCurrentChallengeIdx(nextIdx);
        } else {
          // Finished all challenges
          showPopup("Congratulations! You completed the quiz! 🌟");
          setQuizActive(false);
        }
      } else {
        // Incorrect
        setAttempts((prev) => ({
          ...prev,
          [currentChallenge.id]: (prev[currentChallenge.id] || 0) + 1,
        }));

        if (currentChallenge.failAudio) {
          playSound(currentChallenge.failAudio);
        } else {
          showPopup("Try again! ❌");
        }
      }
    }
  };

  const startQuiz = () => {
    setQuizActive(true);
    setCurrentChallengeIdx(0);
    setCompletedChallenges([]);
    setAttempts({});
  };

  const stopQuiz = () => {
    setQuizActive(false);
  };

  // Convert polygon coords to points string
  const getPolygonPoints = (coords: number[]) => {
    const pairs = [];
    for (let i = 0; i < coords.length; i += 2) {
      pairs.push(`${coords[i]},${coords[i + 1]}`);
    }
    return pairs.join(" ");
  };

  const imageUrl = scene.image.startsWith("http") || scene.image.startsWith("/")
    ? scene.image
    : `${assetsPath}${scene.image}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-2">
        <div>
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">
            {config.title} {scene.image ? `(${currentSceneId})` : ""}
          </h3>
          {config.description && (
            <p className="text-xs text-neutral-500">{config.description}</p>
          )}
        </div>

        {isQuizEnabled && !isReadOnly && (
          <div className="flex items-center gap-2">
            {quizActive ? (
              <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-1 rounded text-sm">
                <span className="animate-pulse w-2.5 h-2.5 bg-red-500 rounded-full shrink-0"></span>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  Quiz Mode: {completedChallenges.length} /{" "}
                  {config.gameMode?.challenges.length} solved
                </span>
                <button
                  onClick={stopQuiz}
                  className="text-xs text-red-600 dark:text-red-400 font-semibold underline ml-2"
                >
                  Exit Quiz
                </button>
              </div>
            ) : (
              <button
                onClick={startQuiz}
                className="flex items-center gap-1 bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 rounded text-sm font-semibold hover:opacity-90 transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Quiz
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quiz Prompt Indicator */}
      {quizActive && currentChallenge && (
        <div className="p-3 bg-neutral-900 text-white dark:bg-white dark:text-black rounded flex items-center justify-between shadow">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase bg-neutral-700 dark:bg-neutral-200 text-neutral-300 dark:text-neutral-700 px-1.5 py-0.5 rounded">
              Challenge {currentChallengeIdx + 1}
            </span>
            <span className="font-medium text-sm">
              {currentChallenge.promptText}
            </span>
          </div>
          {currentChallenge.promptAudio && (
            <button
              onClick={playChallengePrompt}
              className="text-xs border px-2 py-0.5 rounded border-neutral-600 dark:border-neutral-300 hover:bg-neutral-800 dark:hover:bg-neutral-150 transition"
            >
              🔊 Play sound
            </button>
          )}
        </div>
      )}

      {/* Responsive Image Sandbox */}
      <div className="relative border border-neutral-350 dark:border-neutral-700 rounded overflow-hidden bg-neutral-100/50 dark:bg-neutral-950/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={currentSceneId}
          className="w-full h-auto max-h-[70vh] object-contain block mx-auto select-none"
          draggable={false}
        />

        {/* Dynamic SVG Overlay */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        >
          {scene.hotspots.map((hotspot) => {
            const hasCoords = hotspot.coords && hotspot.coords.length > 0;
            if (!hasCoords) return null;

            const shapeProps = {
              key: hotspot.id,
              onClick: () => handleHotspotClick(hotspot),
              className: `cursor-pointer pointer-events-auto transition duration-150 ${
                isReadOnly || (!quizActive && hotspot.action.type === "change-scene")
                  ? "fill-blue-500/10 stroke-blue-500/30 hover:fill-blue-500/25 stroke-dasharray-2"
                  : "fill-transparent stroke-transparent hover:fill-neutral-500/20 hover:stroke-neutral-500/40"
              }`,
              style: { pointerEvents: "auto" as const },
            };

            if (hotspot.shape === "circle" && hotspot.coords.length >= 3) {
              const [cx, cy, r] = hotspot.coords;
              return <circle cx={cx} cy={cy} r={r} {...shapeProps} />;
            }

            if (hotspot.shape === "rect" && hotspot.coords.length >= 4) {
              const [x, y, w, h] = hotspot.coords;
              return <rect x={x} y={y} width={w} height={h} {...shapeProps} />;
            }

            if (hotspot.shape === "polygon" && hotspot.coords.length >= 6) {
              return (
                <polygon
                  points={getPolygonPoints(hotspot.coords)}
                  {...shapeProps}
                />
              );
            }

            return null;
          })}
        </svg>

        {/* Popup message inside picture container */}
        {popupText && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/85 dark:bg-white/95 text-white dark:text-black px-4 py-2 rounded shadow text-sm font-medium animate-fade-in-up z-10 text-center max-w-[90%]">
            {popupText}
          </div>
        )}
      </div>

      {/* Exploratory Mode Info */}
      {!quizActive && (
        <p className="text-xs text-neutral-450 text-center italic">
          💡 Interactive Sandbox: Click objects on the image to hear sounds or move to different rooms.
        </p>
      )}

      {/* Navigation breadcrumbs for scenes */}
      {Object.keys(config.scenes).length > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="text-neutral-500 font-semibold">Rooms:</span>
          {Object.keys(config.scenes).map((sceneId) => (
            <button
              key={sceneId}
              onClick={() => {
                if (!quizActive || isReadOnly) {
                  setCurrentSceneId(sceneId);
                } else {
                  showPopup("Exit quiz mode to change rooms manually!");
                }
              }}
              className={`px-2 py-0.5 rounded border transition ${
                currentSceneId === sceneId
                  ? "bg-neutral-200 dark:bg-neutral-800 border-neutral-400 font-semibold"
                  : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900"
              }`}
            >
              {sceneId}
            </button>
          ))}
          {currentSceneId !== config.startScene && (!quizActive || isReadOnly) && (
            <button
              onClick={() => setCurrentSceneId(config.startScene)}
              className="text-neutral-500 hover:text-black dark:hover:text-white flex items-center gap-0.5"
              title="Return to start"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
export default ExploreImageMap;
