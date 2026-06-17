import { GEMINI_API_KEY, GEMINI_MODEL } from "@/lib/env";

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


