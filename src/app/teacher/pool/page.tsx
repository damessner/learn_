import React from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import PoolClientPage from "./PoolClientPage";

export default async function WorksheetPoolPage() {
  const session = await getSession();

  if (!session || session.role !== "TEACHER") {
    redirect("/login");
  }

  // Fetch all exercises from DB with creators, ratings, and assignments + submissions
  const exercises = await prisma.exercise.findMany({
    where: { pendingDeletion: false },
    include: {
      creator: {
        select: {
          id: true,
          username: true,
        },
      },
      ratings: true,
      assignments: {
        include: {
          submissions: {
            where: { completed: true },
            select: {
              score: true,
              effectiveScore: true,
              duration: true,
            },
          },
        },
      },
    },
    orderBy: { title: "asc" },
  });

  // Fetch teacher's classrooms for quick assigning
  const classrooms = await prisma.classroom.findMany({
    where: { teacherId: session.userId },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // Map database exercises to serialized client structure
  const serializedExercises = exercises.map((ex) => {
    const totalStars = ex.ratings.reduce((sum, r) => sum + r.stars, 0);
    const avgRating = ex.ratings.length > 0 ? totalStars / ex.ratings.length : 0;
    
    // Find current teacher's rating if it exists
    const myRating = ex.ratings.find((r) => r.teacherId === session.userId)?.stars || 0;

    // Collect all pupil submissions for this exercise
    const allSubmissions = ex.assignments.flatMap((a) => a.submissions);

    // Calculate average score
    const avgScore = allSubmissions.length > 0
      ? allSubmissions.reduce((sum, s) => sum + s.effectiveScore, 0) / allSubmissions.length
      : null;

    // Calculate average duration
    const validDurations = allSubmissions.filter((s) => s.duration !== null && s.duration > 0);
    const avgDuration = validDurations.length > 0
      ? validDurations.reduce((sum, s) => sum + (s.duration || 0), 0) / validDurations.length
      : null;

    // Calculate most common pupil feedback tags
    const tagCounts: Record<string, number> = {};
    ex.ratings.forEach((r) => {
      if (r.feedbackTags) {
        r.feedbackTags.split(",").forEach((t) => {
          const trimmed = t.trim().toLowerCase();
          if (trimmed) {
            tagCounts[trimmed] = (tagCounts[trimmed] || 0) + 1;
          }
        });
      }
    });
    const commonTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    return {
      id: ex.id,
      title: ex.title,
      description: ex.description,
      type: ex.type,
      tags: ex.tags ? ex.tags.split(",") : [],
      badgeName: ex.badgeName || "",
      badgeEmoji: ex.badgeEmoji || "",
      updatedAt: ex.updatedAt.toISOString(),
      creator: ex.creator ? { id: ex.creator.id, username: ex.creator.username } : null,
      ratingsCount: ex.ratings.length,
      averageRating: avgRating,
      myRating,
      pupilAvgScore: avgScore,
      pupilAvgDuration: avgDuration,
      pupilFeedbackTags: commonTags,
    };
  });

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <PoolClientPage
          initialExercises={serializedExercises}
          classrooms={classrooms}
          currentUserId={session.userId}
        />
      </main>
    </>
  );
}
