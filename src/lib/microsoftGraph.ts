import { prisma } from "@/lib/db";
import { MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REDIRECT_URI } from "@/lib/env";
import { decryptToken, encryptToken } from "@/lib/crypto";

/**
 * Ensures that a user has a valid Microsoft Graph access token.
 * If the current token is expired or close to expiring, it performs
 * a silent refresh using the stored refresh token.
 * 
 * Returns the active decrypted access token, or throws if re-auth is needed.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      msAccessToken: true,
      msRefreshToken: true,
      msTokenExpiresAt: true,
    },
  });

  if (!user || !user.msAccessToken) {
    throw new Error("No Microsoft account linked to this user.");
  }

  const decryptedAccess = decryptToken(user.msAccessToken);
  if (!decryptedAccess) {
    throw new Error("Failed to decrypt access token.");
  }

  // If token is still valid (with a 5-minute safety buffer), return it
  const expiryBufferMs = 5 * 60 * 1000;
  if (user.msTokenExpiresAt && user.msTokenExpiresAt.getTime() > Date.now() + expiryBufferMs) {
    return decryptedAccess;
  }

  // Token is expired or about to expire. Attempt refresh.
  if (!user.msRefreshToken) {
    throw new Error("Access token expired and no refresh token available.");
  }

  const decryptedRefresh = decryptToken(user.msRefreshToken);
  if (!decryptedRefresh) {
    throw new Error("Failed to decrypt refresh token.");
  }

  try {
    const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID || "",
        client_secret: MS_CLIENT_SECRET || "",
        refresh_token: decryptedRefresh,
        grant_type: "refresh_token",
        redirect_uri: MS_REDIRECT_URI || "",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Token refresh failed:", data);
      throw new Error("Microsoft login session expired. Please re-link your account.");
    }

    const { access_token, refresh_token: new_refresh_token, expires_in } = data;

    const encryptedAccess = encryptToken(access_token);
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    const updateData: any = {
      msAccessToken: encryptedAccess,
      msTokenExpiresAt: tokenExpiresAt,
    };

    if (new_refresh_token) {
      updateData.msRefreshToken = encryptToken(new_refresh_token);
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return access_token;
  } catch (error) {
    console.error("Error in getValidAccessToken:", error);
    throw new Error("Failed to refresh Microsoft credentials.");
  }
}

/**
 * Fetch list of Microsoft Teams (Classrooms) joined by the user.
 */
export async function getJoinedTeams(userId: string) {
  const token = await getValidAccessToken(userId);

  const response = await fetch("https://graph.microsoft.com/v1.0/me/joinedTeams", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Failed to fetch joined teams:", data);
    throw new Error(data.error?.message || "Failed to fetch Teams classrooms.");
  }

  return data.value.map((team: any) => ({
    id: team.id,
    displayName: team.displayName,
    description: team.description || "",
  }));
}

/**
 * Fetch members of a Microsoft Team to resolve student rosters.
 */
export async function getTeamMembers(userId: string, teamId: string) {
  const token = await getValidAccessToken(userId);

  const response = await fetch(`https://graph.microsoft.com/v1.0/teams/${teamId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Failed to fetch team members:", data);
    throw new Error(data.error?.message || "Failed to fetch class members.");
  }

  // Returns array of members
  // We want to return user details that we can map to students
  return data.value.map((member: any) => ({
    userId: member.userId,
    displayName: member.displayName,
    email: member.email || member.userPrincipalName || "",
    roles: member.roles || [], // e.g. ["owner"] if teacher, [] if student
  }));
}

/**
 * Create a draft assignment in Teams, attach a resource link, and publish it.
 */
export async function createTeamsAssignment(
  userId: string,
  classId: string,
  assignmentTitle: string,
  dueDate: Date | null,
  targetUrl: string,
  maxPoints: number = 100
): Promise<string> {
  const token = await getValidAccessToken(userId);

  // 1. Create a draft assignment
  const createResponse = await fetch(`https://graph.microsoft.com/v1.0/education/classes/${classId}/assignments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      displayName: assignmentTitle,
      instructions: {
        content: `Please complete this worksheet directly on AloysLearns: ${targetUrl}`,
        contentType: "text",
      },
      dueDateTime: dueDate ? dueDate.toISOString() : null,
      grading: {
        "@odata.type": "#microsoft.graph.educationAssignmentPointsGrading",
        "maxPoints": maxPoints,
      },
      assignTo: {
        "@odata.type": "#microsoft.graph.educationAssignmentClassRecipient",
      },
    }),
  });

  const assignment = await createResponse.json();

  if (!createResponse.ok) {
    console.error("Failed to create Teams assignment draft:", assignment);
    throw new Error(assignment.error?.message || "Failed to create assignment in Teams.");
  }

  const assignmentId = assignment.id;

  // 2. Publish the assignment to the class
  const publishResponse = await fetch(
    `https://graph.microsoft.com/v1.0/education/classes/${classId}/assignments/${assignmentId}/publish`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!publishResponse.ok) {
    const publishError = await publishResponse.json();
    console.error("Failed to publish Teams assignment:", publishError);
    // Even if publish fails, we return the draft ID so it can be re-attempted or managed
  }

  return assignmentId;
}

/**
 * Syncs a student score percentage back to Microsoft Teams grades.
 */
export async function submitGradeToTeams(
  teacherUserId: string,
  classId: string,
  assignmentId: string,
  studentMicrosoftId: string,
  scorePercentage: number,
  maxPoints: number = 100
): Promise<void> {
  const token = await getValidAccessToken(teacherUserId);

  // 1. Find the student's submission in Teams
  const submissionsResponse = await fetch(
    `https://graph.microsoft.com/v1.0/education/classes/${classId}/assignments/${assignmentId}/submissions`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const submissionsData = await submissionsResponse.json();

  if (!submissionsResponse.ok) {
    console.error("Failed to fetch Teams submissions:", submissionsData);
    throw new Error("Could not find the assignment submissions in Teams.");
  }

  const submissions = submissionsData.value || [];
  
  // Find submission matching student's MS ID
  // LTI/Education API submissions have a recipient property with user ID
  const studentSubmission = submissions.find((sub: any) => {
    return sub.recipient?.userId === studentMicrosoftId || sub.submittedBy?.id === studentMicrosoftId;
  });

  if (!studentSubmission) {
    console.warn(`Submission not found in Teams for student Microsoft ID: ${studentMicrosoftId}`);
    return;
  }

  const submissionId = studentSubmission.id;
  const earnedPoints = (scorePercentage / 100) * maxPoints;

  // 2. Get existing outcomes to see if we update or create
  const outcomesResponse = await fetch(
    `https://graph.microsoft.com/v1.0/education/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/outcomes`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const outcomesData = await outcomesResponse.json();
  const outcomes = outcomesData.value || [];
  const pointsOutcome = outcomes.find((out: any) => out["@odata.type"] === "#microsoft.graph.educationPointsOutcome");

  if (pointsOutcome) {
    // Update existing points outcome
    const updateResponse = await fetch(
      `https://graph.microsoft.com/v1.0/education/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/outcomes/${pointsOutcome.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          "@odata.type": "#microsoft.graph.educationPointsOutcome",
          "points": {
            "@odata.type": "#microsoft.graph.educationAssignmentPointsGrade",
            "points": earnedPoints,
          },
        }),
      }
    );

    if (!updateResponse.ok) {
      const err = await updateResponse.json();
      console.error("Failed to update grade outcome:", err);
      throw new Error("Failed to update points in Microsoft Teams.");
    }
  } else {
    // Create new points outcome
    const createOutcomeResponse = await fetch(
      `https://graph.microsoft.com/v1.0/education/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/outcomes`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          "@odata.type": "#microsoft.graph.educationPointsOutcome",
          "points": {
            "@odata.type": "#microsoft.graph.educationAssignmentPointsGrade",
            "points": earnedPoints,
          },
        }),
      }
    );

    if (!createOutcomeResponse.ok) {
      const err = await createOutcomeResponse.json();
      console.error("Failed to create grade outcome:", err);
      throw new Error("Failed to post points to Microsoft Teams.");
    }
  }

  // 3. Return the assignment to publish/sync the grade to the student's view in Teams
  const returnResponse = await fetch(
    `https://graph.microsoft.com/v1.0/education/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/return`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!returnResponse.ok) {
    const err = await returnResponse.json();
    console.error("Failed to return submission in Teams:", err);
    // Do not throw here since points have been recorded, return is just the final step to display it
  }
}
