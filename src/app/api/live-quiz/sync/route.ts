import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getExerciseFromDisk } from "@/lib/exercises";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const participantId = searchParams.get("participantId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  try {
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

    // Force query current question responses correctly
    const currentIdx = session.currentQuestionIdx;
    const currentResponses = await prisma.liveResponse.findMany({
      where: {
        sessionId,
        questionIdx: currentIdx,
      },
    });

    // Load quiz metadata (questions count, etc.)
    const exercise = getExerciseFromDisk(session.exerciseId);
    const questionsCount = exercise?.type === "live-quiz" ? exercise.questions.length : 0;
    const currentQuestion = exercise?.type === "live-quiz" ? exercise.questions[currentIdx] : null;

    // Determine stats for SHOW_CORRECT status
    let responseStats: Record<string, number> = {};
    if (session.status === "SHOW_CORRECT" && currentQuestion) {
      if (currentQuestion.type === "single-choice" || currentQuestion.type === "multiple-choice") {
        // Initialize counts for options
        const opts = currentQuestion.options || [];
        opts.forEach((_, idx) => {
          responseStats[idx] = 0;
        });

        currentResponses.forEach((r) => {
          try {
            const parsed = JSON.parse(r.answerJson);
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
            // ignore
          }
        });
      } else {
        // stats for text / ordering
        let correctCount = 0;
        let incorrectCount = 0;
        currentResponses.forEach((r) => {
          if (r.isCorrect) correctCount++;
          else incorrectCount++;
        });
        responseStats = { correct: correctCount, incorrect: incorrectCount };
      }
    }

    // Find participant details if provided
    let participantDetails = null;
    if (participantId) {
      const part = session.participants.find((p) => p.id === participantId);
      if (part) {
        const myResponse = currentResponses.find((r) => r.participantId === participantId);
        participantDetails = {
          id: part.id,
          name: part.name,
          score: part.score,
          hasAnswered: !!myResponse,
          answerPoints: myResponse?.points ?? 0,
          answerCorrect: myResponse?.isCorrect ?? false,
        };
      }
    }

    // Calculate time remaining
    let timeRemaining = 0;
    if (session.status === "QUESTION" && session.questionStartedAt && currentQuestion) {
      const elapsed = (Date.now() - new Date(session.questionStartedAt).getTime()) / 1000;
      timeRemaining = Math.max(0, Math.ceil((currentQuestion.timeLimit || 20) - elapsed));
    }

    const questionPublic = currentQuestion ? {
      type: currentQuestion.type,
      questionText: currentQuestion.questionText,
      timeLimit: currentQuestion.timeLimit,
      media: currentQuestion.media,
      options: currentQuestion.options,
      words: currentQuestion.words ? [...currentQuestion.words].sort(() => Math.random() - 0.5) : undefined,
    } : null;

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
      participantDetails,
      question: questionPublic,
    });
  } catch (error) {
    console.error("Sync API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
