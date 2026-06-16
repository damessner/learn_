"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.refresh();
      if (data.user.role === "ADMIN") {
        router.push("/admin");
      } else if (data.user.role === "TEACHER") {
        router.push("/teacher");
      } else {
        router.push("/student");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-16">
      <div className="w-full max-w-sm border border-neutral-200 dark:border-neutral-900 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-md p-8 space-y-8">
        <div className="space-y-3 text-center">
          <h1 className="text-xl font-bold font-mono uppercase tracking-widest flex items-center justify-center">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ff2a2e] mr-2" />
            SIGN IN
          </h1>
          <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
            Enter credentials to continue
          </p>
        </div>

        {error && (
          <div className="p-3 bg-transparent border border-red-500 rounded-none text-[11px] font-mono uppercase text-red-500 tracking-wider">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="text-[9px] font-bold font-mono uppercase tracking-widest text-neutral-500 block"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              disabled={loading}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full text-xs font-mono border border-neutral-300 dark:border-neutral-800 rounded-none px-3 py-2.5 bg-transparent outline-none focus:border-black dark:focus:border-white transition duration-150"
              placeholder="Username"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-[9px] font-bold font-mono uppercase tracking-widest text-neutral-500 block"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-xs font-mono border border-neutral-300 dark:border-neutral-800 rounded-none px-3 py-2.5 bg-transparent outline-none focus:border-black dark:focus:border-white transition duration-150"
              placeholder="Password"
            />
          </div>

          <div className="text-right">
            <details className="cursor-pointer text-[9px] text-neutral-500 hover:text-black dark:hover:text-white transition font-mono uppercase tracking-wider font-semibold">
              <summary className="select-none text-right">Forgot password?</summary>
              <div className="mt-2.5 p-4 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-900 rounded-none text-left font-sans normal-case text-xs text-neutral-600 dark:text-neutral-450 leading-relaxed max-w-sm">
                <strong>Pupils:</strong> Please ask your teacher to reset your password from the classroom gradebook matrix.
                <br /><br />
                <strong>Teachers:</strong> Please contact the system administrator to update your credentials.
              </div>
            </details>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-mono uppercase text-xs tracking-wider bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white font-semibold py-3 rounded-none hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition duration-200 disabled:opacity-50 cursor-pointer"
          >
            {loading ? "AUTHENTICATING..." : "SIGN IN"}
          </button>
        </form>

        <div className="text-center text-[10px] font-mono uppercase text-neutral-500 border-t border-neutral-200 dark:border-neutral-900 pt-5">
          No account?{" "}
          <Link href="/register" className="underline hover:text-black dark:hover:text-white font-bold">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
