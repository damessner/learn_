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
      if (data.user.role === "TEACHER") {
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
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-sm border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 p-8 shadow-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold font-mono uppercase tracking-wider">
            Sign In
          </h1>
          <p className="text-xs text-neutral-500">
            Enter your username and password below
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="username"
              className="text-xs font-semibold uppercase tracking-wider text-neutral-500"
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
              className="w-full text-sm border border-neutral-300 dark:border-neutral-700 rounded px-3 py-2 bg-transparent outline-none focus:border-black dark:focus:border-white"
              placeholder="Enter your username"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-neutral-500"
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
              className="w-full text-sm border border-neutral-300 dark:border-neutral-700 rounded px-3 py-2 bg-transparent outline-none focus:border-black dark:focus:border-white"
              placeholder="Enter your password"
            />
          </div>

          <div className="text-right">
            <details className="cursor-pointer text-[10px] text-neutral-450 hover:text-black dark:hover:text-white transition font-mono uppercase font-semibold">
              <summary className="select-none text-right">Forgot password?</summary>
              <div className="mt-1.5 p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded text-left font-sans normal-case text-xs text-neutral-600 dark:text-neutral-450 leading-relaxed max-w-sm">
                <strong>Pupils:</strong> Please ask your teacher to reset your password from the classroom gradebook matrix.
                <br /><br />
                <strong>Teachers:</strong> Please contact the system administrator to update your credentials.
              </div>
            </details>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-mono uppercase text-xs tracking-wider bg-black text-white dark:bg-white dark:text-black font-semibold py-2.5 rounded hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div className="text-center text-xs text-neutral-500 border-t pt-4">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="underline hover:text-black dark:hover:text-white font-medium">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
