"use server";

import { Navbar } from "@/components/Navbar";
import { getConversationList, getUserQuotaAction } from "@/lib/actions/aloys";
import { SocraticClientPage } from "./SocraticClientPage";

export default async function AloysStudentPage() {
  const initialConversations = await getConversationList();
  const initialQuota = await getUserQuotaAction();

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col h-[calc(100vh-3.5rem)]">
        <SocraticClientPage
          initialConversations={initialConversations}
          initialQuota={initialQuota}
        />
      </main>
    </>
  );
}
