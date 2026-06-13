"use server";

import { prisma } from "@/lib/db";
import { requireTeacher } from "./auth-helpers";
import { getExerciseFromDisk } from "@/lib/exercises";

// Generate a random 6-digit PIN
function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Creates a new active Live Quiz session
 */
export async function createLiveSession(exerciseId: string) {
  const teacher = await requireTeacher();

  // Verify the exercise exists and is a live-quiz
  const exercise = getExerciseFromDisk(exerciseId);
  if (!exercise || exercise.type !== "live-quiz") {
    throw new Error("Exercise not found or is not a Live Quiz");
  }

  // Generate a unique 6-digit PIN among active sessions
  let pin = generatePin();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await prisma.liveQuizSession.findFirst({
      where: {
        pin,
        status: { not: "FINISHED" },
      },
    });
    if (!existing) break;
    pin = generatePin();
    attempts++;
  }

  const session = await prisma.liveQuizSession.create({
    data: {
      exerciseId,
      hostId: teacher.userId,
      pin,
      status: "LOBBY",
      currentQuestionIdx: 0,
    },
  });

  return { success: true, sessionId: session.id, pin: session.pin };
}

/**
 * Join a Live Quiz session using a 6-digit PIN
 */
export async function joinLiveSession(pin: string, nickname: string, userId?: string) {
  const cleanPin = pin.trim();
  const cleanNickname = nickname.trim();

  if (!cleanPin || !cleanNickname) {
    return { error: "PIN and Nickname are required." };
  }

  // Find active session
  const session = await prisma.liveQuizSession.findFirst({
    where: {
      pin: cleanPin,
      status: { not: "FINISHED" },
    },
  });

  if (!session) {
    return { error: "Active quiz session not found with this PIN." };
  }

  // Check if nickname already taken in this session
  const existingNickname = await prisma.liveParticipant.findFirst({
    where: {
      sessionId: session.id,
      name: {
        equals: cleanNickname,
      },
    },
  });

  if (existingNickname) {
    return { error: "This nickname is already taken in this session." };
  }

  // If a userId is provided, check if this user has already joined
  if (userId) {
    const existingUser = await prisma.liveParticipant.findFirst({
      where: {
        sessionId: session.id,
        userId,
      },
    });
    if (existingUser) {
      return { success: true, participantId: existingUser.id, sessionId: session.id };
    }
  }

  const participant = await prisma.liveParticipant.create({
    data: {
      sessionId: session.id,
      userId: userId || null,
      name: cleanNickname,
      score: 0,
    },
  });

  return { success: true, participantId: participant.id, sessionId: session.id };
}

/**
 * Start the Live Quiz (move from Lobby to Question 1)
 */
export async function startLiveQuiz(sessionId: string) {
  await requireTeacher();

  await prisma.liveQuizSession.update({
    where: { id: sessionId },
    data: {
      status: "QUESTION",
      currentQuestionIdx: 0,
      questionStartedAt: new Date(),
    },
  });

  return { success: true };
}

/**
 * Submits an answer for the current active question
 */
export async function submitLiveAnswer(
  sessionId: string,
  participantId: string,
  questionIdx: number,
  answerJson: string
) {
  // Can be student or guest
  const session = await prisma.liveQuizSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.status !== "QUESTION" || session.currentQuestionIdx !== questionIdx) {
    return { error: "Submissions are closed for this question." };
  }

  // Check if participant already responded to this question
  const existingResponse = await prisma.liveResponse.findFirst({
    where: {
      sessionId,
      participantId,
      questionIdx,
    },
  });

  if (existingResponse) {
    return { success: true, points: existingResponse.points, isCorrect: existingResponse.isCorrect };
  }

  // Get exercise questions to verify answer
  const exercise = getExerciseFromDisk(session.exerciseId);
  if (!exercise || exercise.type !== "live-quiz") {
    return { error: "Exercise config not found." };
  }

  const question = exercise.questions[questionIdx];
  if (!question) {
    return { error: "Question not found." };
  }

  let isCorrect = false;

  try {
    const parsedAnswer = JSON.parse(answerJson);

    if (question.type === "single-choice") {
      const selected = Number(parsedAnswer);
      isCorrect = selected === question.correctOptionIdx;
    } else if (question.type === "multiple-choice") {
      const selected = parsedAnswer as number[];
      const correct = question.correctOptionIndices || [];
      isCorrect =
        selected.length === correct.length &&
        selected.every((idx) => correct.includes(idx));
    } else if (question.type === "word-ordering") {
      const selected = parsedAnswer as string[];
      const correct = question.words || [];
      isCorrect =
        selected.length === correct.length &&
        selected.every((val, idx) => val === correct[idx]);
    } else if (question.type === "text-input") {
      const selected = String(parsedAnswer).trim().toLowerCase();
      const accepted = (question.acceptedAnswers || []).map((a) => a.trim().toLowerCase());
      isCorrect = accepted.includes(selected);
    }
  } catch (err) {
    console.error("Failed to parse live quiz answer:", err);
  }

  // Speed-based scoring calculation
  let points = 0;
  if (isCorrect && session.questionStartedAt) {
    const now = new Date();
    const elapsedSec = (now.getTime() - new Date(session.questionStartedAt).getTime()) / 1000;
    const limit = question.timeLimit || 20;
    const remainingRatio = Math.max(0, Math.min(1, 1 - elapsedSec / limit));
    // Points range between 500 (slowest correct) and 1000 (instant correct)
    points = Math.round(500 + 500 * remainingRatio);
  }

  await prisma.$transaction([
    prisma.liveResponse.create({
      data: {
        sessionId,
        participantId,
        questionIdx,
        answerJson,
        isCorrect,
        points,
      },
    }),
    prisma.liveParticipant.update({
      where: { id: participantId },
      data: {
        score: {
          increment: points,
        },
      },
    }),
  ]);

  return { success: true, points, isCorrect };
}

/**
 * End the timer for the active question (show correct answers statistics)
 */
export async function endLiveQuestion(sessionId: string) {
  await requireTeacher();

  await prisma.liveQuizSession.update({
    where: { id: sessionId },
    data: {
      status: "SHOW_CORRECT",
    },
  });

  return { success: true };
}

/**
 * Show the leaderboard for the active question
 */
export async function showLiveLeaderboard(sessionId: string) {
  await requireTeacher();

  await prisma.liveQuizSession.update({
    where: { id: sessionId },
    data: {
      status: "LEADERBOARD",
    },
  });

  return { success: true };
}

/**
 * Move to the next question
 */
export async function nextLiveQuestion(sessionId: string) {
  await requireTeacher();

  const session = await prisma.liveQuizSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) throw new Error("Session not found");

  await prisma.liveQuizSession.update({
    where: { id: sessionId },
    data: {
      status: "QUESTION",
      currentQuestionIdx: session.currentQuestionIdx + 1,
      questionStartedAt: new Date(),
    },
  });

  return { success: true };
}

/**
 * Finish the quiz and record submissions for logged-in students
 */
export async function finishLiveQuiz(sessionId: string, saveSubmissions: boolean, classroomId?: string) {
  await requireTeacher();

  const session = await prisma.liveQuizSession.findUnique({
    where: { id: sessionId },
    include: {
      participants: {
        include: {
          responses: true,
        },
      },
    },
  });

  if (!session) throw new Error("Session not found");

  const exercise = getExerciseFromDisk(session.exerciseId);
  if (!exercise || exercise.type !== "live-quiz") {
    throw new Error("Exercise config not found");
  }

  const totalQuestions = exercise.questions.length;

  if (saveSubmissions && classroomId) {
    // If they want to link to an assignment in a classroom:
    // 1. Find or create an assignment for this exercise in the classroom
    let assignment = await prisma.assignment.findFirst({
      where: {
        classroomId,
        exerciseId: session.exerciseId,
      },
    });

    if (!assignment) {
      assignment = await prisma.assignment.create({
        data: {
          classroomId,
          exerciseId: session.exerciseId,
        },
      });
    }

    // 2. Create submissions for logged-in students
    for (const part of session.participants) {
      if (part.userId) {
        // Calculate score: percentage of correct answers
        const correctCount = part.responses.filter((r) => r.isCorrect).length;
        const scorePct = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

        // Map answersJson format
        const answersMap: Record<string, unknown> = {};
        part.responses.forEach((r) => {
          const q = exercise.questions[r.questionIdx];
          if (q) {
            answersMap[q.id] = JSON.parse(r.answerJson);
          }
        });

        // Check prior submissions
        const priorSubmissionsCount = await prisma.submission.count({
          where: {
            assignmentId: assignment.id,
            studentId: part.userId,
          },
        });

        const attemptNumber = priorSubmissionsCount + 1;
        // score multiplier for attempts
        const multiplier = attemptNumber === 1 ? 1.0 : attemptNumber === 2 ? 0.75 : attemptNumber === 3 ? 0.5 : 0.25;

        await prisma.submission.create({
          data: {
            assignmentId: assignment.id,
            studentId: part.userId,
            answersJson: JSON.stringify(answersMap),
            score: scorePct,
            effectiveScore: scorePct * multiplier,
            attemptNumber,
            completed: true,
            completedAt: new Date(),
          },
        });
      }
    }
  }

  // Update status to FINISHED
  await prisma.liveQuizSession.update({
    where: { id: sessionId },
    data: {
      status: "FINISHED",
    },
  });

  return { success: true };
}
