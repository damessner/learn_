import React from "react";
import { Navbar } from "@/components/Navbar";
import LiveQuizPlayerClient from "./LiveQuizPlayerClient";

export default async function LiveQuizPlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ participantId?: string }>;
}) {
  const { sessionId } = await params;
  const { participantId } = await searchParams;

  if (!participantId) {
    return (
      <>
        <Navbar />
        <main className="max-w-md mx-auto py-12 px-4 text-center space-y-4">
          <div className="p-6 border border-red-200 rounded-xl bg-red-50 text-red-700">
            Invalid session: missing participant parameter. Please join again.
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <LiveQuizPlayerClient
        sessionId={sessionId}
        participantId={participantId}
      />
    </>
  );
}
