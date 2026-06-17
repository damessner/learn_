/**
 * Human-readable display labels for all exercise types in the system.
 * Used in student dashboard, teacher dashboard, and assignment player.
 */
export const EXERCISE_TYPE_LABELS: Record<string, string> = {
  "multiple-choice": "Multiple Choice",
  "drag-drop": "Drag & Drop",
  "gap-fill": "Fill in the Gaps",
  "categorization": "Categorization",
  "explore-image-map": "Image Explorer",
  "worksheet": "Mixed Worksheet",
  "clickable-choice": "Clickable Choice",
  "matching": "Matching",
  "media": "Media",
  "instruction": "Instruction",
  "open-question": "Open Question",
  "ordering": "Word Ordering",
  "image-hotspot-quiz": "Image Hotspot Quiz",
  "interactive-reading": "Interactive Reading",
  "vocabulary": "Vocabulary Practice",
  "oral-vocabulary": "Oral Vocabulary Quiz",
  "writing-coach": "AI Writing Coach",
  "live-quiz": "Live Quiz",
};

export function getExerciseTypeLabel(type: string): string {
  return EXERCISE_TYPE_LABELS[type] ?? type;
}

/**
 * Returns a visual emoji symbol representing each exercise type.
 */
export function getExerciseTypeSymbol(type: string): string {
  switch (type) {
    case "multiple-choice": return "☑️";
    case "drag-drop": return "👇";
    case "gap-fill": return "✍️";
    case "categorization": return "🗂️";
    case "explore-image-map": return "🗺️";
    case "worksheet": return "📄";
    case "clickable-choice": return "🖱️";
    case "matching": return "🧩";
    case "media": return "🎥";
    case "instruction": return "ℹ️";
    case "open-question": return "💬";
    case "ordering": return "🔢";
    case "image-hotspot-quiz": return "🎯";
    case "interactive-reading": return "📖";
    case "vocabulary": return "🔤";
    case "oral-vocabulary": return "🗣️";
    case "writing-coach": return "🤖";
    case "live-quiz": return "⚡";
    default: return "📄";
  }
}

/**
 * Generates a deterministic, stable 6-character uppercase alphanumeric code
 * from the worksheet key string. Safe for client and server rendering.
 */
export function getWorksheetUniqueCode(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  const code = Math.abs(hash).toString(36).toUpperCase();
  return (code + "000000").substring(0, 6);
}
