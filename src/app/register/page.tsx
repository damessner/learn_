"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"TEACHER" | "STUDENT">("STUDENT");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        username,
        password,
        role,
        joinCode: role === "STUDENT" ? joinCode : undefined,
      };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      router.refresh();
      if (data.user.role === "TEACHER") {
        router.push("/teacher");
      } else {
        router.push("/student");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-sm border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 p-8 shadow-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold font-mono uppercase tracking-wider">
            Create Account
          </h1>
          <p className="text-xs text-neutral-500">
            Sign up as a teacher or join a class as a student
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block mb-1">
              I am a...
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("STUDENT")}
                className={`py-2 rounded text-xs font-semibold border transition ${
                  role === "STUDENT"
                    ? "border-black dark:border-white bg-black text-white dark:bg-white dark:text-black"
                    : "border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setRole("TEACHER")}
                className={`py-2 rounded text-xs font-semibold border transition ${
                  role === "TEACHER"
                    ? "border-black dark:border-white bg-black text-white dark:bg-white dark:text-black"
                    : "border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                Teacher
              </button>
            </div>
          </div>

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
              placeholder="Pick a username"
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
              placeholder="Choose a password (min 6 characters)"
              minLength={6}
            />
            <p className="text-[10px] text-neutral-400 mt-0.5">At least 6 characters</p>
          </div>

          {role === "STUDENT" && (
            <div className="space-y-1">
              <label
                htmlFor="joinCode"
                className="text-xs font-semibold uppercase tracking-wider text-neutral-500"
              >
                Classroom Join Code
              </label>
              <input
                id="joinCode"
                type="text"
                required
                disabled={loading}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full text-sm border border-neutral-300 dark:border-neutral-700 rounded px-3 py-2 bg-transparent outline-none focus:border-black dark:focus:border-white font-mono"
                placeholder="6-character code"
                maxLength={6}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-mono uppercase text-xs tracking-wider bg-black text-white dark:bg-white dark:text-black font-semibold py-2.5 rounded hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Registering..." : "Sign Up"}
          </button>
        </form>

        <div className="text-center text-xs text-neutral-500 border-t pt-4">
          Already have an account?{" "}
          <Link href="/login" className="underline hover:text-black dark:hover:text-white font-medium">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
