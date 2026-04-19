"use client";

import { useState } from "react";
import { supabase } from "./lib/supabase";

export default function Page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      alert("Login successful 🚀");
    }

    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-blue-200 dark:from-[#0f172a] dark:via-[#0b1120] dark:to-[#020617]">
        {/* Toggle */}
        <button
          onClick={() => setDark(!dark)}
          className="absolute top-6 right-6 px-4 py-2 rounded-lg text-sm bg-gray-200 dark:bg-gray-700 text-black dark:text-white"
        >
          {dark ? "Light Mode" : "Dark Mode"}
        </button>

        {/* Card */}
        <div className="w-full max-w-md p-8 rounded-2xl shadow-2xl bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10">
          <h1 className="text-xl font-semibold text-center mb-4 text-gray-800 dark:text-white">
            RealtimePlanners
          </h1>

          <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white">
            Welcome Back
          </h2>

          <p className="text-center text-gray-500 dark:text-gray-400 mb-6">
            Sign in to your admin dashboard
          </p>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-full mb-4 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-transparent text-gray-800 dark:text-white"
          />

          <div className="w-full mb-4 relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-transparent text-gray-800 dark:text-white pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-2 rounded-lg"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          {error && (
            <p className="text-red-500 text-sm mt-3 text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
