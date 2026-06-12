import Link from "next/link";
import { getSession, destroySession } from "@/lib/session";
import { redirect } from "next/navigation";

export async function Navbar() {
  const session = await getSession();

  const handleLogout = async () => {
    "use server";
    await destroySession();
    redirect("/");
  };

  return (
    <header className="border-b border-neutral-300 dark:border-neutral-800 bg-white dark:bg-black/50 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="font-mono font-bold text-lg tracking-wider text-black dark:text-white"
          >
            LEARN_
          </Link>
          {session && (
            <Link
              href={session.role === "TEACHER" ? "/teacher" : "/student"}
              className="text-xs font-mono uppercase bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white"
            >
              Dashboard
            </Link>
          )}
        </div>

        <nav className="flex items-center gap-4 text-sm font-medium">
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-500 font-mono">
                {session.role}: <strong className="text-neutral-800 dark:text-neutral-200">{session.username}</strong>
              </span>
              <form action={handleLogout}>
                <button
                  type="submit"
                  className="text-xs font-mono uppercase bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-900 dark:hover:bg-neutral-800 px-2.5 py-1 rounded text-neutral-800 dark:text-neutral-250 cursor-pointer"
                >
                  Logout
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-xs font-mono uppercase border border-neutral-300 dark:border-neutral-800 px-2.5 py-1 rounded hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-xs font-mono uppercase bg-black text-white dark:bg-white dark:text-black px-2.5 py-1 rounded hover:opacity-90"
              >
                Sign Up
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
