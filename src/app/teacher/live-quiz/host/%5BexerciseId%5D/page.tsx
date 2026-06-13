import React from "react";
import { requireTeacher } from "@/lib/actions/auth-helpers";
import { createLiveSession } from "@/lib/actions/live-quiz";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";

export default async function LiveQuizHostTriggerPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  await requireTeacher();
  const { exerciseId } = await params;

  let sessionId = "";
  try {
    const res = await createLiveSession(exerciseId);
    if (res.success && res.sessionId) {
      sessionId = res.sessionId;
    }
  } catch (err) {
    console.error("Failed to host live quiz:", err);
    return (
      <>
        <Navbar />
        <main className="max-w-md mx-auto py-12 px-4 text-center space-y-4">
          <div className="p-6 border border-red-200 rounded-xl bg-red-50 text-red-700">
            Failed to host quiz: Exercise not found or invalid type.
          </div>
        </main>
      </>
    );
  }

  // Redirect to host dashboard session screen
  redirect(`/teacher/live-quiz/session/${sessionId}`);
}
