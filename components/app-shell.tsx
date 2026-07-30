import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import type { UserRole } from "@/lib/auth/role-guards";

type AppShellProps = {
  userEmail: string;
  userRole: UserRole;
  children: React.ReactNode;
};

export function AppShell({ userEmail, userRole, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      <Sidebar userEmail={userEmail} userRole={userRole} />
      <div className="pl-64">
        <TopBar userEmail={userEmail} />
        <main className="px-8 py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
