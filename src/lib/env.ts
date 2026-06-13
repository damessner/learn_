/**
 * Environment variable validation.
 * Throws on startup if required variables are missing or invalid.
 */

function requireEnv(name: string, opts?: { minLength?: number }): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Please set it in your .env file or environment.`
    );
  }
  if (opts?.minLength && value.length < opts.minLength) {
    throw new Error(
      `Environment variable ${name} must be at least ${opts.minLength} characters long. ` +
      `Current length: ${value.length}`
    );
  }
  return value;
}

function optionalEnv(name: string, defaultValue?: string): string | undefined {
  return process.env[name] || defaultValue;
}

// Session secret for encrypting cookies
export const SESSION_SECRET = requireEnv("SESSION_SECRET", { minLength: 32 });

// Database URL
export const DATABASE_URL = requireEnv("DATABASE_URL");

// Gemini API (optional)
export const GEMINI_API_KEY = optionalEnv("GEMINI_API_KEY");
export const GEMINI_MODEL = optionalEnv("GEMINI_MODEL", "gemini-3.5-flash-latest");
