"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, AlertCircle, ScanSearch, Lock, ChevronDown, ChevronUp } from "lucide-react";

const PRESETS = [
  {
    label: "🔮 Full Site Audit",
    desc: "Visit every page, test every feature, map complete user journey",
    value: "Conduct a complete audit of this website. Visit every page in the navigation, test every button and form, try the core feature end-to-end, and map the full user journey from landing to conversion."
  },
  {
    label: "🚀 Onboarding Flow",
    desc: "Go through signup/login/onboarding as a brand new user",
    value: "Simulate a brand new user going through the signup and onboarding process. Find the signup button, create an account, and complete any onboarding steps. Note every friction point."
  },
  {
    label: "💡 Feature Discovery",
    desc: "Can users find and understand all features without a guide?",
    value: "Explore every feature this app offers. Navigate through all sections, try every interactive element, and evaluate whether features are discoverable and understandable without any documentation."
  },
  {
    label: "📊 Conversion Path",
    desc: "Test the path from landing page to signup or purchase",
    value: "You are a potential customer evaluating this product. Read the value proposition, check pricing, look for social proof, and try to complete the primary conversion action (signup, purchase, or CTA)."
  },
  {
    label: "🔍 Friction Hunter",
    desc: "Actively find every confusing, broken, or frustrating thing",
    value: "You are hunting for UX problems. Be critical. Find every confusing label, unhelpful error message, hidden button, unclear copy, and point where users would give up. Be specific and harsh."
  },
];

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState(PRESETS[0].value);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [showCredentials, setShowCredentials] = useState(false);
  const [credUsername, setCredUsername] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreset = (i: number) => {
    setSelectedPreset(i);
    setPrompt(PRESETS[i].value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) { setError("Please enter your website URL."); return; }
    if (!description.trim()) { setError("Please briefly describe your app. This is how the AI knows what to test."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          description: description.trim(),
          prompt: prompt.trim() || undefined,
          credentials: showCredentials && credUsername && credPassword
            ? { username: credUsername.trim(), password: credPassword.trim() }
            : null,
        }),
      });

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start analysis.");
        router.push(`/session/${data.sessionId}`);
      } else {
        throw new Error(`Server returned ${res.status}: Restart your Next.js dev server if this persists.`);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col justify-center items-center px-4 py-16 relative overflow-hidden bg-[#09090B] font-mono text-[#FAFAFA]">
      
      {/* Background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-500/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-2xl w-full flex flex-col items-center text-center relative z-10">

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-950/20 text-purple-400 text-xs font-sans font-semibold mb-6 cursor-default">
          <Sparkles className="w-3.5 h-3.5" />
          UX-Ray — AI User Testing for Developers
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-5xl font-sans font-bold tracking-tight text-white leading-[1.1] mb-4">
          Test your app like{" "}
          <span className="bg-gradient-to-r from-purple-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent font-sans">
            1000 real users
          </span>{" "}
          just tried it.
        </h1>

        <p className="text-zinc-400 max-w-lg text-sm leading-relaxed mb-8">
          Paste your URL. Our AI navigates every page, tests every feature, and gives you an honest report with a prioritized fix list — in minutes.
        </p>

        {/* Error */}
        {error && (
          <div className="w-full mb-5 p-4 rounded-xl border border-rose-500/20 bg-rose-950/20 text-rose-400 text-sm flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Card */}
        <form onSubmit={handleSubmit} className="w-full p-6 md:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-2xl flex flex-col gap-5 text-left">

          {/* URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Website URL</label>
            <input
              type="text"
              id="url-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourapp.com"
              className="w-full px-4 py-3.5 rounded-xl border border-zinc-800 bg-zinc-950/80 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-purple-500/60 transition-all font-semibold tracking-wide"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              What does your app do? <span className="text-purple-400">*</span>
            </label>
            <textarea
              value={description}
              id="description-input"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. GitHub profile analyzer that scores developers for recruiters. Users paste a GitHub username and get a detailed skills + activity report."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950/60 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-purple-500/60 transition-all resize-none leading-relaxed"
            />
            <p className="text-[10px] text-zinc-600">The more context you give, the more realistic and accurate the simulation.</p>
          </div>

          {/* Test Type */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">What do you want to test?</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESETS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  id={`preset-${i}`}
                  onClick={() => handlePreset(i)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    selectedPreset === i
                      ? "border-purple-500/60 bg-purple-950/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                      : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
                  }`}
                >
                  <p className={`text-xs font-bold mb-0.5 ${selectedPreset === i ? "text-purple-300" : "text-zinc-300"}`}>{p.label}</p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Credentials (expandable) */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowCredentials(!showCredentials)}
              className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer w-fit"
            >
              <Lock className="w-3.5 h-3.5" />
              {showCredentials ? "Hide" : "Add"} login credentials
              {showCredentials ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showCredentials && (
              <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/40">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Email / Username</label>
                  <input
                    type="text"
                    value={credUsername}
                    onChange={(e) => setCredUsername(e.target.value)}
                    placeholder="test@example.com"
                    className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-purple-500/60 transition-all"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Password</label>
                  <input
                    type="password"
                    value={credPassword}
                    onChange={(e) => setCredPassword(e.target.value)}
                    placeholder="••••••••"
                    className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-purple-500/60 transition-all"
                  />
                </div>
              </div>
            )}
            {showCredentials && (
              <p className="text-[10px] text-zinc-600">Credentials are used only during this simulation and never stored permanently.</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            id="analyze-button"
            disabled={loading}
            className="w-full py-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none cursor-pointer bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-500 hover:to-teal-500 shadow-lg shadow-purple-900/20"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Launching AI Agent...</span>
              </>
            ) : (
              <>
                <ScanSearch className="w-4 h-4" />
                <span>Analyze Website</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

        </form>

        {/* Footer trust line */}
        <p className="mt-6 text-zinc-600 text-[11px] flex items-center gap-2">
          <ScanSearch className="w-3.5 h-3.5" />
          Sandboxed Playwright browser · NVIDIA Llama 3.1 · Instant results
        </p>

      </div>
    </main>
  );
}
