import { decryptToken, encryptToken } from "@/lib/crypto";

interface LiveQuizParticipantTokenPayload {
  sessionId: string;
  participantId: string;
}

export function createLiveQuizParticipantToken(sessionId: string, participantId: string): string {
  return encryptToken(JSON.stringify({ sessionId, participantId } satisfies LiveQuizParticipantTokenPayload));
}

export function parseLiveQuizParticipantToken(token: string): LiveQuizParticipantTokenPayload | null {
  const decrypted = decryptToken(token);
  if (!decrypted) return null;

  try {
    const parsed = JSON.parse(decrypted);
    if (typeof parsed?.sessionId !== "string" || typeof parsed?.participantId !== "string") {
      return null;
    }
    return {
      sessionId: parsed.sessionId,
      participantId: parsed.participantId,
    };
  } catch {
    return null;
  }
}
