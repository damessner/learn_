import { GEMINI_API_KEY, GEMINI_MODEL } from "@/lib/env";
import { prisma } from "@/lib/db";

export interface GeminiCriteriaFeedback {
  id: string;
  status: "completed" | "needs_work" | "not_addressed";
  feedback: string;
}

export interface GeminiFeedbackResponse {
  criteria: GeminiCriteriaFeedback[];
  overallFeedback: string;
}

/**
 * Connects to the Google Gemini API using a lightweight fetch request.
 * Enforces structured JSON output conforming to the feedback schema.
 */
export async function fetchWritingCoachFeedback(
  text: string,
  prompt: string,
  criteria: Array<{ id: string; name: string; description: string }>,
  systemPrompt?: string
): Promise<GeminiFeedbackResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error("AI Writing Coach is currently unavailable: GEMINI_API_KEY is not configured.");
  }

  const model = GEMINI_MODEL || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const criteriaText = criteria
    .map((c) => `- [ID: ${c.id}] "${c.name}": ${c.description}`)
    .join("\n");

  const userPrompt = `
Writing Task Prompt:
"""
${prompt}
"""

Feedback Criteria to Evaluate:
${criteriaText}

Student's Written Submission:
"""
${text}
"""

Please evaluate the student's text against each criterion and provide encouraging, constructive suggestions for improvement.
`;

  const systemInstructionText = `
You are an encouraging and supportive AI Writing Coach for English language learners (primary school students, around 10 years old).
Evaluate the student's text against the specified criteria list.

Crucial rules:
1. Do NOT write the text for the student.
2. Do NOT just correct all spelling/grammar errors outright. Instead, point out specific areas of strength and give scaffolded, helpful clues or ideas so they can fix mistakes and expand their text themselves.
3. Keep vocabulary, phrasing, and sentences extremely simple, clear, and encouraging.
4. Decide on a status for each criterion:
   - "completed": The student fully met the criteria.
   - "needs_work": The student made an attempt but needs revisions to meet the criteria.
   - "not_addressed": The student did not write anything addressing this criterion.

${systemPrompt ? `Additional context/guidance from the teacher:\n${systemPrompt}` : ""}
`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: userPrompt,
          },
        ],
      },
    ],
    systemInstruction: {
      parts: [
        {
          text: systemInstructionText,
        },
      ],
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          criteria: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING" },
                status: {
                  type: "STRING",
                  enum: ["completed", "needs_work", "not_addressed"],
                },
                feedback: { type: "STRING" },
              },
              required: ["id", "status", "feedback"],
            },
          },
          overallFeedback: { type: "STRING" },
        },
        required: ["criteria", "overallFeedback"],
      },
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("Gemini API call failed:", response.status, errorText);
    throw new Error(`Failed to contact AI Writing Coach: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Empty response from AI Writing Coach service.");
  }

  try {
    const parsed = JSON.parse(rawText) as GeminiFeedbackResponse;
    
    // Ensure all criteria are returned, falling back if necessary
    const criteriaMap = new Map(parsed.criteria.map((c) => [c.id, c]));
    const unifiedCriteria = criteria.map((c) => {
      const match = criteriaMap.get(c.id);
      return (
        match || {
          id: c.id,
          status: "not_addressed" as const,
          feedback: `Criterion "${c.name}" was not evaluated by the coach.`,
        }
      );
    });

    return {
      criteria: unifiedCriteria,
      overallFeedback: parsed.overallFeedback || "No overall feedback provided.",
    };
  } catch (err) {
    console.error("Failed to parse Gemini response text as JSON:", rawText, err);
    throw new Error("Invalid response structure from AI Writing Coach service.");
  }
}

export interface ImprovedCriterionResponse {
  description: string;
  tip: string;
}

/**
 * Uses Gemini to refine a teacher's criterion name and description
 * into a precise AI instruction and a simple student tip.
 */
export async function fetchImprovedCriterion(
  name: string,
  description: string
): Promise<ImprovedCriterionResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error("AI Writing Coach is currently unavailable: GEMINI_API_KEY is not configured.");
  }

  const model = GEMINI_MODEL || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const systemInstructionText = `
You are a pedagogical expert and English language tutor assisting a teacher in designing feedback goals for writing assignments.
Your task is to refine a goal description into two distinct outputs:
1. "description": A highly precise, clear grading instruction explaining exactly what mechanical or content details to check in the text.
2. "tip": A student-friendly, encouraging tip in simple English suitable for a 10-year-old child to understand what they need to write. Keep it under 20 words.
`;

  const userPrompt = `
Goal Name: "${name}"
Teacher's Draft Description: "${description}"

Please improve this feedback goal. Output it strictly in the required JSON format.
`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemInstructionText }],
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING" },
          tip: { type: "STRING" },
        },
        required: ["description", "tip"],
      },
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("Gemini API call failed:", response.status, errorText);
    throw new Error(`Failed to improve criterion: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Empty response from Gemini.");
  }

  try {
    return JSON.parse(rawText) as ImprovedCriterionResponse;
  } catch (err) {
    console.error("Failed to parse Gemini response text as JSON:", rawText, err);
    throw new Error("Invalid response format from Gemini.");
  }
}

export interface VocabChallengeResponse {
  sentence: string;
  hint: string;
}

/**
 * Uses Gemini to generate an age-appropriate contextual English sentence with a "____" blank
 * where the target word fits, along with a helpful student tip/hint.
 */
export async function fetchVocabContextChallenge(
  word: string,
  translation: string
): Promise<VocabChallengeResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error("AI services are currently unavailable: GEMINI_API_KEY is not configured.");
  }

  const model = GEMINI_MODEL || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const systemInstructionText = `
You are an expert English language teacher creating context-based vocabulary challenges for young pupils (around 10 years old).
Your task is to generate a simple, fun English sentence containing exactly one blank "____" (four underscores) where the target English word fits.
Also provide a "hint" in English that describes the meaning of the word without using the word itself.

Rules:
1. The target word must fit naturally in the "____" blank of the sentence.
2. The sentence must be simple and suitable for basic English learners.
3. The hint must describe the word's meaning clearly and keep it under 15 words.
4. Do NOT mention the target English word in the sentence or the hint (except in the blank placeholder "____").
`;

  const userPrompt = `
Target Word: "${word}" (Translation: "${translation}")

Generate a sentence with "____" and a hint. Output strictly in the required JSON format.
`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemInstructionText }],
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          sentence: { type: "STRING" },
          hint: { type: "STRING" },
        },
        required: ["sentence", "hint"],
      },
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("Gemini API call failed:", response.status, errorText);
    throw new Error(`Failed to generate vocabulary challenge: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Empty response from Gemini.");
  }

  try {
    return JSON.parse(rawText) as VocabChallengeResponse;
  } catch (err) {
    console.error("Failed to parse Gemini response text as JSON:", rawText, err);
    throw new Error("Invalid response format from Gemini.");
  }
}

export interface AIGeneratedPage {
  id: "intro" | "path_a" | "path_b" | "ending_1" | "ending_2";
  title: string;
  text: string;
  imageQuery: string;
  choices: Array<{ text: string; nextPageId: string }>;
  questions: Array<{
    type: "multiple-choice" | "open-question";
    prompt: string;
    options?: string[];
    correctOptionIdx?: number;
    keywords?: string[];
  }>;
}

export interface AIGeneratedStory {
  startPageId: string;
  pages: AIGeneratedPage[];
}

/**
 * Uses Gemini to generate a fully structured branching choice-adventure story.
 */
export async function generateAIBranchedReading(
  prompt: string,
  vocabulary?: string,
  topics?: string
): Promise<AIGeneratedStory> {
  if (!GEMINI_API_KEY) {
    throw new Error("AI services are currently unavailable: GEMINI_API_KEY is not configured.");
  }

  const model = GEMINI_MODEL || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const systemInstructionText = `
You are a creative children's book author and ESL teacher.
Your task is to generate an interactive branching story for children around 10 years old learning English.
The story must have a Choose Your Own Adventure structure with exactly 5 pages.
The page IDs must be: "intro", "path_a", "path_b", "ending_1", "ending_2".

Here is the exact branching structure you must follow:
- "intro": Starting page. Must have exactly 2 choices: one pointing to "path_a" and one to "path_b".
- "path_a": Follows choice A. Must have exactly 2 choices: one pointing to "ending_1" and one to "ending_2".
- "path_b": Follows choice B. Must have exactly 2 choices: one pointing to "ending_1" and one to "ending_2".
- "ending_1": Terminal page. Must have 0 choices.
- "ending_2": Terminal page. Must have 0 choices.

The story must incorporate the following constraints:
- Story Theme/Prompt: "${prompt}"
${vocabulary ? `- Target vocabulary words that MUST be used in the story: ${vocabulary}` : ""}
${topics ? `- Additional topics/concepts to integrate: ${topics}` : ""}

For each page, generate:
1. "title": A short, engaging title.
2. "text": The page's story text in simple English (100-150 words). Make it interesting and creative!
3. "imageQuery": A 2-3 word search query to find a matching photo on Pixabay (e.g. "magic forest path", "wooden treasure chest").
4. "choices": The options (as specified in the branching structure). Each choice must have "text" (action e.g. "Walk towards the castle") and "nextPageId".
5. "questions": An array of 1 or 2 reading comprehension questions.
   - Each question can be "multiple-choice" or "open-question".
   - "multiple-choice" questions must have "prompt" (the question), "options" (array of 3-4 options), and "correctOptionIdx" (index of correct answer, 0-indexed).
   - "open-question" questions must have "prompt" (e.g. "What color was the dragon?"), and "keywords" (an array of 1-3 short correct words, e.g. ["red", "crimson"]).

Output strictly in valid JSON format conforming to the requested schema.
`;

  const userPrompt = `
Generate a choose-your-own-adventure story based on theme: "${prompt}".
Output strictly in the required JSON format.
`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemInstructionText }],
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          startPageId: { type: "STRING" },
          pages: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING" },
                title: { type: "STRING" },
                text: { type: "STRING" },
                imageQuery: { type: "STRING" },
                choices: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      text: { type: "STRING" },
                      nextPageId: { type: "STRING" }
                    },
                    required: ["text", "nextPageId"]
                  }
                },
                questions: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      type: { type: "STRING" },
                      prompt: { type: "STRING" },
                      options: {
                        type: "ARRAY",
                        items: { type: "STRING" }
                      },
                      correctOptionIdx: { type: "INTEGER" },
                      keywords: {
                        type: "ARRAY",
                        items: { type: "STRING" }
                      }
                    },
                    required: ["type", "prompt"]
                  }
                }
              },
              required: ["id", "title", "text", "imageQuery", "choices", "questions"]
            }
          }
        },
        required: ["startPageId", "pages"]
      }
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("Gemini API call failed:", response.status, errorText);
    throw new Error(`Failed to generate story: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Empty response from Gemini.");
  }

  try {
    return JSON.parse(rawText) as AIGeneratedStory;
  } catch (err) {
    console.error("Failed to parse Gemini response text as JSON:", rawText, err);
    throw new Error("Invalid response format from Gemini.");
  }
}

export interface VocabDefinitionResponse {
  definition: string;
}

/**
 * Uses Gemini to generate an age-appropriate simple English definition for a vocabulary word.
 */
export async function fetchVocabDefinition(
  word: string,
  translation: string
): Promise<VocabDefinitionResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error("AI services are currently unavailable: GEMINI_API_KEY is not configured.");
  }

  const model = GEMINI_MODEL || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const systemInstructionText = `
You are an expert English language teacher creating simple definitions for young pupils (around 10 years old).
Your task is to generate a simple, clear definition in English for the target vocabulary word.

Rules:
1. The definition must be easy to understand for basic English learners.
2. Keep the definition under 15 words.
3. Do NOT mention the target English word or any of its close variations in the definition.
`;

  const userPrompt = `
Target Word: "${word}" (Translation: "${translation}")

Generate a simple definition in English. Output strictly in the required JSON format.
`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemInstructionText }],
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          definition: { type: "STRING" },
        },
        required: ["definition"],
      },
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("Gemini API call failed:", response.status, errorText);
    throw new Error(`Failed to generate definition: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Empty response from Gemini.");
  }

  try {
    return JSON.parse(rawText) as VocabDefinitionResponse;
  } catch (err) {
    console.error("Failed to parse Gemini response text as JSON:", rawText, err);
    throw new Error("Invalid response format from Gemini.");
  }
}

/**
 * Uses Gemini to generate a Socratic, encouraging hint for a worksheet question.
 */
export async function fetchSocraticHint(
  questionData: Record<string, unknown>
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("AI services are currently unavailable: GEMINI_API_KEY is not configured.");
  }

  const model = GEMINI_MODEL || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const systemInstructionText = `
You are a helpful, supportive middle-school English teacher (for pupils aged 10-14).
Your task is to generate a brief, encouraging, Socratic hint to help the student solve the task without giving the answer away directly.
It should ask a guiding question, point to a key word, or provide a spelling/context clue.
Keep the hint under 15 words and extremely clear for young learners.
`;

  const userPrompt = `
Worksheet Task Data:
"""
${JSON.stringify(questionData)}
"""

Generate a Socratic hint in the required JSON format.
`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemInstructionText }],
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          hint: { type: "STRING" },
        },
        required: ["hint"],
      },
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("Gemini API call failed:", response.status, errorText);
    throw new Error(`Failed to generate hint: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Empty response from Gemini.");
  }

  try {
    const parsed = JSON.parse(rawText) as { hint?: string };
    return parsed.hint || "";
  } catch (err) {
    console.error("Failed to parse Gemini hint response text as JSON:", rawText, err);
    throw new Error("Invalid response format from Gemini.");
  }
}

/**
 * Uses Gemini to extract a simple 1-2 word search keyword for a worksheet question.
 */
export async function fetchImageQuery(
  questionData: Record<string, unknown>
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("AI services are currently unavailable: GEMINI_API_KEY is not configured.");
  }

  const model = GEMINI_MODEL || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const systemInstructionText = `
Given a worksheet question configuration, extract a single 1-2 word English search term (a simple, descriptive noun, e.g. "cow", "soccer", "castle", "running") that would be ideal for searching a photo library (like Pixabay) to visually represent this task to a 10-14 year old student.
`;

  const userPrompt = `
Worksheet Task Data:
"""
${JSON.stringify(questionData)}
"""

Generate a simple 1-2 word search term in the required JSON format.
`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemInstructionText }],
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          query: { type: "STRING" },
        },
        required: ["query"],
      },
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("Gemini API call failed:", response.status, errorText);
    throw new Error(`Failed to generate query: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Empty response from Gemini.");
  }

  try {
    const parsed = JSON.parse(rawText) as { query?: string };
    return parsed.query || "";
  } catch (err) {
    console.error("Failed to parse Gemini query response text as JSON:", rawText, err);
    throw new Error("Invalid response format from Gemini.");
  }
}

export interface GeminiMemeResponse {
  text: string;
  query: string;
}

/**
 * Uses Gemini to generate an age-appropriate simple English pun/meme and a matching Pixabay image search query.
 */
export async function fetchEducationalMeme(
  topic: string
): Promise<GeminiMemeResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error("AI services are currently unavailable: GEMINI_API_KEY is not configured.");
  }

  const model = GEMINI_MODEL || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const systemInstructionText = `
You are an encouraging middle-school English teacher.
Your task is to generate a short, clean, funny educational pun or meme text about a given grammar/vocabulary learning topic.
Keep the humor extremely simple and appropriate for 10-14 year old kids.
Also, extract a single 1-word English noun search query (e.g. "cat", "dog", "running", "pizza") that will yield a funny or cute photo on Pixabay to serve as the background of this meme.
`;

  const userPrompt = `
Learning Topic: "${topic}"

Generate the meme text and the search query in the required JSON format.
`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemInstructionText }],
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          query: { type: "STRING" },
        },
        required: ["text", "query"],
      },
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("Gemini API call failed:", response.status, errorText);
    throw new Error(`Failed to generate meme: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Empty response from Gemini.");
  }

  try {
    return JSON.parse(rawText) as GeminiMemeResponse;
  } catch (err) {
    console.error("Failed to parse Gemini meme response text as JSON:", rawText, err);
    throw new Error("Invalid response format from Gemini.");
  }
}

export interface WordOfTheDayResponse {
  word: string;
  translation: string;
  definition: string;
  example: string;
  mnemonic: string;
}

/**
 * Gets the Word of the Day for a given date. Checks the SQLite DB cache first.
 * If not found, calls Gemini to generate a date-seeded word, translation, definition, example, and mnemonic.
 * Falls back to deterministic pre-defined words if the API is unavailable.
 */
export async function getOrGenerateWordOfTheDay(
  dateStr: string
): Promise<WordOfTheDayResponse> {
  // 1. Try to find in db cache
  try {
    const existing = await prisma.wordOfTheDay.findUnique({
      where: { date: dateStr },
    });
    if (existing) {
      return {
        word: existing.word,
        translation: existing.translation,
        definition: existing.definition,
        example: existing.example,
        mnemonic: existing.mnemonic,
      };
    }
  } catch (dbErr) {
    console.error("Failed to fetch word of the day from DB cache:", dbErr);
  }

  // 2. Generate using Gemini
  if (GEMINI_API_KEY) {
    try {
      const model = GEMINI_MODEL || "gemini-3.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

      const systemInstructionText = `
You are an encouraging middle-school English teacher.
Your task is to generate the "Word of the Day" for ESL students (aged 10-14).
Choose a word that is interesting, positive, and useful (CEFR A2-B1, e.g., "explore", "courage", "scrumptious", "diligent", "habitat", "harmony", "curious").
Do not choose extremely simple words like "dog" or "happy", nor extremely hard academic words like "anachronism".

Generate:
1. "word": The target English word.
2. "translation": The German translation of the word.
3. "definition": A simple, clear definition in English (max 15 words) suitable for a child.
4. "example": A short, clear example sentence using the word.
5. "mnemonic": A fun, simple memory trick or mnemonic (max 20 words) to help them remember it.

Generate this based on the calendar date: ${dateStr}.
Output strictly in the required JSON format.
`;

      const userPrompt = `Generate the Word of the Day for date: "${dateStr}" in the required JSON format.`;

      const requestBody = {
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstructionText }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              word: { type: "STRING" },
              translation: { type: "STRING" },
              definition: { type: "STRING" },
              example: { type: "STRING" },
              mnemonic: { type: "STRING" },
            },
            required: ["word", "translation", "definition", "example", "mnemonic"],
          },
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20_000);
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText) as WordOfTheDayResponse;
          
          parsed.word = parsed.word.trim();
          parsed.translation = parsed.translation.trim();
          parsed.definition = parsed.definition.trim();
          parsed.example = parsed.example.trim();
          parsed.mnemonic = parsed.mnemonic.trim();

          // Save to database cache
          try {
            await prisma.wordOfTheDay.create({
              data: {
                date: dateStr,
                word: parsed.word,
                translation: parsed.translation,
                definition: parsed.definition,
                example: parsed.example,
                mnemonic: parsed.mnemonic,
              },
            });
          } catch (dbSaveErr) {
            console.error("Failed to save generated word of the day to DB:", dbSaveErr);
          }

          return parsed;
        }
      }
    } catch (genErr) {
      console.error("Failed to generate word of the day using Gemini:", genErr);
    }
  }

  // 3. Fallback selection based on day of week if API key missing or generation fails
  const dayIndex = new Date(dateStr).getDay();
  const fallbacks: WordOfTheDayResponse[] = [
    {
      word: "Gratitude",
      translation: "Dankbarkeit",
      definition: "Being thankful and showing appreciation for help or good things.",
      example: "Showing gratitude makes both you and the other person feel happy.",
      mnemonic: "Remember: 'Great attitude' starts with gratitude!",
    },
    {
      word: "Cooperation",
      translation: "Zusammenarbeit",
      definition: "Working together with someone to achieve a shared goal.",
      example: "With cooperation, the class finished the poster in ten minutes.",
      mnemonic: "Co-operation means 'operating' as a 'company' of friends!",
    },
    {
      word: "Curiosity",
      translation: "Neugierde",
      definition: "A strong desire to learn or know about something.",
      example: "His curiosity led him to read every book about stars.",
      mnemonic: "Curiosity makes you 'cure' your 'odd' questions by learning!",
    },
    {
      word: "Adventure",
      translation: "Abenteuer",
      definition: "An exciting and sometimes risky experience or journey.",
      example: "They went on an adventure into the dark, mysterious forest.",
      mnemonic: "Add 'venture' (trying something new) to get an adventure!",
    },
    {
      word: "Bravery",
      translation: "Mut",
      definition: "Courageous behavior or character in the face of fear.",
      example: "It took bravery for the little bird to fly for the first time.",
      mnemonic: "Brave people say 'rave' when they overcome fear!",
    },
    {
      word: "Creativity",
      translation: "Kreativität",
      definition: "The use of imagination to create original ideas or things.",
      example: "She showed great creativity by painting a tree with blue leaves.",
      mnemonic: "Creativity lets you 'create' a 'city' in your mind!",
    },
    {
      word: "Patience",
      translation: "Geduld",
      definition: "The ability to wait for a long time without getting angry.",
      example: "Baking cookies requires patience while they cook in the oven.",
      mnemonic: "Patience is like a 'path' to a 'peaceful' mind!",
    },
  ];

  return fallbacks[dayIndex] || fallbacks[0];
}

/**
 * Uses Gemini to generate a class-wide pedagogical diagnostics report and action plan.
 */
export async function generateClassroomDiagnosticReport(
  stats: {
    className: string;
    numStudents: number;
    classAverage: number | string;
    categoryAverages: Record<string, number>;
    strugglingStudents: Array<{ username: string; average: number; struggles: string[] }>;
    lowScoringExercises: Array<{ title: string; average: number }>;
  }
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("AI services are currently unavailable: GEMINI_API_KEY is not configured.");
  }

  const model = GEMINI_MODEL || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const systemInstructionText = `
You are an expert pedagogical diagnostics assistant and neuroscience-backed learning consultant.
Your task is to write a highly concise, professional, and encouraging diagnostic report and action plan for a middle school English teacher.
The report must use clean Markdown formatting, using the following exact sections:
1. ### Class-Wide Strengths
   A concise bulleted list of 2-3 areas where the students are performing well.
2. ### Class-Wide Struggle Areas
   A concise bulleted list of 2-3 areas where students are finding difficulty (e.g., spelling, writing structure, comprehension).
3. ### Neuroscience-Backed Action Plan
   Provide exactly 3 concrete lesson adjustments or quick active-retrieval classroom interventions (e.g., "Do a 5-minute peer-explain session," "Conduct a speed vocabulary retrieval round before worksheets," "Provide a scaffolded gap-fill check-in").

Ensure the total word count is under 250 words. Do not list individual students by name in the public recommendation sections to maintain privacy, but speak generally about the clusters of struggling students. Keep instructions directly actionable.
`;

  const userPrompt = `
Classroom Name: "${stats.className}"
Number of Students: ${stats.numStudents}
Class Overall Average Score: ${stats.classAverage}%
Performance by Assignment Type:
${Object.entries(stats.categoryAverages)
  .map(([cat, avg]) => `- ${cat}: ${avg}% average`)
  .join("\n")}

Low-Scoring Assignments (average < 75%):
${stats.lowScoringExercises.length > 0
  ? stats.lowScoringExercises.map((ex) => `- "${ex.title}": ${ex.average}% avg`).join("\n")
  : "None"}

Struggling Student Overview:
${stats.strugglingStudents.length > 0
  ? stats.strugglingStudents.map((s) => `- Pupil with ${s.average}% average struggles in: ${s.struggles.join(", ")}`).join("\n")
  : "All students performing well."}

Please generate the Markdown diagnostic report.
`;

  const requestBody = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemInstructionText }] },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35_000);
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      throw new Error(`Gemini API failed with status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Empty response from Gemini.");
    }
    return rawText.trim();
  } catch (err) {
    console.error("Failed to generate class diagnostics:", err);
    throw err;
  }
}




