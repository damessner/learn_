import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { MS_CLIENT_ID, MS_REDIRECT_URI, MS_TENANT_ID } from "@/lib/env";

export async function GET() {
  if (!MS_CLIENT_ID || !MS_REDIRECT_URI) {
    return NextResponse.json(
      { error: "Microsoft integration is not configured on this server." },
      { status: 500 }
    );
  }

  // Generate a random state for CSRF protection
  const state = crypto.randomBytes(32).toString("hex");
  
  const cookieStore = await cookies();
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
  });

  const scopes = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "User.Read",
    "Team.ReadBasic.All",
    "TeamMember.Read.All",
    "EduAssignments.ReadWrite"
  ].join(" ");

  const authUrl = new URL(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize`);
  authUrl.searchParams.append("client_id", MS_CLIENT_ID);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("redirect_uri", MS_REDIRECT_URI);
  authUrl.searchParams.append("response_mode", "query");
  authUrl.searchParams.append("scope", scopes);
  authUrl.searchParams.append("state", state);

  return NextResponse.redirect(authUrl.toString());
}
