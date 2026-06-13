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

  const model = GEMINI_MODEL || "gemini-3.5-flash-latest";
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

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

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

  const model = GEMINI_MODEL || "gemini-3.5-flash-latest";
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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

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

