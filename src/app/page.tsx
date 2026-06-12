import Link from "next/link";
import { getSession } from "@/lib/session";
import { Navbar } from "@/components/Navbar";

export default async function Home() {
  const session = await getSession();

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16 flex flex-col justify-center items-center text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight font-mono">
            LEARN_PLATFORM
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
            A self-hosted, lightweight learning engine with interactive quizzes, multiple choice, categorization, fill-in-the-gaps, and TipToi-style media hotspot games.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 pt-4">
          {session ? (
            <Link
              href={session.role === "TEACHER" ? "/teacher" : "/student"}
              className="bg-black text-white dark:bg-white dark:text-black font-semibold font-mono text-sm px-6 py-3 rounded shadow hover:opacity-90 transition"
            >
              GO TO MY DASHBOARD ({session.role})
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="bg-black text-white dark:bg-white dark:text-black font-semibold font-mono text-sm px-6 py-3 rounded shadow hover:opacity-90 transition"
              >
                LOG IN
              </Link>
              <Link
                href="/register"
                className="border border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 font-semibold font-mono text-sm px-6 py-3 rounded shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
              >
                CREATE ACCOUNT
              </Link>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 text-left max-w-3xl">
          <div className="p-4 border border-neutral-300 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-905/20">
            <h3 className="font-semibold text-sm font-mono uppercase text-neutral-500 mb-2">
              01 / Classroom Tracking
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Teachers can create classrooms, manage assignments, and trace student completion details and scores.
            </p>
          </div>
          <div className="p-4 border border-neutral-300 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-905/20">
            <h3 className="font-semibold text-sm font-mono uppercase text-neutral-500 mb-2">
              02 / Flexible Formats
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Create and modify exercises in simple JSON or Markdown files inside separate folders for full portability.
            </p>
          </div>
          <div className="p-4 border border-neutral-300 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-905/20">
            <h3 className="font-semibold text-sm font-mono uppercase text-neutral-500 mb-2">
              03 / Interactive Media
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Overlay hotspots on images, play audio cues on click, and run gamified challenge cycles.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
