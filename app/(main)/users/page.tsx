import { redirect } from "next/navigation";
import { UsersManager } from "@/components/users/users-manager";
import { getUserRole } from "@/lib/auth/roles";
import { listUserRoles } from "@/lib/auth/user-admin";
import { createClient } from "@/lib/supabase/server";

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.trim() ?? "";
  if (!email) {
    redirect("/login");
  }

  const role = await getUserRole(email);
  if (role !== "approver") {
    redirect("/reorder");
  }

  const users = await listUserRoles();

  return <UsersManager initialUsers={users} currentUserEmail={email} />;
}
