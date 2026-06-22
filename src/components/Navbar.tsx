import Link from "next/link";
import { getSession, destroySession } from "@/lib/session";
import { redirect } from "next/navigation";

export async function Navbar() {
  const session = await getSession();
  const isBreakGlass = !!(session &&
    process.env.BREAKGLASS_PASSWORD_HASH &&
    session.username === (process.env.BREAKGLASS_USERNAME ?? "_breakglass"));

  const handleLogout = async () => {
    "use server";
    await destroySession();
    redirect("/");
  };

  return (
    <>
      {isBreakGlass && (
        <div
          role="alert"
          id="breakglass-banner"
          className="bg-red-600 dark:bg-red-700 text-white text-center text-[11px] font-mono py-1.5 px-4 tracking-wide"
        >
          🚨 <strong>Break-glass</strong> emergency account active — create a permanent admin account, then log out.
        </div>
      )}
      <header className="border-b border-neutral-200 dark:border-neutral-900 bg-white/70 dark:bg-black/70 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="font-mono font-bold text-lg tracking-widest text-black dark:text-white uppercase select-none hover:opacity-85 transition"
          >
            LEARN<span className="text-[#ff2a2e] font-extrabold animate-pulse">.</span>
          </Link>
          {session && (
            <div className="flex items-center gap-2">
              <Link
                href={
                  session.role === "ADMIN"
                    ? "/admin"
                    : session.role === "TEACHER"
                    ? "/teacher"
                    : "/student"
                }
                className="text-[10px] font-mono uppercase border border-neutral-200 dark:border-neutral-800 px-2.5 py-0.5 rounded-none text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition duration-150"
              >
                Dashboard
              </Link>
              {session.role === "TEACHER" && (
                <Link
                  href="/teacher/pool"
                  className="text-[10px] font-mono uppercase border border-neutral-200 dark:border-neutral-800 px-2.5 py-0.5 rounded-none text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition duration-150"
                >
                  Worksheet Pool
                </Link>
              )}
            </div>
          )}
        </div>

        <nav className="flex items-center gap-4 text-xs font-medium">
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
                {session.role} <strong className="text-neutral-800 dark:text-neutral-200 font-bold font-sans">{session.username}</strong>
              </span>
              <form action={handleLogout}>
                <button
                  type="submit"
                  className="text-[10px] font-mono uppercase border border-neutral-300 dark:border-neutral-800 bg-transparent hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black px-3 py-1 rounded-none transition duration-150 cursor-pointer"
                >
                  Logout
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-[10px] font-mono uppercase border border-neutral-300 dark:border-neutral-800 bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-900 px-3 py-1 rounded-none text-neutral-700 dark:text-neutral-300 transition duration-150"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-[10px] font-mono uppercase bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white px-3 py-1 rounded-none hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition duration-150"
              >
                Sign Up
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
    </>
  );
}
