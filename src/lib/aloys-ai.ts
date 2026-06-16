import {
  ALOYS_AI_PROVIDER,
  OPENCODE_API_KEY,
  OPENCODE_MODEL,
  OLLAMA_API_BASE,
  OLLAMA_MODEL,
  GEMINI_API_KEY,
  GEMINI_MODEL,
} from "@/lib/env";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LearningContent {
  text: string;
  questions: Array<{
    question: string;
    options: string[];
    correctIndex: number;
  }>;
  suggestions: string[];
}

const ALOYS_SOCRATIC_PERSONA = `You are Aloys, a wise historical doctor and the founder of our school. 
Your goal is to guide students (who are pupils aged ~10-15 years) to understand concepts by asking questions, providing clues, explaining history/science, and giving scaffolded help. 
Under no circumstances should you solve worksheets directly or write full texts/essays for them. 
When a pupil asks for a direct answer, diagnose their misunderstanding, give a gentle clue, and ask a guiding question to help them figure it out themselves. 
Use a warm, encouraging, slightly grandfatherly/doctor-like tone. 
Keep vocabulary simple, sentences clear, and formatting easy to read.`;

/**
 * Sends a conversation history to the configured AI provider to get a Socratic response.
 */
export async function generateAloysResponse(
  history: ChatMessage[]
): Promise<string> {
  const provider = ALOYS_AI_PROVIDER || "opencode";

  if (provider === "opencode") {
    if (!OPENCODE_API_KEY) {
      throw new Error("OpenCode GO API Key is not configured.");
    }
    const response = await fetch("https://opencode.ai/zen/go/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENCODE_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENCODE_MODEL || "deepseek-v4-flash",
        messages: [
          { role: "system", content: ALOYS_SOCRATIC_PERSONA },
          ...history,
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenCode GO API failure (${response.status}): ${errText}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "No response received.";
  }

  if (provider === "gemini") {
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API Key is not configured.");
    }
    const model = GEMINI_MODEL || "gemini-3.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const contents = history.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: ALOYS_SOCRATIC_PERSONA }],
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API failure (${response.status}): ${errText}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";
  }

  if (provider === "ollama") {
    const response = await fetch(`${OLLAMA_API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL || "gemma2",
        messages: [
          { role: "system", content: ALOYS_SOCRATIC_PERSONA },
          ...history,
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama API failure (${response.status}): ${errText}`);
    }
    const data = await response.json();
    return data.message?.content || "No response received.";
  }

  throw new Error(`Unknown AI provider configured: ${provider}`);
}

/**
 * Generates reading text, 3-4 multiple choice questions, and 3 exploration suggestions for a topic.
 */
export async function generateLearningContent(
  topic: string
): Promise<LearningContent> {
  const provider = ALOYS_AI_PROVIDER || "opencode";

  const systemPrompt = `You are Aloys, a historical doctor and school founder. 
Your task is to generate Socratic educational content on the topic: "${topic}".
You must output strictly a JSON object matching this schema:
{
  "text": "A short, engaging educational text explaining the key ideas of the topic in simple language for a 10-15 year old child (approx. 200-300 words). Use a doctor/founder persona.",
  "questions": [
    {
      "question": "A multiple choice question testing comprehension of the text.",
      "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "correctIndex": 0
    }
  ],
  "suggestions": [
    "Suggested topic area 1",
    "Suggested topic area 2",
    "Suggested topic area 3"
  ]
}
Generate exactly 3 or 4 questions. Ensure correctIndex is a 0-indexed number representing the correct choice.
Do not include markdown backticks around the JSON in your response. Only return raw JSON.`;

  let responseText = "";

  if (provider === "opencode") {
    if (!OPENCODE_API_KEY) {
      throw new Error("OpenCode GO API Key is not configured.");
    }
    const response = await fetch("https://opencode.ai/zen/go/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENCODE_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENCODE_MODEL || "deepseek-v4-flash",
        messages: [{ role: "user", content: systemPrompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenCode GO API failure (${response.status})`);
    }
    const data = await response.json();
    responseText = data.choices?.[0]?.message?.content || "";
  } else if (provider === "gemini") {
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API Key is not configured.");
    }
    const model = GEMINI_MODEL || "gemini-3.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              text: { type: "STRING" },
              questions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    question: { type: "STRING" },
                    options: { type: "ARRAY", items: { type: "STRING" } },
                    correctIndex: { type: "INTEGER" },
                  },
                  required: ["question", "options", "correctIndex"],
                },
              },
              suggestions: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["text", "questions", "suggestions"],
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API failure (${response.status})`);
    }
    const data = await response.json();
    responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } else if (provider === "ollama") {
    const response = await fetch(`${OLLAMA_API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL || "gemma2",
        messages: [{ role: "user", content: systemPrompt }],
        format: "json",
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API failure (${response.status})`);
    }
    const data = await response.json();
    responseText = data.message?.content || "";
  }

  // Sanitize codeblock backticks if present
  let cleanText = responseText.trim();
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```json/, "").replace(/```$/, "").trim();
  }

  try {
    const parsed = JSON.parse(cleanText) as LearningContent;
    // Validate schema
    if (!parsed.text || !Array.isArray(parsed.questions) || !Array.isArray(parsed.suggestions)) {
      throw new Error("Missing required JSON properties");
    }
    return parsed;
  } catch (err) {
    console.error("Failed to parse Socratic AI JSON:", cleanText, err);
    throw new Error("Aloys was unable to format the lesson correctly. Please try again.");
  }
}
