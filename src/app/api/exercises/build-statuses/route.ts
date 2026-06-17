import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getActiveBuildStatuses } from "@/lib/exercises";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const statuses = getActiveBuildStatuses();
    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("Error fetching active build statuses:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
