"use client";

import { FormEvent, useState } from "react";
import type { UserRole } from "@/lib/auth/role-guards";
import type { UserRoleRow } from "@/lib/auth/user-admin";

type UsersManagerProps = {
  initialUsers: UserRoleRow[];
  currentUserEmail: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function UsersManager({
  initialUsers,
  currentUserEmail,
}: UsersManagerProps) {
  const me = normalizeEmail(currentUserEmail);
  const [users, setUsers] = useState<UserRoleRow[]>(initialUsers);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<UserRole>("buyer");
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Inline set-password editor open for this email (row-level, compact). */
  const [editingPasswordFor, setEditingPasswordFor] = useState<string | null>(
    null
  );
  const [passwordDraft, setPasswordDraft] = useState("");
  const [rowPasswordError, setRowPasswordError] = useState<string | null>(null);
  const [passwordSuccessEmail, setPasswordSuccessEmail] = useState<
    string | null
  >(null);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<
    string | null
  >(null);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setAdding(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail, role: addRole }),
      });
      const data = (await response.json().catch(() => null)) as {
        users?: UserRoleRow[];
        error?: string;
      } | null;

      if (!response.ok) {
        setError(data?.error ?? "Failed to add user");
        return;
      }

      if (data?.users) {
        setUsers(data.users);
      }
      setAddEmail("");
      setAddRole("buyer");
      setNotice(`Role assigned to ${normalizeEmail(addEmail)}.`);
    } catch {
      setError("Failed to add user");
    } finally {
      setAdding(false);
    }
  }

  async function handleRoleChange(email: string, role: UserRole) {
    setError(null);
    setNotice(null);
    setBusyEmail(email);

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await response.json().catch(() => null)) as {
        users?: UserRoleRow[];
        error?: string;
        unchanged?: boolean;
      } | null;

      if (!response.ok) {
        setError(data?.error ?? "Failed to update role");
        return;
      }

      if (data?.users) {
        setUsers(data.users);
      }
      if (!data?.unchanged) {
        setNotice(`Updated ${email} to ${role}.`);
      }
    } catch {
      setError("Failed to update role");
    } finally {
      setBusyEmail(null);
    }
  }

  function openSetPassword(email: string) {
    setEditingPasswordFor(email);
    setPasswordDraft("");
    setRowPasswordError(null);
    setPasswordSuccessEmail(null);
    setPasswordSuccessMessage(null);
    setError(null);
    setNotice(null);
  }

  function cancelSetPassword() {
    setEditingPasswordFor(null);
    setPasswordDraft("");
    setRowPasswordError(null);
  }

  async function handleSavePassword(email: string) {
    setRowPasswordError(null);
    setPasswordSuccessEmail(null);
    setPasswordSuccessMessage(null);
    setError(null);
    setNotice(null);

    if (passwordDraft.length < 8) {
      setRowPasswordError("Password must be at least 8 characters.");
      return;
    }

    setBusyEmail(email);
    try {
      const response = await fetch("/api/users/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword: passwordDraft }),
      });
      const data = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        if (response.status === 404) {
          setRowPasswordError(
            data?.error ?? "No sign-in account for this email yet."
          );
        } else {
          setRowPasswordError(data?.error ?? "Unable to set password.");
        }
        return;
      }

      setPasswordDraft("");
      setEditingPasswordFor(null);
      setPasswordSuccessEmail(email);
      setPasswordSuccessMessage(
        data?.message ??
          `Password set for ${email}. Share it with them securely.`
      );
    } catch {
      setRowPasswordError("Unable to set password.");
    } finally {
      setBusyEmail(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#111111]">Users</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Assign buyer and approver roles, and set passwords for existing sign-in
          accounts.
        </p>
      </div>

      {notice ? (
        <div
          role="status"
          className="rounded-2xl border border-[#86EFAC] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]"
        >
          {notice}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-[#FCA5A5] bg-[#FDF2F2] px-4 py-3 text-sm text-[#CC2B2B]"
        >
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl bg-white p-6 shadow-card">
        <h2 className="text-sm font-semibold text-[#111111]">Add by email</h2>
        <p className="mt-1 text-xs text-[#9CA3AF]">
          This assigns a role to an email. It does not create an auth account —
          the person must already be able to sign in.
        </p>
        <form
          onSubmit={handleAdd}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <div className="min-w-[220px] flex-1">
            <label
              htmlFor="add-email"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-[#6B7280]"
            >
              Email
            </label>
            <input
              id="add-email"
              type="email"
              required
              value={addEmail}
              onChange={(event) => setAddEmail(event.target.value)}
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 text-sm text-[#111111] focus:border-[#CC2B2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10"
              placeholder="name@company.com"
            />
          </div>
          <div>
            <label
              htmlFor="add-role"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-[#6B7280]"
            >
              Role
            </label>
            <select
              id="add-role"
              value={addRole}
              onChange={(event) =>
                setAddRole(event.target.value as UserRole)
              }
              className="h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#111111] focus:border-[#CC2B2B] focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10"
            >
              <option value="buyer">Buyer</option>
              <option value="approver">Approver</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={adding}
            className="h-10 rounded-xl bg-[#CC2B2B] px-4 text-sm font-medium text-white transition-colors hover:bg-[#B02626] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adding ? "Adding…" : "Add user"}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Password</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-[#9CA3AF]"
                  >
                    No users with assigned roles yet.
                  </td>
                </tr>
              ) : (
                users.map((row) => {
                  const isSelf = row.email === me;
                  const rowBusy = busyEmail === row.email;
                  const isEditing = editingPasswordFor === row.email;
                  const showSuccessForRow = passwordSuccessEmail === row.email;

                  return (
                    <tr
                      key={row.email}
                      className="border-b border-[#F3F4F6] last:border-b-0"
                    >
                      <td className="px-4 py-3 align-top text-[#111111]">
                        {row.email}
                        {isSelf ? (
                          <span className="ml-2 text-xs text-[#9CA3AF]">
                            (you)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <select
                          value={row.role}
                          disabled={isSelf || rowBusy}
                          aria-label={`Role for ${row.email}`}
                          onChange={(event) => {
                            void handleRoleChange(
                              row.email,
                              event.target.value as UserRole
                            );
                          }}
                          className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-sm text-[#111111] focus:border-[#CC2B2B] focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10 disabled:cursor-not-allowed disabled:bg-[#F3F4F6] disabled:opacity-70"
                        >
                          <option value="buyer">Buyer</option>
                          <option value="approver">Approver</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <div className="flex min-w-[240px] flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="password"
                                autoComplete="new-password"
                                value={passwordDraft}
                                aria-label={`New password for ${row.email}`}
                                placeholder="Min 8 characters"
                                onChange={(event) => {
                                  setRowPasswordError(null);
                                  setPasswordDraft(event.target.value);
                                }}
                                className="h-9 w-40 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2 text-sm text-[#111111] focus:border-[#CC2B2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10"
                              />
                              <button
                                type="button"
                                disabled={rowBusy}
                                onClick={() => {
                                  void handleSavePassword(row.email);
                                }}
                                className="h-9 rounded-lg bg-[#CC2B2B] px-3 text-sm font-medium text-white hover:bg-[#B02626] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {rowBusy ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                disabled={rowBusy}
                                onClick={cancelSetPassword}
                                aria-label="Cancel"
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] disabled:opacity-60"
                              >
                                <i className="ti ti-x text-base" aria-hidden="true" />
                              </button>
                            </div>
                            {rowPasswordError &&
                            editingPasswordFor === row.email ? (
                              <p className="text-xs text-[#CC2B2B]">
                                {rowPasswordError}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              disabled={rowBusy}
                              onClick={() => openSetPassword(row.email)}
                              className="w-fit rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Set password
                            </button>
                            {showSuccessForRow && passwordSuccessMessage ? (
                              <p
                                role="status"
                                className="max-w-xs text-xs text-[#166534]"
                              >
                                {passwordSuccessMessage}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
