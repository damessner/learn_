"use server";

import { prisma } from "@/lib/db";
import {
  requireAuth,
  requireAdmin,
  requireTeacherOrAdmin,
} from "@/lib/actions/auth-helpers";
import { processUserQuota } from "@/lib/actions/quota";
import { generateAloysResponse, generateLearningContent } from "@/lib/aloys-ai";
import bcrypt from "bcryptjs";

/**
 * Returns previous Socratic conversations of the logged-in user.
 */
export async function getConversationList() {
  const session = await requireAuth();

  return await prisma.aloysConversation.findMany({
    where: { studentId: session.userId },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Returns a Socratic conversation and its messages.
 * Verifies that the user is the student who owns the conversation, or is a teacher/admin.
 */
export async function getConversationDetail(conversationId: string) {
  const session = await requireAuth();

  const conversation = await prisma.aloysConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Permissions check
  if (
    conversation.studentId !== session.userId &&
    session.role !== "TEACHER" &&
    session.role !== "ADMIN"
  ) {
    throw new Error("Unauthorized access to conversation");
  }

  return conversation;
}

/**
 * Fetches the user's current Socratic helping quota.
 */
export async function getUserQuotaAction() {
  const session = await requireAuth();
  return await processUserQuota(session.userId, false, "input");
}

/**
 * Starts a normal Socratic chat conversation.
 * Deducts 1 helping quota.
 */
export async function startSocraticChatAction(topic: string) {
  const session = await requireAuth();
  const trimmedTopic = topic.trim();
  if (!trimmedTopic) throw new Error("Topic cannot be empty");

  // Verify and deduct quota
  await processUserQuota(session.userId, true, "input");

  const conversation = await prisma.aloysConversation.create({
    data: {
      studentId: session.userId,
      title: `Chat: ${trimmedTopic.substring(0, 30)}`,
    },
  });

  // Save the user's prompt as first message
  await prisma.aloysMessage.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: `Hello Aloys! Let's talk about: "${trimmedTopic}". Can you explain it or help me think about it?`,
      type: "CHAT",
    },
  });

  // Socratic Doctor persona initial greeting
  const greeting = `Greetings, young scholar. I am Aloys. As a doctor and the founder of our school, I'd be delighted to assist your learning journey. Let's discuss "${trimmedTopic}". Tell me, what do you already know about this topic, or what specific question has sparked your curiosity?`;

  await prisma.aloysMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: greeting,
        type: "CHAT",
      },
    });

  return { conversationId: conversation.id };
}

/**
 * Sends a message in a Socratic conversation, deducts quota, queries AI, and saves response.
 */
export async function sendChatMessageAction(
  conversationId: string,
  content: string
) {
  const session = await requireAuth();
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message cannot be empty");

  // Verify and deduct quota
  await processUserQuota(session.userId, true, "input");

  // Verify conversation ownership
  const conversation = await prisma.aloysConversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation || conversation.studentId !== session.userId) {
    throw new Error("Unauthorized conversation access");
  }

  // Save user message
  await prisma.aloysMessage.create({
    data: {
      conversationId,
      role: "user",
      content: trimmed,
      type: "CHAT",
    },
  });

  // Load complete conversation messages for the AI context
  const dbMessages = await prisma.aloysMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  // Map to AI format
  const aiHistory = dbMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  try {
    const aiResponse = await generateAloysResponse(aiHistory);

    // Save assistant message
    const savedMsg = await prisma.aloysMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content: aiResponse,
        type: "CHAT",
      },
    });

    // Update conversation updatedAt
    await prisma.aloysConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return savedMsg;
  } catch (err: unknown) {
    console.error("Aloys Socratic Response Error:", err);
    const message = err instanceof Error ? err.message : "Failed to generate AI response";
    throw new Error(message);
  }
}

/**
 * Starts a Socratic Learning Session.
 * Generates text, MC questions, and suggestions.
 * Deducts 1 quota.
 */
export async function startLearningSessionAction(topic: string) {
  const session = await requireAuth();
  const trimmedTopic = topic.trim();
  if (!trimmedTopic) throw new Error("Topic cannot be empty");

  // Verify and deduct quota
  await processUserQuota(session.userId, true, "quiz");

  try {
    const content = await generateLearningContent(trimmedTopic);

    const conversation = await prisma.aloysConversation.create({
      data: {
        studentId: session.userId,
        title: `Lesson: ${trimmedTopic.substring(0, 30)}`,
      },
    });

    // 1. Save explanation text
    await prisma.aloysMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: content.text,
        type: "LEARN_TEXT",
      },
    });

    // 2. Save multiple choice questions (with options and correct answer)
    await prisma.aloysMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: `I've prepared a few questions for you to verify your understanding.`,
        type: "LEARN_QUESTIONS",
        metadataJson: JSON.stringify({
          questions: content.questions,
          suggestions: content.suggestions,
        }),
      },
    });

    return { conversationId: conversation.id };
  } catch (err: unknown) {
    console.error("Aloys Socratic Learning Error:", err);
    const message = err instanceof Error ? err.message : "Failed to generate Socratic learning lesson";
    throw new Error(message);
  }
}

/**
 * Grades the multiple choice answers submitted by the student.
 * Creates a feedback message. Deducts no quota.
 */
export async function submitLearningAnswersAction(
  conversationId: string,
  messageId: string,
  selectedOptions: Record<number, number>
) {
  await requireAuth();

  // Load the questions message
  const questionMessage = await prisma.aloysMessage.findUnique({
    where: { id: messageId },
  });

  if (!questionMessage || questionMessage.type !== "LEARN_QUESTIONS") {
    throw new Error("Invalid question message");
  }

  const metadata = JSON.parse(questionMessage.metadataJson || "{}");
  const questions = metadata.questions as Array<{
    question: string;
    options: string[];
    correctIndex: number;
  }>;
  const suggestions = (metadata.suggestions as string[]) || [];

  if (!questions) {
    throw new Error("Comprehension questions not found");
  }

  // Grade each answer
  const results = questions.map((q, idx) => {
    const selected = selectedOptions[idx];
    const correct = q.correctIndex;
    const isCorrect = selected === correct;
    return {
      questionIndex: idx,
      questionText: q.question,
      selected,
      correct,
      isCorrect,
      selectedText: selected !== undefined ? q.options[selected] : "Not answered",
      correctText: q.options[correct],
    };
  });

  const correctCount = results.filter((r) => r.isCorrect).length;
  const totalCount = questions.length;

  let feedbackContent = `### Lesson Feedback & Assessment\n\n`;
  feedbackContent += `You answered **${correctCount} out of ${totalCount}** questions correctly!\n\n`;

  results.forEach((r, idx) => {
    feedbackContent += `**Question ${idx + 1}:** ${r.questionText}\n`;
    if (r.isCorrect) {
      feedbackContent += `*   ✔️ Your answer is correct: *${r.selectedText}*\n\n`;
    } else {
      feedbackContent += `*   ❌ Your answer: *${r.selectedText}* (Incorrect)\n`;
      feedbackContent += `*   💡 Correct answer: *${r.correctText}*\n\n`;
    }
  });

  if (correctCount === totalCount) {
    feedbackContent += `Excellent diagnosis, young scholar! You've understood this subject perfectly.`;
  } else if (correctCount >= totalCount / 2) {
    feedbackContent += `A respectable attempt! Review the text above to fill in the remaining gaps.`;
  } else {
    feedbackContent += `It seems we have some symptoms of misunderstanding here. Let's study the material again or discuss it.`;
  }

  feedbackContent += `\n\n**Would you like to know more? Here are some topics we could explore next:**`;

  // Save assessment results
  const savedMsg = await prisma.aloysMessage.create({
    data: {
      conversationId,
      role: "assistant",
      content: feedbackContent,
      type: "LEARN_ANSWERS",
      metadataJson: JSON.stringify({
        results,
        suggestions,
      }),
    },
  });

  // Update conversation
  await prisma.aloysConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return savedMsg;
}

/* ==========================================================================
   ADMIN ACTIONS
   ========================================================================== */

/**
 * Returns a list of all users in the system.
 */
export async function adminGetUsersAction() {
  await requireAdmin();
  return await prisma.user.findMany({
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      dailyLimit: true,
      dailyRemaining: true,
      classroomsJoined: {
        select: {
          classroom: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Creates a student, teacher, or admin account.
 */
export async function adminCreateUserAction(
  username: string,
  passwordPlain: string,
  role: string,
  classroomIds: string[]
) {
  await requireAdmin();

  const normalizedUsername = username.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { username: normalizedUsername },
  });

  if (existing) {
    throw new Error("Username already taken");
  }

  const passwordHash = await bcrypt.hash(passwordPlain, 10);

  // Create user
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username: normalizedUsername,
        passwordHash,
        role,
        dailyLimit: role === "STUDENT" ? 160 : 999,
        dailyRemaining: role === "STUDENT" ? 160 : 999,
      },
    });

    // Join classrooms
    if (role === "STUDENT" && classroomIds.length > 0) {
      await Promise.all(
        classroomIds.map((classroomId) =>
          tx.classroomStudent.create({
            data: {
              classroomId,
              studentId: user.id,
            },
          })
        )
      );
    }

    return user;
  });
}

/**
 * Updates a user's details, password, role, and limits.
 */
export async function adminUpdateUserAction(
  userId: string,
  passwordPlain?: string,
  role?: string,
  dailyLimit?: number,
  classroomIds?: string[]
) {
  await requireAdmin();

  return await prisma.$transaction(async (tx) => {
    const data: Record<string, string | number> = {};
    if (passwordPlain) {
      data.passwordHash = await bcrypt.hash(passwordPlain, 10);
    }
    if (role) {
      data.role = role;
    }
    if (dailyLimit !== undefined) {
      data.dailyLimit = dailyLimit;
      data.dailyRemaining = dailyLimit; // Reset remaining to limit on update
    }
    const updated = await tx.user.update({
      where: { id: userId },
      data,
    });

    if (classroomIds) {
      // Delete old relations
      await tx.classroomStudent.deleteMany({
        where: { studentId: userId },
      });

      // Insert new relations
      if (updated.role === "STUDENT" && classroomIds.length > 0) {
        await Promise.all(
          classroomIds.map((classroomId) =>
            tx.classroomStudent.create({
              data: {
                classroomId,
                studentId: userId,
              },
            })
          )
        );
      }
    }

    return updated;
  });
}

/**
 * Deletes a user account.
 */
export async function adminDeleteUserAction(userId: string) {
  const session = await requireAdmin();
  if (userId === session.userId) {
    throw new Error("You cannot delete your own admin account!");
  }

  return await prisma.user.delete({
    where: { id: userId },
  });
}

/**
 * Returns all classrooms (classes).
 */
export async function adminGetClassroomsAction() {
  await requireAdmin();
  return await prisma.classroom.findMany({
    orderBy: { name: "asc" },
  });
}

/**
 * Fetches all conversations in the system for admin viewing.
 */
export async function adminGetConversationsAction(
  studentId?: string,
  classroomId?: string
) {
  await requireAdmin();

  const where: Record<string, string | { in: string[] }> = {};
  if (studentId) {
    where.studentId = studentId;
  } else if (classroomId) {
    // filter by students in classroom
    const students = await prisma.classroomStudent.findMany({
      where: { classroomId },
      select: { studentId: true },
    });
    where.studentId = { in: students.map((s) => s.studentId) };
  }

  return await prisma.aloysConversation.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      student: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });
}

/* ==========================================================================
   TEACHER ACTIONS
   ========================================================================== */

/**
 * Fetches Socratic conversations of students in classrooms taught by the teacher.
 */
export async function teacherGetConversationsAction() {
  const session = await requireTeacherOrAdmin();

  let classroomStudents: string[] = [];

  if (session.role === "TEACHER") {
    // Find all classrooms taught by this teacher
    const classrooms = await prisma.classroom.findMany({
      where: { teacherId: session.userId },
      select: { id: true },
    });

    const studentJoins = await prisma.classroomStudent.findMany({
      where: { classroomId: { in: classrooms.map((c) => c.id) } },
      select: { studentId: true },
    });

    classroomStudents = Array.from(new Set(studentJoins.map((s) => s.studentId)));
  } else {
    // Admin sees all
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true },
    });
    classroomStudents = students.map((s) => s.id);
  }

  return await prisma.aloysConversation.findMany({
    where: { studentId: { in: classroomStudents } },
    orderBy: { updatedAt: "desc" },
    include: {
      student: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });
}
