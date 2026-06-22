import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "./crypto";

describe("Token Cryptography", () => {
  it("can encrypt and decrypt a token successfully", () => {
    const originalToken = "secret-oauth-refresh-token-123456";
    const encrypted = encryptToken(originalToken);

    expect(encrypted).not.toBe(originalToken);
    expect(encrypted.split(":").length).toBe(3); // iv:authTag:ciphertext

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(originalToken);
  });

  it("returns null for invalid ciphertext format", () => {
    expect(decryptToken("invalid-format")).toBeNull();
    expect(decryptToken("a:b")).toBeNull();
    expect(decryptToken("a:b:c:d")).toBeNull();
  });

  it("returns null if decryption fails with corrupted auth tag", () => {
    const originalToken = "my-token";
    const encrypted = encryptToken(originalToken);
    const parts = encrypted.split(":");
    // Corrupt the ciphertext slightly
    parts[2] = parts[2].substring(0, parts[2].length - 2) + "00";
    const corrupted = parts.join(":");

    expect(decryptToken(corrupted)).toBeNull();
  });
});
