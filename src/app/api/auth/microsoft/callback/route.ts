import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSession, setSession } from "@/lib/session";
import { MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REDIRECT_URI } from "@/lib/env";
import { encryptToken } from "@/lib/crypto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const cookieStore = await cookies();
  const oauthState = cookieStore.get("oauth_state")?.value;
  cookieStore.delete("oauth_state");

  if (errorParam) {
    console.error("Microsoft OAuth error:", errorParam, errorDescription);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorDescription || errorParam)}`, request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=Invalid+OAuth+response", request.url));
  }

  // Validate state to prevent CSRF
  if (!oauthState || state !== oauthState) {
    return NextResponse.redirect(new URL("/login?error=CSRF+validation+failed", request.url));
  }

  try {
    // Exchange Auth Code for Access, Refresh, and ID Tokens
    const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID || "",
        client_secret: MS_CLIENT_SECRET || "",
        code,
        redirect_uri: MS_REDIRECT_URI || "",
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", tokenData);
      return NextResponse.redirect(new URL("/login?error=Failed+to+exchange+authorization+code", request.url));
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Fetch user's Microsoft Profile
    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const profileData = await profileResponse.json();

    if (!profileResponse.ok) {
      console.error("Failed to fetch Microsoft profile:", profileData);
      return NextResponse.redirect(new URL("/login?error=Failed+to+retrieve+Microsoft+profile", request.url));
    }

    const microsoftId = profileData.id;
    const microsoftEmail = profileData.mail || profileData.userPrincipalName;

    // Encrypt the tokens before database storage
    const encryptedAccessToken = encryptToken(access_token);
    const encryptedRefreshToken = refresh_token ? encryptToken(refresh_token) : null;
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    const session = await getSession();

    if (session) {
      // CASE A: User is already logged in to our system. Link their Microsoft account.
      const updateData: any = {
        microsoftId,
        microsoftEmail,
        msAccessToken: encryptedAccessToken,
        msTokenExpiresAt: tokenExpiresAt,
      };
      if (encryptedRefreshToken) {
        updateData.msRefreshToken = encryptedRefreshToken;
      }

      await prisma.user.update({
        where: { id: session.userId },
        data: updateData,
      });

      // Redirect back to dashboard based on role
      const redirectPath = session.role === "TEACHER" ? "/teacher" : "/student";
      return NextResponse.redirect(new URL(redirectPath, request.url));
    } else {
      // CASE B: User is not logged in. Attempt Microsoft Single Sign-On (SSO).
      // Find user by microsoftId OR by matching email address
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { microsoftId },
            { microsoftEmail: microsoftEmail },
          ],
        },
      });

      if (!user) {
        // User does not exist / is not linked. Redirect to login with instructions.
        return NextResponse.redirect(
          new URL(
            `/login?error=Your+Microsoft+account+is+not+linked+to+any+AloysLearns+account.+Please+sign+in+normally+first,+then+link+your+account+from+the+dashboard.`,
            request.url
          )
        );
      }

      // If user was found by email but microsoftId wasn't set, update it now
      const updateData: any = {
        microsoftId,
        microsoftEmail,
        msAccessToken: encryptedAccessToken,
        msTokenExpiresAt: tokenExpiresAt,
      };
      if (encryptedRefreshToken) {
        updateData.msRefreshToken = encryptedRefreshToken;
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      // Set user session cookie
      await setSession({
        userId: user.id,
        username: user.username,
        role: user.role as "ADMIN" | "TEACHER" | "STUDENT",
      });

      const redirectPath = user.role === "TEACHER" ? "/teacher" : "/student";
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
  } catch (error) {
    console.error("Microsoft OAuth Callback Exception:", error);
    return NextResponse.redirect(new URL("/login?error=An+unexpected+error+occurred+during+login", request.url));
  }
}
