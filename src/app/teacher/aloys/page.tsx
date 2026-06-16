"use server";

import { Navbar } from "@/components/Navbar";
import { teacherGetConversationsAction } from "@/lib/actions/aloys";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { TeacherClientPage } from "./TeacherClientPage";

export default async function TeacherAloysPage() {
  const session = await getSession();

  // Protect route
  if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
    redirect("/");
  }

  const initialConversations = await teacherGetConversationsAction();

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 flex flex-col h-[calc(100vh-3.5rem)]">
        <TeacherClientPage initialConversations={initialConversations} />
      </main>
    </>
  );
}
