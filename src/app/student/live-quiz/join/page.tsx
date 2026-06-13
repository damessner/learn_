import React, { Suspense } from "react";
import { getSession } from "@/lib/session";
import JoinClientForm from "./JoinClientForm";
import { Navbar } from "@/components/Navbar";
import { Loader2 } from "lucide-react";

export default async function LiveQuizJoinPage() {
  const session = await getSession();

  return (
    <>
      <Navbar />
      <main className="flex-1 flex items-center justify-center min-h-[80vh] px-4 py-12 bg-neutral-50 dark:bg-neutral-955">
        <div className="max-w-md w-full border border-neutral-200 dark:border-neutral-850 rounded-2xl bg-white dark:bg-neutral-900 p-8 shadow-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-955/45 text-purple-650 dark:text-purple-400 rounded-xl flex items-center justify-center mx-auto border border-purple-200/50">
              <span className="text-xl font-bold font-mono">🚀</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight font-mono uppercase text-neutral-900 dark:text-neutral-100">
              Join Live Quiz
            </h1>
            <p className="text-xs text-neutral-450">
              Enter the 6-digit game PIN shown by your teacher to participate.
            </p>
          </div>

          <Suspense fallback={
            <div className="flex flex-col items-center justify-center py-6 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              <span className="text-[10px] text-neutral-400 font-mono">Loading form...</span>
            </div>
          }>
            <JoinClientForm
              userId={session?.userId}
              defaultNickname={session?.username || ""}
            />
          </Suspense>
        </div>
      </main>
    </>
  );
}
