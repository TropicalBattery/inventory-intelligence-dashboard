import { redirect } from "next/navigation";
import { AiChatProvider } from "@/components/ai-chat/ai-chat-provider";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <AppShell userEmail={user.email ?? "Unknown user"}>{children}</AppShell>
      <AiChatProvider />
    </>
  );
}
