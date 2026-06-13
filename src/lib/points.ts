/**
 * Shared utility for calculating maximum points for exercise widgets.
 */

// Helper function to get max points per task
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTaskMaxPoints(q: any): number {
  if (q.type === "media" || q.type === "instruction") return 0;
  if (q.type === "multiple-choice") return 1;
  if (q.type === "gap-fill" || q.type === "drag-drop") {
    const gaps = (q.text || "").match(/<<(.*?)>>|\[(.*?)\]/g) || [];
    return gaps.length > 0 ? gaps.length : 1;
  }
  if (q.type === "categorization") return (q.items || []).length || 1;
  if (q.type === "clickable-choice") return (q.statements || []).length || 1;
  if (q.type === "matching") return (q.pairs || []).length || 1;
  if (q.type === "open-question") return 1;
  if (q.type === "ordering") return 1;
  return 1;
}

// Helper function to get max points for entire exercise
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getExerciseMaxPoints(exercise: any): number {
  if (exercise.type === "worksheet") {
    let totalMax = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (exercise.questions || []).forEach((q: any) => {
      totalMax += getTaskMaxPoints(q);
    });
    return totalMax;
  }
  if (exercise.type === "image-hotspot-quiz") {
    return (exercise.tasks || []).length || 1;
  }
  if (exercise.type === "interactive-reading") {
    let totalQuestions = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.values(exercise.pages || {}).forEach((page: any) => {
      totalQuestions += (page.questions || []).length;
    });
    return totalQuestions || 1;
  }
  if (exercise.type === "explore-image-map") {
    return 1;
  }
  if (exercise.type === "multiple-choice") {
    return (exercise.questions || []).length || 1;
  }
  if (exercise.type === "gap-fill" || exercise.type === "drag-drop") {
    const gaps = (exercise.text || "").match(/<<(.*?)>>|\[(.*?)\]/g) || [];
    return gaps.length > 0 ? gaps.length : 1;
  }
  if (exercise.type === "categorization") {
    return (exercise.items || []).length || 1;
  }
  if (exercise.type === "clickable-choice") {
    return (exercise.statements || []).length || 1;
  }
  if (exercise.type === "matching") {
    return (exercise.pairs || []).length || 1;
  }
  if (exercise.type === "vocabulary") {
    return (exercise.vocabList || []).length || 1;
  }
  if (exercise.type === "open-question") return 1;
  if (exercise.type === "ordering") return 1;
  return 1;
}
