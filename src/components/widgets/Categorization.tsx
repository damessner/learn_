"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { WidgetProps, CategorizationConfig } from "./types";
import { MediaEmbed } from "./MediaEmbed";

export const Categorization: React.FC<WidgetProps<CategorizationConfig>> = ({
  config,
  assetsPath,
  savedState,
  onChange,
  isReadOnly = false,
}) => {
  // State maps item ID -> category name (string)
  const [placements, setPlacements] = useState<Record<string, string>>(
    savedState?.placements || {}
  );

  // Selected item ID for tap-to-sort
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Stable onChange ref
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Calculate remaining pool of items
  const pool = useMemo(() => {
    return config.items.filter((item) => !placements[item.id]);
  }, [config.items, placements]);

  // Report changes to parent runner
  useEffect(() => {
    const totalItems = config.items.length;
    if (totalItems === 0) return;

    const placedCount = Object.keys(placements).length;
    const isComplete = placedCount === totalItems;

    let correctCount = 0;
    config.items.forEach((item) => {
      if (placements[item.id] === item.category) {
        correctCount++;
      }
    });

    const score = totalItems > 0 ? (correctCount / totalItems) * 100 : 0;
    onChangeRef.current({ placements }, isComplete, score);
  }, [placements, config.items]);

  const handleSelectItem = (itemId: string) => {
    if (isReadOnly) return;
    setSelectedItemId(itemId === selectedItemId ? null : itemId);
  };

  const handlePlaceItem = (itemId: string, category: string) => {
    if (isReadOnly) return;
    setPlacements((prev) => ({
      ...prev,
      [itemId]: category,
    }));
    setSelectedItemId(null);
  };

  const handleRemoveItem = (itemId: string) => {
    if (isReadOnly) return;
    setPlacements((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleColumnClick = (category: string) => {
    if (isReadOnly) return;
    if (selectedItemId) {
      handlePlaceItem(selectedItemId, category);
    }
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    if (isReadOnly) return;
    e.dataTransfer.setData("text/plain", itemId);
    setSelectedItemId(itemId); // Sync
  };

  const handleDrop = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    if (isReadOnly) return;

    const itemId = e.dataTransfer.getData("text/plain") || selectedItemId;
    if (itemId) {
      handlePlaceItem(itemId, category);
    }
  };

  return (
    <div className="space-y-6">
      {config.description && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 border-b pb-2">
          {config.description}
        </p>
      )}

      {/* Categories Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {config.categories.map((cat) => {
          // Find items currently placed in this category
          const placedInCat = config.items.filter((item) => placements[item.id] === cat);

          return (
            <div
              key={cat}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, cat)}
              onClick={() => handleColumnClick(cat)}
              className={`flex flex-col border rounded p-3 min-h-[220px] transition ${
                selectedItemId
                  ? "border-dashed border-neutral-400 hover:border-black dark:hover:border-white bg-neutral-50/50 dark:bg-neutral-900/10 cursor-pointer"
                  : "border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/20"
              }`}
            >
              <h4 className="text-sm font-semibold border-b pb-2 mb-3 text-neutral-700 dark:text-neutral-300 text-center uppercase tracking-wide">
                {cat}
              </h4>

              <div className="flex-1 space-y-2">
                {placedInCat.length === 0 ? (
                  <div className="h-full flex items-center justify-center py-8">
                    <span className="text-xs text-neutral-400 italic">Drop here</span>
                  </div>
                ) : (
                  placedInCat.map((item) => {
                    const isCorrect = item.category === cat;
                    let cardClass = "p-2 rounded border bg-white dark:bg-neutral-900 text-sm flex items-center justify-between shadow-sm cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition";

                    if (isReadOnly) {
                      cardClass = isCorrect
                        ? "p-2 rounded border border-green-500 bg-green-50/50 dark:bg-green-950/20 text-green-800 dark:text-green-200 text-sm flex items-center justify-between"
                        : "p-2 rounded border border-red-500 bg-red-50/50 dark:bg-red-950/20 text-red-800 dark:text-red-200 text-sm flex items-center justify-between";
                    }

                    return (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveItem(item.id);
                        }}
                        className={cardClass}
                        title={isReadOnly ? undefined : "Click to remove"}
                      >
                        <div className="flex flex-col gap-1 w-full">
                          {item.media && (
                            <div className="w-full mb-1 max-h-20 overflow-hidden flex items-center justify-center">
                              <MediaEmbed src={item.media} assetsPath={assetsPath} className="max-h-20" />
                            </div>
                          )}
                          <span className="font-medium">{item.name}</span>
                        </div>
                        {isReadOnly && (
                          <span className="text-xs font-mono ml-2 shrink-0">
                            {isCorrect ? "✓" : `(Correct: ${item.category})`}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unplaced cards pool */}
      {!isReadOnly && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Unsorted Items
          </h4>
          <div className="flex flex-wrap gap-3 p-3 border rounded border-neutral-300 dark:border-neutral-850 bg-neutral-150/50 dark:bg-neutral-950/10 min-h-[80px]">
            {pool.length === 0 ? (
              <p className="text-xs text-neutral-450 italic flex items-center">
                All items sorted!
              </p>
            ) : (
              pool.map((item) => {
                const isSelected = selectedItemId === item.id;
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onClick={() => handleSelectItem(item.id)}
                    className={`touch-draggable p-3 rounded border shadow-sm cursor-grab select-none transition max-w-[150px] flex flex-col items-center text-center ${
                      isSelected
                        ? "border-black dark:border-white bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold"
                        : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {item.media && (
                      <div className="w-full mb-2 max-h-16 overflow-hidden flex items-center justify-center">
                        <MediaEmbed src={item.media} assetsPath={assetsPath} className="max-h-16" />
                      </div>
                    )}
                    <span className="text-xs font-medium">{item.name}</span>
                  </div>
                );
              })
            )}
          </div>
          <p className="text-xs text-neutral-450 italic">
            Tip: Drag items into a column, or click an item and then click a column.
          </p>
        </div>
      )}
    </div>
  );
};
export default Categorization;
