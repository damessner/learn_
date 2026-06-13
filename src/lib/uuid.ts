/**
 * Generates a random UUID v4 string.
 *
 * Works across:
 * - Modern browsers (Web Crypto API)
 * - Node.js 14.17+ (crypto.randomUUID)
 * - Legacy environments (Math.random fallback)
 *
 * This avoids importing Node's `crypto` module in client components,
 * where Next.js would otherwise polyfill it with crypto-browserify and
 * lose `crypto.randomUUID` support.
 */
export function randomUUID(): string {
  const globalCrypto = typeof crypto !== "undefined" ? crypto : undefined;

  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    try {
      return globalCrypto.randomUUID();
    } catch {
      // Fall through to manual generation.
    }
  }

  const bytes = new Uint8Array(16);

  if (globalCrypto && typeof globalCrypto.getRandomValues === "function") {
    globalCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Version 4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Variant 10
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const parts = [
    bytes.slice(0, 4),
    bytes.slice(4, 6),
    bytes.slice(6, 8),
    bytes.slice(8, 10),
    bytes.slice(10, 16),
  ];

  return parts
    .map((part) =>
      Array.from(part, (b) => b.toString(16).padStart(2, "0")).join("")
    )
    .join("-");
}
