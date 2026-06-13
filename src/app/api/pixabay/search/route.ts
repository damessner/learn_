import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { PIXABAY_API_KEY } from "@/lib/env";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!PIXABAY_API_KEY) {
    return NextResponse.json(
      { error: "Pixabay API is not configured on the server." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  if (!query.trim()) {
    return NextResponse.json({ hits: [] });
  }

  try {
    const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(
      query.trim()
    )}&image_type=photo&per_page=24`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error("Pixabay API request failed:", res.statusText);
      return NextResponse.json(
        { error: "Failed to fetch images from Pixabay" },
        { status: res.status }
      );
    }

    const data = await res.json();
    
    interface PixabayHit {
      id: number;
      previewURL: string;
      webformatURL: string;
      largeImageURL: string;
      tags: string;
    }

    // Map to a clean, lightweight payload
    const hits = (data.hits || []).map((hit: PixabayHit) => ({
      id: hit.id,
      previewURL: hit.previewURL,
      webformatURL: hit.webformatURL,
      largeImageURL: hit.largeImageURL,
      tags: hit.tags,
    }));

    return NextResponse.json({ hits });
  } catch (error) {
    console.error("Error in Pixabay search proxy:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
