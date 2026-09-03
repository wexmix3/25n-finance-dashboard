"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createBrowserSupabaseClient();

    // Sign-in only — self-serve sign-up removed 2026-09-02. Accounts are
    // provisioned by Max via the Supabase Admin API.
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message || "Invalid email or password.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2.5 mb-2">
            <span className="text-3xl font-extrabold tracking-tight text-[#E07A3E]">25N</span>
            <span className="text-lg font-light text-gray-300">|</span>
            <span className="text-sm font-semibold tracking-[0.2em] text-gray-400 uppercase">Coworking</span>
          </div>
          <p className="text-xs font-medium text-gray-400 tracking-[0.2em] uppercase">Financial Dashboard</p>
        </div>

        <div className="bg-white rounded-[20px] border border-gray-100 p-9 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E07A3E]/40 focus:border-[#E07A3E] transition-colors duration-150"
                placeholder="you@25ncoworking.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E07A3E]/40 focus:border-[#E07A3E] transition-colors duration-150"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#E07A3E] text-white text-sm font-semibold rounded-full hover:bg-[#c5692f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
