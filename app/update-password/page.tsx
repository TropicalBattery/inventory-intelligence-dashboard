"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PageState = "loading" | "ready" | "invalid" | "success";

const INVALID_MESSAGE =
  "This reset link has expired or is invalid. Request a new one from the login page.";

/**
 * Recovery detection:
 * 1. Subscribe to onAuthStateChange for PASSWORD_RECOVERY (set before any exchange).
 * 2. Exchange ?code= via exchangeCodeForSession when present (PKCE email links).
 * 3. Treat hash type=recovery as a recovery signal once a session exists.
 * Direct visits / normal sessions without PASSWORD_RECOVERY → invalid (no form).
 */
export default function UpdatePasswordPage() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let recoveryReady = false;

    function markReady() {
      if (cancelled || recoveryReady) return;
      recoveryReady = true;
      setPageState("ready");
    }

    function markInvalid() {
      if (cancelled || recoveryReady) return;
      setPageState("invalid");
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        markReady();
      }
    });

    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            markInvalid();
            return;
          }
          // Strip code from the URL after a successful exchange.
          window.history.replaceState({}, "", "/update-password");
        }

        const hash = window.location.hash.replace(/^#/, "");
        const hashParams = new URLSearchParams(hash);
        const hashType = hashParams.get("type");
        if (hashType === "recovery") {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            markReady();
            return;
          }
        }

        // Allow PASSWORD_RECOVERY from exchangeCodeForSession to arrive.
        await new Promise((resolve) => window.setTimeout(resolve, 400));
        if (!recoveryReady) {
          markInvalid();
        }
      } catch {
        markInvalid();
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);
    setSubmitError(null);

    if (password.length < 8) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setSubmitError(INVALID_MESSAGE);
      setPageState("invalid");
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setPageState("success");
    setLoading(false);
  }

  return (
    <div className="relative h-screen min-h-screen w-screen overflow-hidden">
      <Image
        src="/hex-bg.png"
        alt=""
        fill
        priority
        className="object-cover object-center"
        style={{ zIndex: 0 }}
      />

      <div
        className="absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.10)_45%,rgba(0,0,0,0.25)_100%)]"
        aria-hidden="true"
      />

      <div className="relative z-20 flex min-h-screen w-full flex-col items-center justify-center px-4">
        <div className="relative w-full max-w-[400px] overflow-hidden rounded-2xl bg-white p-8">
          <div
            className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-[3px] border-t-[3px] border-[#CC2B2B]"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-[3px] border-r-[3px] border-[#F5A000]"
            aria-hidden="true"
          />

          <div className="mb-5 text-center">
            <Image
              src="/tb_logo.png"
              alt="Tropical Battery Company"
              width={220}
              height={40}
              className="mx-auto h-10 w-auto"
              priority
            />
            <div className="mb-5 mt-5 border-t border-[#F3F4F6]" />
          </div>

          {pageState === "loading" ? (
            <p className="text-sm text-[#6B7280]">Checking reset link…</p>
          ) : null}

          {pageState === "invalid" ? (
            <>
              <h1 className="mb-1 text-xl font-bold text-[#111111]">
                Reset link unavailable
              </h1>
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-[#FCA5A5] bg-[#FDF2F2] px-4 py-3 text-sm text-[#CC2B2B]"
              >
                <i
                  className="ti ti-alert-circle mt-0.5 text-base"
                  aria-hidden="true"
                />
                <span>{INVALID_MESSAGE}</span>
              </div>
              <Link
                href="/login"
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB]"
              >
                Back to login
              </Link>
            </>
          ) : null}

          {pageState === "success" ? (
            <>
              <h1 className="mb-1 text-xl font-bold text-[#111111]">
                Password updated
              </h1>
              <p className="mt-2 text-sm text-[#6B7280]">
                Your password has been changed. Sign in with your new password.
              </p>
              <Link
                href="/login"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #CC2B2B 0%, #991f1f 100%)",
                }}
              >
                Sign in
              </Link>
            </>
          ) : null}

          {pageState === "ready" ? (
            <>
              <h1 className="mb-1 text-xl font-bold text-[#111111]">
                Set a new password
              </h1>
              <p className="mb-6 text-sm text-[#6B7280]">
                Choose a new password for your account.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label
                    htmlFor="new-password"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-[#6B7280]"
                  >
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(event) => {
                        setFieldError(null);
                        setPassword(event.target.value);
                      }}
                      className="w-full rounded-xl border-[1.5px] border-[#E5E7EB] bg-[#F9FAFB] py-3 pl-4 pr-11 text-sm text-[#111111] transition-all focus:border-[#CC2B2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] transition-colors hover:text-[#6B7280]"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      <i
                        className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"} text-lg`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>

                <div className="mb-2">
                  <label
                    htmlFor="confirm-password"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-[#6B7280]"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(event) => {
                      setFieldError(null);
                      setConfirmPassword(event.target.value);
                    }}
                    className="w-full rounded-xl border-[1.5px] border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#111111] transition-all focus:border-[#CC2B2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10"
                    placeholder="Re-enter password"
                  />
                </div>

                {fieldError ? (
                  <p className="mt-2 text-sm text-[#CC2B2B]">{fieldError}</p>
                ) : null}

                {submitError ? (
                  <div
                    role="alert"
                    className="mt-3 flex items-center gap-2 rounded-xl border border-[#FCA5A5] bg-[#FDF2F2] px-4 py-3 text-sm text-[#CC2B2B]"
                  >
                    <i
                      className="ti ti-alert-circle text-base"
                      aria-hidden="true"
                    />
                    <span>{submitError}</span>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background:
                      "linear-gradient(135deg, #CC2B2B 0%, #991f1f 100%)",
                  }}
                  className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-none py-3 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 ${
                    loading ? "cursor-not-allowed opacity-70" : ""
                  }`}
                >
                  {loading ? (
                    <>
                      <i
                        className="ti ti-loader-2 animate-spin text-base"
                        aria-hidden="true"
                      />
                      Saving...
                    </>
                  ) : (
                    "Set password"
                  )}
                </button>
              </form>
            </>
          ) : null}

          <div className="mt-6 border-t border-[#F3F4F6] pt-5 text-center text-xs text-[#9CA3AF]">
            <p>Tropical Battery Company Limited</p>
            <p>&copy; 2026 All rights reserved.</p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          Inventory Intelligence Platform
        </p>
      </div>
    </div>
  );
}
