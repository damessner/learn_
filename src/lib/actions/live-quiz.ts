"use server";

import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireTeacher } from "./auth-helpers";
import { getExerciseFromDisk } from "@/lib/exercises";
import { getAttemptMultiplier } from "@/lib/scoring";
import { evaluateAnswerCorrectness } from "@/lib/live-quiz-utils";

// Generate a random 6-digit PIN
function generatePin(): string {
  return crypto.randomInt(100000, 1000000).toString();
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

  if (cleanPin.length !== 6 || !/^\d+$/.test(cleanPin)) {
    return { error: "PIN must be exactly 6 digits." };
  }
  if (cleanNickname.length > 50) {
    return { error: "Nickname must be 50 characters or fewer." };
  }

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
  const teacher = await requireTeacher();

  const session = await prisma.liveQuizSession.findUnique({ where: { id: sessionId } });
  if (!session || session.hostId !== teacher.userId) {
    return { error: "Access denied" };
  }

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

  // Verify participant belongs to this session
  const participant = await prisma.liveParticipant.findUnique({
    where: { id: participantId },
  });
  if (!participant || participant.sessionId !== sessionId) {
    return { error: "Invalid participant." };
  }

  // If participant is linked to a user, verify the caller is that user
  if (participant.userId) {
    const { getSession } = await import("@/lib/session");
    const callerSession = await getSession();
    if (!callerSession || callerSession.userId !== participant.userId) {
      return { error: "Not authorized to submit for this participant." };
    }
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
    isCorrect = evaluateAnswerCorrectness(question, parsedAnswer);
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
  const teacher = await requireTeacher();

  const sessionCheck = await prisma.liveQuizSession.findUnique({ where: { id: sessionId } });
  if (!sessionCheck || sessionCheck.hostId !== teacher.userId) {
    return { error: "Access denied" };
  }

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
  const teacher = await requireTeacher();

  const sessionCheck = await prisma.liveQuizSession.findUnique({ where: { id: sessionId } });
  if (!sessionCheck || sessionCheck.hostId !== teacher.userId) {
    return { error: "Access denied" };
  }

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
  const teacher = await requireTeacher();

  const session = await prisma.liveQuizSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) throw new Error("Session not found");
  if (session.hostId !== teacher.userId) throw new Error("Access denied");

  const exercise = getExerciseFromDisk(session.exerciseId);
  if (!exercise || exercise.type !== "live-quiz") {
    return { error: "Exercise config not found." };
  }
  const nextIdx = session.currentQuestionIdx + 1;
  if (nextIdx >= exercise.questions.length) {
    return { error: "No more questions. Please finish the quiz." };
  }

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
  const teacher = await requireTeacher();

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
  if (session.hostId !== teacher.userId) throw new Error("Access denied");

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
        const multiplier = getAttemptMultiplier(attemptNumber);

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
