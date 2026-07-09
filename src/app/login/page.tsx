"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const supabase = createBrowserSupabaseClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message || error.name || `Sign up failed (${JSON.stringify(error)})`);
      } else if (data.user && !data.session) {
        setMessage("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        setMessage("Account created. You can now sign in.");
        setMode("signin");
      }
      setLoading(false);
      return;
    }

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl font-extrabold tracking-tight text-[#E07A3E]">25N</span>
            <span className="text-lg font-light text-gray-300">|</span>
            <span className="text-sm font-semibold tracking-widest text-gray-400 uppercase">Coworking</span>
          </div>
          <p className="text-sm text-gray-400 tracking-wide uppercase">Financial Dashboard</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E07A3E] focus:border-transparent"
                placeholder="you@25ncoworking.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E07A3E] focus:border-transparent"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-emerald-600">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-[#E07A3E] text-white text-sm font-semibold rounded-lg hover:bg-[#c5692f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
            >
              {loading
                ? mode === "signup" ? "Creating account..." : "Signing in..."
                : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-400">
            {mode === "signin" ? (
              <>No account?{" "}
                <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }} className="text-gray-700 underline">
                  Create one
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button onClick={() => { setMode("signin"); setError(""); setMessage(""); }} className="text-gray-700 underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
