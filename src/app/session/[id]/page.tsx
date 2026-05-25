"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, AlertTriangle, CheckCircle,
  Terminal, BarChart3, Loader2, Sparkles, ChevronRight,
  Zap, Clock, Shield, Smile, Eye, Target, TrendingUp, Share2
} from "lucide-react";

interface TimelineEvent {
  id: string;
  timestamp: number;
  action: string;
  target?: string;
  reasoning?: string;
  screenshotUrl?: string;
}

interface ChecklistItem {
  priority: "critical" | "high" | "medium";
  effort: "5min" | "1hour" | "1day";
  area: string;
  fix: string;
  impact: string;
}

interface ExperienceScore {
  overall: number;
  clarity: number;
  navigation: number;
  speed: number;
  trust: number;
  delight: number;
  verdict: string;
  readyToShip: boolean;
}

interface AppProfile {
  appType: string;
  primaryGoal: string;
  audiencePersona: string;
  testingPlan: string;
}

interface UXReport {
  summary: string;
  whatWorkedWell: string[];
  frictionPoints: string[];
  improvements: string[];
  checklistItems?: ChecklistItem[];
  experienceScore?: ExperienceScore;
  appProfile?: AppProfile;
  behaviourPatterns?: string[];
  featureSuggestions?: string[];
}

export default function SessionReplay() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [status, setStatus] = useState<"pending" | "running" | "completed" | "failed">("pending");
  const [sessionInfo, setSessionInfo] = useState<{ url: string; description: string; prompt?: string; mode: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [currentThought, setCurrentThought] = useState<string>("");
  const [activeEventIndex, setActiveEventIndex] = useState<number>(-1);
  const [report, setReport] = useState<UXReport | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<"replay" | "report">("replay");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const timelineEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Session Info on mount
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/session/${sessionId}`);
        if (!res.ok) throw new Error("Failed to load session.");
        
        const data = await res.json();
        setSessionInfo({
          url: data.url,
          description: data.description,
          prompt: data.prompt || undefined,
          mode: data.mode || "analysis"
        });
        
        if (data.events && data.events.length > 0) {
          setEvents(data.events);
          setActiveEventIndex(data.events.length - 1);
        }
        
        if (data.status === "completed" || data.status === "failed") {
          setStatus(data.status);
          if (data.report) {
            setReport(data.report);
            setActiveTab("report");
          }
        }
      } catch (err: any) {
        console.error("Error fetching session:", err);
        setErrorMsg("Failed to load session details.");
      }
    }
    fetchSession();
  }, [sessionId]);

  // 2. SSE Stream Listener
  useEffect(() => {
    if (status === "completed" || status === "failed") return;

    setLogs(["Connecting to UX-Ray session controller..."]);
    const eventSource = new EventSource(`/api/run/${sessionId}`);

    eventSource.addEventListener("log", (e: any) => {
      const data = JSON.parse(e.data);
      setLogs(prev => [...prev, data.message]);
    });

    eventSource.addEventListener("thought", (e: any) => {
      const data = JSON.parse(e.data);
      setCurrentThought(data.thought);
      setStatus("running");
    });

    eventSource.addEventListener("event", (e: any) => {
      const data = JSON.parse(e.data) as TimelineEvent;
      setEvents(prev => {
        const updated = [...prev, data];
        setActiveEventIndex(updated.length - 1);
        return updated;
      });
    });

    eventSource.addEventListener("complete", async (e: any) => {
      const data = JSON.parse(e.data);
      setStatus("completed");
      eventSource.close();
      // Only trigger UX report for analysis mode
      if (data.mode !== "task") {
        setLogs(prev => [...prev, "Simulation finished. Commencing visual audit..."]);
        triggerReportGeneration();
      } else {
        setLogs(prev => [...prev, "Task completed. Reviewing action log..."]);
        setActiveTab("report");
      }
    });

    eventSource.addEventListener("error", (e: any) => {
      let msg = "An error occurred during browser execution.";
      try {
        const data = JSON.parse(e.data);
        msg = data.message || msg;
      } catch (err) {}
      setErrorMsg(msg);
      setStatus("failed");
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [sessionId]);

  // Scroll to bottom helper without jittering the main window
  useEffect(() => {
    if (logsEndRef.current && logsEndRef.current.parentElement) {
      logsEndRef.current.parentElement.scrollTop = logsEndRef.current.parentElement.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (timelineEndRef.current && timelineEndRef.current.parentElement) {
      timelineEndRef.current.parentElement.scrollTop = timelineEndRef.current.parentElement.scrollHeight;
    }
  }, [events]);

  // 3. Multimodal Report Request
  const triggerReportGeneration = async () => {
    setGeneratingReport(true);
    setActiveTab("report");
    try {
      const res = await fetch(`/api/report/${sessionId}`, { method: "POST" });
      if (!res.ok) throw new Error("Report generation failed.");
      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to generate UX report, but you can still review the interaction timeline.");
    } finally {
      setGeneratingReport(false);
    }
  };

  const activeEvent = activeEventIndex >= 0 ? events[activeEventIndex] : null;

  return (
    <div className="flex-1 flex flex-col bg-[#09090B] font-mono text-[#FAFAFA]">
      
      {/* Top Navbar */}
      <header className="px-6 py-4 border-b border-zinc-800 bg-zinc-950/60 backdrop-blur flex justify-between items-center relative z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/")}
            className="p-2 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-semibold tracking-wide flex items-center gap-2">
              <span>Session Explorer</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                status === "completed" ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20" :
                status === "running" ? "bg-purple-950 text-purple-400 border border-purple-500/20 animate-pulse" :
                status === "failed" ? "bg-rose-950 text-rose-400 border border-rose-500/20" :
                "bg-zinc-800 text-zinc-400"
              }`}>
                {status}
              </span>
            </h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">Session ID: {sessionId}</p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-900/80 border border-zinc-800 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab("replay")}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === "replay" 
                  ? "bg-purple-600 text-white shadow-lg" 
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Session Replay
            </button>
            <button 
              onClick={() => setActiveTab("report")}
              disabled={status !== "completed" && !report && events.length === 0}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === "report" 
                  ? "bg-purple-600 text-white shadow-lg" 
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {sessionInfo?.mode === "task" ? "Task Log" : "UX Audit Report"}
            </button>
          </div>
          
          {activeTab === "report" && status === "completed" && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert("Report link copied to clipboard!");
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all cursor-pointer border border-zinc-700"
            >
              <Share2 className="w-4 h-4" />
              Share Report
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace split screen */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-[calc(100vh-69px)]">
        
        {/* Left Side: Browser Mockup Replay View OR Full Report */}
        <div className={`${activeTab === "report" ? "lg:col-span-12" : "lg:col-span-8"} p-6 flex flex-col justify-center items-center bg-zinc-950 relative overflow-hidden border-r border-zinc-900 transition-all duration-300`}>
          
          <div className="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[80px] pointer-events-none" />

          {activeTab === "replay" ? (
            <div className="w-full max-w-[960px] flex flex-col h-full max-h-[640px]">
              
              {/* Browser Header Bar */}
              <div className="w-full bg-zinc-900 border border-zinc-800 rounded-t-xl px-4 py-3 flex items-center gap-3">
                {/* Simulated window bullets */}
                <div className="flex gap-1.5 shrink-0">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                {/* Simulated address bar */}
                <div className="flex-1 bg-zinc-950/80 border border-zinc-800/80 text-[11px] text-zinc-500 px-3 py-1 rounded-md overflow-hidden text-ellipsis whitespace-nowrap text-center font-semibold">
                  {sessionInfo ? sessionInfo.url : "Booting Playwright context..."}
                </div>
              </div>

              {/* Browser Canvas */}
              <div className="flex-1 bg-zinc-950 border-x border-b border-zinc-800 rounded-b-xl relative overflow-hidden flex items-center justify-center">
                {activeEvent?.screenshotUrl ? (
                  <div className="w-full h-full relative flex items-center justify-center bg-zinc-950">
                    <img 
                      src={activeEvent.screenshotUrl} 
                      alt="browser preview" 
                      className="max-w-full max-h-full object-contain"
                    />

                    {/* Glowing human target visual cue to indicate a click action */}
                    {activeEvent.action === "click" && (
                      <div className="absolute w-8 h-8 rounded-full border border-teal-400 bg-teal-400/20 animate-ping pointer-events-none flex items-center justify-center top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="w-3 h-3 bg-teal-400 rounded-full" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 text-center text-zinc-500 p-8 max-w-sm">
                    {status === "failed" ? (
                      <>
                        <AlertTriangle className="w-12 h-12 text-rose-500 animate-bounce" />
                        <h3 className="text-sm font-bold text-rose-400">Simulation Interrupted</h3>
                        <p className="text-[11px] leading-relaxed">{errorMsg}</p>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                        <h3 className="text-sm font-bold text-zinc-300">Launching Isolated Browser</h3>
                        <p className="text-[11px] leading-relaxed">UX-Ray is initializing the Chromium sandboxed runner to securely load your website structure.</p>
                      </>
                    )}
                  </div>
                )}

                {/* Thought bubble Overlay */}
                {currentThought && status === "running" && (
                  <div className="absolute bottom-4 left-4 right-4 bg-zinc-900/90 border border-purple-500/30 p-3.5 rounded-xl backdrop-blur text-xs flex items-start gap-3 shadow-2xl z-10 transition-all">
                    <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] text-purple-400 font-bold block mb-1 uppercase tracking-wider">AI Thoughts (Simulating First-Time User)</span>
                      <p className="text-zinc-300 italic">"{currentThought}"</p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* Tab: Report or Task Log */
            <div className="w-full max-w-[880px] h-full flex flex-col gap-6 overflow-y-auto pr-2">

              {sessionInfo?.mode === "task" ? (
                /* ── Task Log View ── */
                <div className="flex flex-col gap-4 pb-12">
                  <div className="p-5 rounded-2xl border border-teal-900/40 bg-teal-950/10">
                    <h3 className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Task Execution Log
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Every action the AI agent performed on the page, in order.
                    </p>
                  </div>

                  {status === "running" && (
                    <div className="flex items-center gap-3 text-teal-400 text-xs p-4 rounded-xl border border-teal-900/30 bg-teal-950/10">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Agent is running the task…</span>
                    </div>
                  )}

                  {events.length === 0 && status !== "running" && (
                    <div className="flex items-center justify-center text-zinc-500 text-xs p-8">
                      No actions recorded yet.
                    </div>
                  )}

                  {events.map((e, i) => (
                    <div key={e.id} className="flex gap-3 items-start">
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                          e.action === "type" ? "border-cyan-500/40 bg-cyan-950/30 text-cyan-400" :
                          e.action === "click" ? "border-teal-500/40 bg-teal-950/30 text-teal-400" :
                          e.action === "navigate" ? "border-purple-500/40 bg-purple-950/30 text-purple-400" :
                          "border-zinc-700 bg-zinc-900 text-zinc-400"
                        }`}>{i + 1}</div>
                        {i < events.length - 1 && <div className="w-px h-4 bg-zinc-800" />}
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            e.action === "type" ? "bg-cyan-950 text-cyan-400 border border-cyan-500/20" :
                            e.action === "click" ? "bg-teal-950 text-teal-400 border border-teal-500/20" :
                            e.action === "navigate" ? "bg-purple-950 text-purple-400 border border-purple-500/20" :
                            "bg-zinc-800 text-zinc-400"
                          }`}>{e.action}</span>
                          <span className="text-[10px] text-zinc-500">+{e.timestamp}s</span>
                        </div>
                        {e.target && <p className="text-xs text-white font-semibold mb-0.5">{e.target}</p>}
                        {e.reasoning && <p className="text-[11px] text-zinc-400 italic">{e.reasoning}</p>}
                      </div>
                    </div>
                  ))}

                  {status === "completed" && events.length > 0 && (
                    <div className="mt-2 p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/10 flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-emerald-400">Task Complete</p>
                        <p className="text-[11px] text-zinc-400">{events.length} actions performed successfully.</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── UX Audit Report View ── */
                generatingReport ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                    <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
                    <h3 className="text-base font-bold text-zinc-300">Generating UX Audit Report</h3>
                    <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                      Evaluating visual screenshots, action hesitation delays, and cognitive struggle markers.
                    </p>
                  </div>
                ) : report ? (
                  <div className="flex flex-col gap-6 pb-12">

                    {/* App Intelligence Banner */}
                    {report.appProfile && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-purple-500/20 bg-purple-950/10 text-xs flex-wrap">
                        <Target className="w-4 h-4 text-purple-400 shrink-0" />
                        <span className="text-purple-300 font-semibold">Recognized:</span>
                        <span className="text-zinc-300 font-mono">{report.appProfile.appType}</span>
                        <span className="text-zinc-600">·</span>
                        <span className="text-zinc-400">Testing as: <span className="text-zinc-300">{report.appProfile.audiencePersona}</span></span>
                      </div>
                    )}

                    {/* Experience Score Hero */}
                    {report.experienceScore && (
                      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30">
                        <div className="flex items-start justify-between mb-5">
                          <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Human Experience Score</p>
                            <div className="flex items-end gap-3">
                              <span className={`text-6xl font-black font-sans leading-none ${
                                report.experienceScore.overall >= 75 ? "text-emerald-400" :
                                report.experienceScore.overall >= 55 ? "text-amber-400" : "text-rose-400"
                              }`}>{report.experienceScore.overall}</span>
                              <span className="text-zinc-500 text-lg mb-1">/100</span>
                            </div>
                          </div>
                          <div className={`px-4 py-2 rounded-xl border font-bold text-sm ${
                            report.experienceScore.readyToShip
                              ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-400"
                              : "border-amber-500/30 bg-amber-950/30 text-amber-400"
                          }`}>
                            {report.experienceScore.readyToShip ? "✓ Ready to Ship" : "⚠ Needs Work"}
                          </div>
                        </div>
                        <div className="grid grid-cols-5 gap-3 mb-5">
                          {([
                            { label: "Clarity", key: "clarity" as const, icon: Eye },
                            { label: "Navigate", key: "navigation" as const, icon: TrendingUp },
                            { label: "Speed", key: "speed" as const, icon: Zap },
                            { label: "Trust", key: "trust" as const, icon: Shield },
                            { label: "Delight", key: "delight" as const, icon: Smile },
                          ]).map(({ label, key, icon: Icon }) => {
                            const val = report.experienceScore![key];
                            const color = val >= 75 ? "bg-emerald-400" : val >= 55 ? "bg-amber-400" : "bg-rose-400";
                            return (
                              <div key={key} className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                                  <Icon className="w-3 h-3" />
                                  <span>{label}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                  <div className={`h-full rounded-full ${color}`} style={{ width: `${val}%` }} />
                                </div>
                                <span className="text-[11px] font-bold text-zinc-300">{val}</span>
                              </div>
                            );
                          })}
                        </div>
                        <blockquote className="border-l-2 border-purple-500/40 pl-4 text-sm text-zinc-300 italic leading-relaxed">
                          &ldquo;{report.experienceScore.verdict}&rdquo;
                        </blockquote>
                      </div>
                    )}

                    {/* Actionable Checklist */}
                    {report.checklistItems && report.checklistItems.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-teal-400" />
                          Actionable Fix Checklist
                        </h4>
                        {report.checklistItems.map((item, i) => {
                          const ps = item.priority === "critical"
                            ? { bar: "bg-rose-500", badge: "bg-rose-950 text-rose-400 border-rose-500/20", label: "Critical" }
                            : item.priority === "high"
                            ? { bar: "bg-amber-500", badge: "bg-amber-950 text-amber-400 border-amber-500/20", label: "High" }
                            : { bar: "bg-yellow-600", badge: "bg-yellow-950 text-yellow-400 border-yellow-500/20", label: "Medium" };
                          const es = item.effort === "5min"
                            ? "bg-emerald-950 text-emerald-400 border-emerald-500/20"
                            : item.effort === "1hour"
                            ? "bg-cyan-950 text-cyan-400 border-cyan-500/20"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700";
                          return (
                            <div key={i} className="flex rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
                              <div className={`w-1 shrink-0 ${ps.bar}`} />
                              <div className="flex-1 p-4">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${ps.badge}`}>{ps.label}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded border font-bold flex items-center gap-1 ${es}`}>
                                    <Clock className="w-2.5 h-2.5" /> {item.effort}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">{item.area}</span>
                                </div>
                                <p className="text-xs text-white font-semibold mb-1 leading-relaxed">{item.fix}</p>
                                <p className="text-[11px] text-zinc-500 italic">{item.impact}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* User Behaviour Patterns + Feature Suggestions */}
                    {((report.behaviourPatterns?.length ?? 0) > 0 || (report.featureSuggestions?.length ?? 0) > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {report.behaviourPatterns && report.behaviourPatterns.length > 0 && (
                          <div className="p-5 rounded-xl border border-cyan-950/30 bg-cyan-950/10 flex flex-col gap-3">
                            <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                              <Eye className="w-4 h-4" />User Behaviour Patterns
                            </h4>
                            <p className="text-[10px] text-zinc-500 -mt-1">What users naturally try to do — even things the app doesn&apos;t support yet.</p>
                            <ul className="flex flex-col gap-2">
                              {report.behaviourPatterns.map((b, i) => (
                                <li key={i} className="text-xs text-zinc-400 flex items-start gap-2 leading-relaxed">
                                  <span className="text-cyan-500 font-bold mt-0.5">→</span><span>{b}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {report.featureSuggestions && report.featureSuggestions.length > 0 && (
                          <div className="p-5 rounded-xl border border-purple-950/30 bg-purple-950/10 flex flex-col gap-3">
                            <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                              <Sparkles className="w-4 h-4" />Feature Opportunities
                            </h4>
                            <p className="text-[10px] text-zinc-500 -mt-1">Features users clearly wanted but your app doesn&apos;t have yet.</p>
                            <ul className="flex flex-col gap-2">
                              {report.featureSuggestions.map((f, i) => (
                                <li key={i} className="text-xs text-zinc-400 flex items-start gap-2 leading-relaxed">
                                  <span className="text-purple-400 font-bold mt-0.5">+</span><span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* What Worked / Friction */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 rounded-xl border border-emerald-950/30 bg-emerald-950/10 flex flex-col gap-3">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />What Worked Well
                        </h4>
                        <ul className="flex flex-col gap-2">
                          {report.whatWorkedWell.map((w, i) => (
                            <li key={i} className="text-xs text-zinc-400 flex items-start gap-2 leading-relaxed">
                              <span className="text-emerald-500 font-bold mt-0.5">•</span><span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-5 rounded-xl border border-amber-950/30 bg-amber-950/10 flex flex-col gap-3">
                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />UX Friction Points
                        </h4>
                        <ul className="flex flex-col gap-2">
                          {report.frictionPoints.map((f, i) => (
                            <li key={i} className="text-xs text-zinc-400 flex items-start gap-2 leading-relaxed">
                              <span className="text-amber-500 font-bold mt-0.5">•</span><span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Researcher Summary */}
                    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 opacity-5"><Sparkles className="w-16 h-16 text-purple-500" /></div>
                      <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5" />Researcher Summary
                      </h4>
                      <p className="text-sm text-zinc-300 leading-relaxed italic">&ldquo;{report.summary}&rdquo;</p>
                    </div>

                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-500">
                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                    <p className="text-xs">Report could not be retrieved. Try re-running the session.</p>
                  </div>
                )
              )}

            </div>
          )}

        </div>

        {/* Right Side: Terminal Log timeline */}
        {activeTab !== "report" && (
          <div className="lg:col-span-4 flex flex-col bg-zinc-950 border-t lg:border-t-0 border-zinc-900">
          
          {/* Console / Terminal Section */}
          <div className="flex-1 flex flex-col min-h-0 border-b border-zinc-900">
            <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-900 flex justify-between items-center shrink-0">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-purple-500" />
                <span>Playwright CLI Logs</span>
              </span>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto font-mono text-[10px] text-zinc-400 flex flex-col gap-1.5 select-none bg-zinc-950">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2 items-start leading-relaxed">
                  <ChevronRight className="w-3 h-3 text-purple-500 shrink-0 mt-0.5" />
                  <span className="break-all">{log}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Timeline Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-900 flex justify-between items-center shrink-0">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                <span>Interaction Timeline</span>
              </span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-zinc-950/60">
              {events.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center text-zinc-600 text-xs p-4">
                  Waiting for browser interaction events...
                </div>
              ) : (
                events.map((e, index) => (
                  <button
                    key={e.id}
                    onClick={() => setActiveEventIndex(index)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                      activeEventIndex === index 
                        ? "border-purple-500/80 bg-purple-950/15 shadow-[0_0_15px_rgba(168,85,247,0.1)]" 
                        : "border-zinc-800 bg-zinc-900/10 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        e.action === "click" ? "bg-teal-950 text-teal-400 border border-teal-500/20" :
                        e.action === "type" ? "bg-cyan-950 text-cyan-400 border border-cyan-500/20" :
                        e.action === "navigate" ? "bg-purple-950 text-purple-400 border border-purple-500/20" :
                        "bg-zinc-800 text-zinc-400"
                      }`}>
                        {e.action}
                      </span>
                      <span className="text-[10px] text-zinc-500">+{e.timestamp}s</span>
                    </div>

                    <p className="text-[11px] font-bold text-white mb-1.5">{e.target}</p>
                    
                    {e.reasoning && (
                      <p className="text-[10px] text-zinc-400 leading-relaxed italic bg-zinc-950/40 p-2 rounded border border-zinc-800/40">
                        "{e.reasoning}"
                      </p>
                    )}
                  </button>
                ))
              )}
              <div ref={timelineEndRef} />
            </div>
          </div>

        </div>
        )}

      </div>
    </div>
  );
}
