"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
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
              src="/TBC-Header-Logo.png"
              alt="Tropical Battery Company"
              width={220}
              height={40}
              className="mx-auto h-10 w-auto"
              priority
            />
            <div className="mb-5 mt-5 border-t border-[#F3F4F6]" />
          </div>

          <h1 className="mb-1 text-xl font-bold text-[#111111]">
            Sign in to your account
          </h1>
          <p className="mb-6 text-sm text-[#6B7280]">
            Enter your credentials to access the Inventory Intelligence platform.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-[#6B7280]"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border-[1.5px] border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#111111] transition-all focus:border-[#CC2B2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10"
                placeholder="you@company.com"
              />
            </div>

            <div className="mb-2">
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-[#6B7280]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-[#E5E7EB] bg-[#F9FAFB] py-3 pl-4 pr-11 text-sm text-[#111111] transition-all focus:border-[#CC2B2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] transition-colors hover:text-[#6B7280]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <i
                    className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"} text-lg`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            {error ? (
              <div
                role="alert"
                className="mb-1 mt-3 flex items-center gap-2 rounded-xl border border-[#FCA5A5] bg-[#FDF2F2] px-4 py-3 text-sm text-[#CC2B2B]"
              >
                <i
                  className="ti ti-alert-circle text-base"
                  aria-hidden="true"
                />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: "linear-gradient(135deg, #CC2B2B 0%, #991f1f 100%)",
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
                  Signing in...
                </>
              ) : (
                <>
                  <i className="ti ti-login text-base" aria-hidden="true" />
                  Sign in
                </>
              )}
            </button>
          </form>

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
