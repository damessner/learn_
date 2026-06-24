import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getExerciseFromDisk } from "@/lib/exercises";
import { getSession } from "@/lib/session";
import { parseLiveQuizParticipantToken } from "@/lib/live-quiz-auth";

function buildQuestionResponse(
  question:
    | {
        type: "single-choice" | "multiple-choice" | "word-ordering" | "text-input";
        questionText: string;
        timeLimit: number;
        media?: string;
        options?: string[];
        words?: string[];
      }
    | null
) {
  if (!question) return null;

  return {
    type: question.type,
    questionText: question.questionText,
    timeLimit: question.timeLimit,
    media: question.media,
    options: question.options,
    words: question.words,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const participantId = searchParams.get("participantId");
  const participantToken = searchParams.get("participantToken");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  try {
    const callerSession = await getSession();
    const session = await prisma.liveQuizSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          orderBy: { score: "desc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isHost = callerSession?.userId === session.hostId;
    let participant = null;

    if (!isHost) {
      if (!participantId || !participantToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const tokenPayload = parseLiveQuizParticipantToken(participantToken);
      if (!tokenPayload || tokenPayload.sessionId !== sessionId || tokenPayload.participantId !== participantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      participant = session.participants.find((p) => p.id === participantId) ?? null;
      if (!participant) {
        return NextResponse.json({ error: "Participant not found" }, { status: 404 });
      }
    }

    const currentIdx = session.currentQuestionIdx;
    const currentResponses = await prisma.liveResponse.findMany({
      where: {
        sessionId,
        questionIdx: currentIdx,
      },
    });

    const exercise = getExerciseFromDisk(session.exerciseId);
    const questionsCount = exercise?.type === "live-quiz" ? exercise.questions.length : 0;
    const currentQuestion = exercise?.type === "live-quiz" ? exercise.questions[currentIdx] : null;

    let responseStats: Record<string, number> = {};
    if (session.status === "SHOW_CORRECT" && currentQuestion) {
      if (currentQuestion.type === "single-choice" || currentQuestion.type === "multiple-choice") {
        const opts = currentQuestion.options || [];
        opts.forEach((_, idx) => {
          responseStats[idx] = 0;
        });

        currentResponses.forEach((response) => {
          try {
            const parsed = JSON.parse(response.answerJson);
            if (Array.isArray(parsed)) {
              parsed.forEach((idx) => {
                const numIdx = Number(idx);
                if (responseStats[numIdx] !== undefined) {
                  responseStats[numIdx]++;
                }
              });
            } else {
              const numIdx = Number(parsed);
              if (responseStats[numIdx] !== undefined) {
                responseStats[numIdx]++;
              }
            }
          } catch {
            // ignore malformed historic answers
          }
        });
      } else {
        let correctCount = 0;
        let incorrectCount = 0;
        currentResponses.forEach((response) => {
          if (response.isCorrect) correctCount++;
          else incorrectCount++;
        });
        responseStats = { correct: correctCount, incorrect: incorrectCount };
      }
    }

    let participantDetails = null;
    let participantRank: number | null = null;
    if (participant) {
      const myResponse = currentResponses.find((response) => response.participantId === participant.id);
      participantRank = session.participants.findIndex((p) => p.id === participant.id) + 1;
      participantDetails = {
        id: participant.id,
        name: participant.name,
        score: participant.score,
        hasAnswered: !!myResponse,
        answerPoints: myResponse?.points ?? 0,
        answerCorrect: myResponse?.isCorrect ?? false,
      };
    }

    let timeRemaining = 0;
    if (session.status === "QUESTION" && session.questionStartedAt && currentQuestion) {
      const elapsed = (Date.now() - new Date(session.questionStartedAt).getTime()) / 1000;
      timeRemaining = Math.max(0, Math.ceil((currentQuestion.timeLimit || 20) - elapsed));
    }

    if (isHost) {
      return NextResponse.json({
        status: session.status,
        currentQuestionIdx: session.currentQuestionIdx,
        questionStartedAt: session.questionStartedAt,
        pin: session.pin,
        totalQuestions: questionsCount,
        timeRemaining,
        participantsCount: session.participants.length,
        participants: session.participants.map((p, index) => ({
          id: p.id,
          name: p.name,
          score: p.score,
          rank: index + 1,
        })),
        responsesCount: currentResponses.length,
        responseStats,
        question: buildQuestionResponse(currentQuestion),
      });
    }

    return NextResponse.json({
      status: session.status,
      currentQuestionIdx: session.currentQuestionIdx,
      totalQuestions: questionsCount,
      timeRemaining,
      participantsCount: session.participants.length,
      responsesCount: currentResponses.length,
      participantDetails,
      participantRank,
      question: buildQuestionResponse(currentQuestion),
    });
  } catch (error) {
    console.error("Sync API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
