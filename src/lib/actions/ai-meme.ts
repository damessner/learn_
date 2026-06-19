"use server";

import { fetchEducationalMeme } from "@/lib/gemini";
import { PIXABAY_API_KEY } from "@/lib/env";

/**
 * Generates an educational meme with a fun language learning pun and a background image from Pixabay.
 */
export async function generateMasteryMeme(topic: string) {
  try {
    const memeData = await fetchEducationalMeme(topic);
    
    let imageUrl = "";
    if (PIXABAY_API_KEY && memeData.query) {
      const query = memeData.query.trim();
      const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=3`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.hits && data.hits.length > 0) {
          imageUrl = data.hits[0].webformatURL;
        }
      }
    }

    return {
      success: true,
      text: memeData.text,
      imageUrl: imageUrl || "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop",
    };
  } catch (err: unknown) {
    console.error("Failed to generate mastery meme:", err);
    return {
      error: err instanceof Error ? err.message : "Failed to generate AI reward",
    };
  }
}
