"use server";

import { getSession } from "@/lib/session";
import { fetchWritingCoachFeedback, GeminiFeedbackResponse, fetchImprovedCriterion, fetchVocabContextChallenge } from "@/lib/gemini";

/**
 * Server action to obtain structured feedback for a student writing draft.
 * Resolves prompts and criteria list to call the Gemini API.
 */
export async function getWritingCoachFeedback(
  text: string,
  prompt: string,
  criteria: Array<{ id: string; name: string; description: string }>,
  systemPrompt?: string
): Promise<{ success?: boolean; feedback?: GeminiFeedbackResponse; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be logged in to use the AI Writing Coach." };
  }

  // Input sanitization and boundary checks
  if (!text || text.trim() === "") {
    return { error: "Please enter some text before asking for feedback." };
  }

  if (text.length > 8000) {
    return { error: "Your text is too long (maximum 8,000 characters)." };
  }

  if (!prompt || prompt.trim() === "") {
    return { error: "Writing task prompt is missing." };
  }

  if (!criteria || criteria.length === 0) {
    return { error: "No evaluation criteria defined for this writing coach." };
  }

  try {
    const feedback = await fetchWritingCoachFeedback(
      text,
      prompt,
      criteria,
      systemPrompt
    );

    return {
      success: true,
      feedback,
    };
  } catch (error: unknown) {
    console.error("AI Writing Coach Action Error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to generate feedback. Please try again.",
    };
  }
}

/**
 * Server action for teachers to auto-improve feedback criteria details
 * using Google Gemini.
 */
export async function improveCriterionAction(
  name: string,
  description: string
): Promise<{ success?: boolean; data?: { description: string; tip: string }; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    return { error: "Access denied. Only teachers can auto-improve criteria." };
  }

  if (!name || name.trim() === "") {
    return { error: "Criterion goal name is required." };
  }

  if (!description || description.trim() === "") {
    return { error: "Criterion description or instructions is required." };
  }

  try {
    const data = await fetchImprovedCriterion(name, description);
    return {
      success: true,
      data,
    };
  } catch (error: unknown) {
    console.error("AI Improve Criterion Action Error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to improve criterion. Please try again.",
    };
  }
}

/**
 * Server action for students to obtain a contextual gap-fill challenge for a vocabulary word.
 */
export async function getVocabContextChallengeAction(
  word: string,
  translation: string
): Promise<{ success?: boolean; data?: { sentence: string; hint: string }; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be logged in to use the AI Vocabulary Challenge." };
  }

  if (!word || word.trim() === "") {
    return { error: "Vocabulary word is required." };
  }

  try {
    const data = await fetchVocabContextChallenge(word, translation);
    return {
      success: true,
      data,
    };
  } catch (error: unknown) {
    console.error("AI Vocabulary Challenge Action Error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to generate AI vocabulary challenge.",
    };
  }
}


