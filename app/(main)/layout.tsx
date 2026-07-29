import { redirect } from "next/navigation";
import { AiChatProvider } from "@/components/ai-chat/ai-chat-provider";
import { AppShell } from "@/components/app-shell";
import { PoCartProvider } from "@/components/po-cart/po-cart-provider";
import { AppToastProvider } from "@/components/ui/AppToast";
import { getUserRole } from "@/lib/auth/roles";
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

  const userRole = user.email ? await getUserRole(user.email) : "buyer";

  return (
    <PoCartProvider userRole={userRole}>
      <AppToastProvider>
        <AppShell userEmail={user.email ?? "Unknown user"}>{children}</AppShell>
        <AiChatProvider />
      </AppToastProvider>
    </PoCartProvider>
  );
}
