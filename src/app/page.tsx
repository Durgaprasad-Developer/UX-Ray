"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, AlertCircle, Play, Eye, Zap, ScanSearch } from "lucide-react";

type Mode = "analysis" | "task";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("analysis");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [task, setTask] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presets = [
    { label: "⚡ First Impression", value: "You are a first-time visitor. Simply explore the landing page naturally. Do you understand what the product does immediately?" },
    { label: "⏳ Impatient Customer", value: "You are an extremely impatient customer. Browse the site quickly and interact naturally. Note anything that slows you down or frustrates you." },
    { label: "😕 Confused User", value: "You are a non-technical user. Try to navigate the core pages. Do you find the layout, terminology, and visual hierarchy confusing?" },
    { label: "🕵️ Deep Explorer", value: "You are a highly curious user. Click around the navigation and read the content. Are the links clear and informative?" },
    { label: "👀 Visual Tester", value: "You rely on clear visual design. Navigate the site naturally and note if the contrast, text size, and element spacing are comfortable." }
  ];

  const taskPresets = [
    { label: "📝 Fill a form", value: "Find any form on the page and fill in all required fields with realistic data, then submit it." },
    { label: "🔐 Sign up", value: "Complete the sign up / registration flow from start to finish." },
    { label: "🔎 Search", value: "Find the search bar and search for a relevant keyword, then click the first result." },
    { label: "📧 Subscribe", value: "Find the newsletter or email subscription field and subscribe with a test email." },
    { label: "🛒 Add to cart", value: "Find a product and add it to the cart or wishlist." },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError("Please provide a website URL to scan.");
      return;
    }

    if (mode === "analysis" && !description.trim()) {
      setError("Please describe your app so the AI simulator understands what to expect.");
      return;
    }

    if (mode === "task" && !task.trim()) {
      setError("Please describe the task you want the AI agent to complete.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          description: mode === "analysis" ? description.trim() : task.trim(),
          prompt: mode === "analysis" ? (prompt.trim() || undefined) : task.trim(),
          mode
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to launch simulation.");
      }

      router.push(`/session/${data.sessionId}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col justify-center items-center px-4 py-16 relative overflow-hidden bg-[#09090B] font-mono text-[#FAFAFA]">
      
      {/* Visual background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-3xl w-full flex flex-col items-center text-center relative z-10">
        
        {/* Version Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-950/20 text-purple-400 text-xs font-sans font-semibold mb-8 hover:border-purple-400/50 transition-colors cursor-default">
          <Sparkles className="w-3.5 h-3.5" />
          <span>UX-Ray v1.0 • Developer Beta</span>
        </div>

        {/* Display Headline */}
        <h1 className="text-4xl md:text-6xl font-sans font-bold tracking-tight text-white leading-[1.1] mb-6">
          See what first-time users <br />
          <span className="bg-gradient-to-r from-purple-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent font-sans">
            actually experience
          </span> on your site.
        </h1>

        {/* Subtitle */}
        <p className="text-zinc-400 max-w-xl text-sm md:text-base leading-relaxed mb-8">
          UX-Ray launches a live, isolated browser simulator that interacts with your page like a real human. Watch real-time logs, click pathways, and get actionable reports instantly.
        </p>

        {/* ── Mode Toggle ── */}
        <div className="flex p-1 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur mb-8 w-full max-w-sm">
          <button
            type="button"
            onClick={() => { setMode("analysis"); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === "analysis"
                ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-900/40"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <ScanSearch className="w-3.5 h-3.5" />
            UX Analysis
          </button>
          <button
            type="button"
            onClick={() => { setMode("task"); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === "task"
                ? "bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-lg shadow-teal-900/40"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Task Runner
          </button>
        </div>

        {/* Mode description */}
        <p className="text-zinc-500 text-[11px] mb-8 -mt-4">
          {mode === "analysis"
            ? "Simulates a real first-time user and generates a full UX audit report."
            : "Executes a specific task on the page and returns a step-by-step action log."}
        </p>

        {/* Error Alert */}
        {error && (
          <div className="w-full mb-6 p-4 rounded-xl border border-rose-500/20 bg-rose-950/20 text-rose-400 text-sm flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Input Card */}
        <form onSubmit={handleSubmit} className="w-full p-6 md:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-2xl flex flex-col gap-6 text-left">
          
          {mode === "analysis" ? (
            <>
              {/* Analysis Mode: App Description */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                  <span>1. What does your application do?</span>
                  <span className="text-purple-400 font-bold">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. A developer SaaS tool for tracking GitHub profile analytics..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950/60 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-purple-500 transition-all resize-none"
                />
                <span className="text-[10px] text-zinc-500">
                  * Context is required to simulate realistic, informed human expectations.
                </span>
              </div>

              {/* Analysis Mode: Preset Pills */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  2. Choose a simulated behavior goal
                </label>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPrompt(p.value)}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all flex items-center gap-1 ${
                        prompt === p.value
                          ? "border-purple-500 bg-purple-950/40 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                          : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Analysis Mode: Custom prompt */}
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Or write custom instructions (e.g. Try signing up and purchasing standard tier...)"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950/60 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-purple-500 transition-all"
                />
              </div>
            </>
          ) : (
            <>
              {/* Task Mode: Task description */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                  <span>1. What should the AI do?</span>
                  <span className="text-teal-400 font-bold">*</span>
                </label>
                <textarea
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  placeholder="e.g. Find the contact form, fill in Name as 'Durga Prasad', email as 'test@example.com', and click Submit."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950/60 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-teal-500 transition-all resize-none"
                />
                <span className="text-[10px] text-zinc-500">
                  Be specific. The AI will execute this task step-by-step and return a log of every action.
                </span>
              </div>

              {/* Task Mode: Quick task presets */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  2. Or pick a quick task
                </label>
                <div className="flex flex-wrap gap-2">
                  {taskPresets.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTask(p.value)}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all flex items-center gap-1 ${
                        task === p.value
                          ? "border-teal-500 bg-teal-950/40 text-teal-300 shadow-[0_0_10px_rgba(20,184,166,0.2)]"
                          : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* URL + Submit (shared between both modes) */}
          <div className="flex flex-col md:flex-row gap-3 mt-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter website URL (e.g. stripe.com)"
                className="w-full pl-4 pr-4 py-3.5 rounded-xl border border-zinc-800 bg-zinc-950/80 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-teal-500 transition-all font-semibold"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none cursor-pointer shadow-lg ${
                mode === "analysis"
                  ? "bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-500 hover:to-teal-500 shadow-purple-900/30"
                  : "bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 shadow-teal-900/30"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{mode === "task" ? "Dispatching Agent..." : "Launching AI Agent..."}</span>
                </>
              ) : (
                <>
                  {mode === "task" ? <Zap className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                  <span>{mode === "task" ? "Run Task" : "Analyze Website"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </form>

        {/* Footer note */}
        <div className="mt-8 flex items-center gap-2 text-zinc-500 text-[11px] uppercase tracking-wider">
          <Eye className="w-3.5 h-3.5" />
          <span>Fully automated. Sandboxed Playwright environment. No login required.</span>
        </div>

      </div>
    </main>
  );
}
