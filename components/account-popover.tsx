"use client";

import {
  FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/auth/role-guards";
import { createClient } from "@/lib/supabase/client";

type AccountPopoverProps = {
  userEmail: string;
  userRole: UserRole;
};

function getAvatarLetter(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) {
    return "?";
  }
  return trimmed.charAt(0).toUpperCase();
}

function roleLabel(role: UserRole): string {
  return role === "approver" ? "Approver" : "Buyer";
}

export function AccountPopover({ userEmail, userRole }: AccountPopoverProps) {
  const router = useRouter();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function resetPasswordForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFieldError(null);
    setFormError(null);
  }

  async function handleSignOut() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);
    setFormError(null);
    setSuccess(null);

    if (!currentPassword.trim()) {
      setFieldError("Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldError("Passwords do not match.");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });

    if (signInError) {
      setFormError("Current password is incorrect.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setFormError(
        updateError.message || "Unable to update password. Please try again."
      );
      setSaving(false);
      return;
    }

    resetPasswordForm();
    setChangeOpen(false);
    setSuccess("Password updated.");
    setSaving(false);
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((value) => !value);
          setSuccess(null);
        }}
        className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-[#1F1F1F]"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2A2A2A] text-sm font-medium text-[#E5E5E5]"
          aria-hidden="true"
        >
          {getAvatarLetter(userEmail)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-[#E5E5E5]">
            {userEmail}
          </span>
          <span className="block truncate text-[11px] text-[#888888]">
            {roleLabel(userRole)}
          </span>
        </span>
        <i
          className={`ti ti-chevron-up text-sm text-[#555555] transition-transform ${
            open ? "" : "rotate-180"
          }`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Account"
          className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-50 overflow-hidden rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] shadow-lg"
        >
          <div className="border-b border-[#2A2A2A] px-3 py-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2A2A2A] text-sm font-medium text-[#E5E5E5]"
                aria-hidden="true"
              >
                {getAvatarLetter(userEmail)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#E5E5E5]">
                  {userEmail}
                </p>
                <p className="text-xs text-[#888888]">{roleLabel(userRole)}</p>
              </div>
            </div>
          </div>

          <div className="px-3 py-2">
            {success ? (
              <p
                role="status"
                className="mb-2 rounded-lg bg-[#052E16] px-2 py-1.5 text-xs text-[#86EFAC]"
              >
                {success}
              </p>
            ) : null}

            <button
              type="button"
              aria-expanded={changeOpen}
              onClick={() => {
                setChangeOpen((value) => !value);
                setFieldError(null);
                setFormError(null);
                setSuccess(null);
              }}
              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-[#E5E5E5] transition-colors hover:bg-[#242424]"
            >
              <span>Change password</span>
              <i
                className={`ti ti-chevron-down text-sm text-[#888888] transition-transform ${
                  changeOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {changeOpen ? (
              <form onSubmit={handleChangePassword} className="mt-1 space-y-2 px-1 pb-2">
                <div>
                  <label
                    htmlFor="account-current-password"
                    className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[#888888]"
                  >
                    Current password
                  </label>
                  <input
                    id="account-current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => {
                      setFieldError(null);
                      setFormError(null);
                      setCurrentPassword(event.target.value);
                    }}
                    className="h-9 w-full rounded-lg border border-[#333333] bg-[#111111] px-2.5 text-sm text-[#E5E5E5] focus:border-[#CC2B2B] focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="account-new-password"
                    className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[#888888]"
                  >
                    New password
                  </label>
                  <input
                    id="account-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => {
                      setFieldError(null);
                      setFormError(null);
                      setNewPassword(event.target.value);
                    }}
                    className="h-9 w-full rounded-lg border border-[#333333] bg-[#111111] px-2.5 text-sm text-[#E5E5E5] focus:border-[#CC2B2B] focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/20"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label
                    htmlFor="account-confirm-password"
                    className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[#888888]"
                  >
                    Confirm new password
                  </label>
                  <input
                    id="account-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setFieldError(null);
                      setFormError(null);
                      setConfirmPassword(event.target.value);
                    }}
                    className="h-9 w-full rounded-lg border border-[#333333] bg-[#111111] px-2.5 text-sm text-[#E5E5E5] focus:border-[#CC2B2B] focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/20"
                  />
                </div>

                {fieldError ? (
                  <p className="text-xs text-[#FCA5A5]">{fieldError}</p>
                ) : null}
                {formError ? (
                  <p role="alert" className="text-xs text-[#FCA5A5]">
                    {formError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-1 w-full rounded-lg bg-[#CC2B2B] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B02626] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Update password"}
                </button>
              </form>
            ) : null}
          </div>

          <div className="border-t border-[#2A2A2A] px-2 py-2">
            <button
              type="button"
              onClick={() => {
                void handleSignOut();
              }}
              disabled={loggingOut}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#E5E5E5] transition-colors hover:bg-[#242424] hover:text-[#CC2B2B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className="ti ti-logout text-base" aria-hidden="true" />
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
