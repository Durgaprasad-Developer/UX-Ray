"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, AlertCircle, Play, Terminal, Globe } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError("Please enter a website URL.");
      return;
    }
    if (!prompt.trim()) {
      setError("Please describe the task you want the agent to perform.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          prompt: prompt.trim(),
          mode: "task",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start task.");
      router.push(`/session/${data.sessionId}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-4 relative overflow-hidden bg-[#09090B] font-mono text-[#FAFAFA]">

      {/* Background glows */}
      <div className="absolute top-[-15%] left-[-5%] w-[600px] h-[600px] bg-teal-500/8 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] bg-purple-500/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-xl w-full flex flex-col items-center text-center relative z-10 gap-8">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-teal-500/30 bg-teal-950/20 text-teal-400 text-xs font-semibold select-none">
          <Terminal className="w-3.5 h-3.5" />
          Autonomous Browser Agent
        </div>

        {/* Headline */}
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl md:text-5xl font-sans font-bold tracking-tight text-white leading-[1.1]">
            Task Doer
          </h1>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-sm mx-auto">
            Give it a URL and a task. It opens a browser, reasons through the page, and executes the steps for you — including closing popups.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="w-full p-4 rounded-xl border border-rose-500/20 bg-rose-950/20 text-rose-400 text-sm flex items-start gap-3 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="w-full flex flex-col gap-4 p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-2xl text-left"
        >
          {/* URL */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="url-input" className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-teal-500" />
              Website URL
            </label>
            <input
              id="url-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com"
              autoComplete="off"
              className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950 text-white placeholder-zinc-600 text-sm font-sans focus:outline-none focus:border-teal-500/50 transition-colors"
            />
          </div>

          {/* Task */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="prompt-input" className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-teal-500" />
              Task
            </label>
            <textarea
              id="prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Search for english songs and play 3 videos. If any popups appear, find the close or X symbol and dismiss them."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950 text-white placeholder-zinc-600 text-sm font-sans focus:outline-none focus:border-teal-500/50 transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            id="run-task-btn"
            disabled={loading}
            className="w-full mt-1 py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none cursor-pointer bg-gradient-to-r from-teal-600 to-purple-600 shadow-lg shadow-teal-900/20"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Launching Agent...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Task
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-zinc-700 text-[10px] flex items-center gap-1.5">
          Playwright Chromium · Gemini Vision · Live Replay
        </p>

      </div>
    </main>
  );
}
