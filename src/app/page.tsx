import Link from "next/link";
import { getSession } from "@/lib/session";
import { Navbar } from "@/components/Navbar";

export default async function Home() {
  const session = await getSession();

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-20 flex flex-col justify-center items-center text-center space-y-12">
        <div className="space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold tracking-widest font-mono select-none uppercase">
            LEARN<span className="text-[#ff2a2e] font-extrabold animate-pulse">.</span>
          </h1>
          <p className="text-sm md:text-base text-neutral-500 max-w-xl mx-auto leading-relaxed">
            A self-hosted, lightweight learning engine with interactive quizzes, multiple choice, categorization, fill-in-the-gaps, and TipToi-style media hotspot games.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 pt-2">
          {session ? (
            <Link
              href={session.role === "TEACHER" ? "/teacher" : "/student"}
              className="bg-black text-white dark:bg-white dark:text-black font-mono text-xs uppercase tracking-wider px-8 py-3.5 border border-black dark:border-white rounded-none hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition duration-200"
            >
              GO TO MY DASHBOARD ({session.role})
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="bg-black text-white dark:bg-white dark:text-black font-mono text-xs uppercase tracking-wider px-8 py-3.5 border border-black dark:border-white rounded-none hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition duration-200"
              >
                LOG IN
              </Link>
              <Link
                href="/register"
                className="border border-neutral-300 dark:border-neutral-800 bg-transparent text-neutral-800 dark:text-neutral-200 font-mono text-xs uppercase tracking-wider px-8 py-3.5 rounded-none hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black hover:border-black dark:hover:border-white transition duration-200"
              >
                CREATE ACCOUNT
              </Link>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-left max-w-3xl w-full">
          <div className="p-6 border border-neutral-200 dark:border-neutral-900 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-sm hover:border-neutral-400 dark:hover:border-neutral-700 transition duration-250">
            <h3 className="font-bold text-xs font-mono uppercase text-[#ff2a2e] mb-3 tracking-widest flex items-center">
              <span className="inline-block w-1 h-1 rounded-full bg-[#ff2a2e] mr-2" />
              01 / TRACKING
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-sans">
              Teachers can create classrooms, manage assignments, and trace student completion details and scores.
            </p>
          </div>
          <div className="p-6 border border-neutral-200 dark:border-neutral-900 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-sm hover:border-neutral-400 dark:hover:border-neutral-700 transition duration-250">
            <h3 className="font-bold text-xs font-mono uppercase text-[#ff2a2e] mb-3 tracking-widest flex items-center">
              <span className="inline-block w-1 h-1 rounded-full bg-[#ff2a2e] mr-2" />
              02 / FORMATS
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-sans">
              Create and modify exercises in simple JSON or Markdown files inside separate folders for full portability.
            </p>
          </div>
          <div className="p-6 border border-neutral-200 dark:border-neutral-900 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-sm hover:border-neutral-400 dark:hover:border-neutral-700 transition duration-250">
            <h3 className="font-bold text-xs font-mono uppercase text-[#ff2a2e] mb-3 tracking-widest flex items-center">
              <span className="inline-block w-1 h-1 rounded-full bg-[#ff2a2e] mr-2" />
              03 / INTERACTIVE
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-sans">
              Overlay hotspots on images, play audio cues on click, and run gamified challenge cycles.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
