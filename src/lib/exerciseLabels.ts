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
};

export function getExerciseTypeLabel(type: string): string {
  return EXERCISE_TYPE_LABELS[type] ?? type;
}
