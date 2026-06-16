"use server";

import { Navbar } from "@/components/Navbar";
import {
  adminGetUsersAction,
  adminGetClassroomsAction,
  adminGetConversationsAction,
} from "@/lib/actions/aloys";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminClientPage } from "./AdminClientPage";

export default async function AdminDashboardPage() {
  const session = await getSession();

  // Protect route
  if (!session || session.role !== "ADMIN") {
    redirect("/");
  }

  const initialUsers = await adminGetUsersAction();
  const classrooms = await adminGetClassroomsAction();
  const conversations = await adminGetConversationsAction();

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 flex flex-col h-[calc(100vh-3.5rem)]">
        <AdminClientPage
          initialUsers={initialUsers}
          classrooms={classrooms}
          initialConversations={conversations}
        />
      </main>
    </>
  );
}
