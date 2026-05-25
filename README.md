<div align="center">
  <img src="https://via.placeholder.com/1200x400/09090b/a855f7?text=UX-Ray+-+Automated+AI+User+Testing" alt="UX-Ray Banner" />

  <h1>⚡ UX-Ray</h1>
  <p><strong>Autonomous AI QA Agent & User Testing Simulator</strong></p>

  <p>
    <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js" alt="Next.js" /></a>
    <a href="https://playwright.dev/"><img src="https://img.shields.io/badge/Playwright-Browser_Automation-2EAD33?style=flat&logo=playwright" alt="Playwright" /></a>
    <a href="https://ai.meta.com/llama/"><img src="https://img.shields.io/badge/Powered_by-LLaMA_3.3_70B-blue?style=flat&logo=meta" alt="LLaMA 3.3" /></a>
    <a href="https://deepmind.google/technologies/gemini/"><img src="https://img.shields.io/badge/Multimodal-Gemini_Pro-orange?style=flat&logo=google" alt="Gemini" /></a>
  </p>
</div>

<br/>

**UX-Ray** is an autonomous AI agent designed for startups and indie builders. It acts as a simulation of 1,000 real first-time users, intelligently navigating your web application to identify UX friction, discover behavior patterns, and generate developer-ready actionable checklists before you launch.

## 📋 Table of Contents
- [✨ Core Features](#-core-features)
- [🏗️ System Architecture](#-system-architecture)
- [💻 Tech Stack](#-tech-stack)
- [⚙️ Environment Variables Reference](#️-environment-variables-reference)
- [🚀 Local Installation](#-local-installation)
- [🕹️ Usage Guide](#️-usage-guide)
- [📜 License](#-license)

---

## ✨ Core Features

- 🧠 **Senior QA Algorithmic Explorer:** UX-Ray is prompted with strict algorithmic rules. It deduces visual hierarchy based on button sizes (width/height), explicitly tests edge cases, and maps out core workflows without getting stuck in loops.
- 👁️ **Spatial & Semantic Awareness:** The internal Playwright engine extracts rich DOM metadata including `width`, `height`, `disabled` states, `aria-labels`, and `hrefs`. This gives the AI true "sight" of your app.
- ⏳ **Smart Auto-Wait Engine:** Built directly into the execution engine, the AI automatically detects active spinners or loading text and waits for your app to finish loading before proceeding. This mimics true human patience.
- 🛠️ **Heuristic UI Evaluation:** The AI acts as a Senior UX/UI Engineer, grading your app against Nielsen's 10 Usability Heuristics. It outputs exact, developer-ready CSS and layout fixes (e.g., *"Increase the contrast ratio from #555 to #333"*).
- 🎥 **Live Session Replay:** Watch the AI test your app in real-time, complete with a timeline of events, network interactions, and AI "thoughts".

---

## 🏗️ System Architecture

UX-Ray operates on a continuous, multi-modal autonomous loop.

```mermaid
graph TD
    A[Start Session] --> B[Playwright Launches Sandbox]
    
    subgraph Autonomous Agent Loop
        B --> C[Extract Spatial DOM & Page State]
        C --> D{Is Page Loading?}
        D -- Yes --> E[Smart Auto-Wait]
        E --> C
        D -- No --> F[Llama 3.3 70b Decision Engine]
        
        F --> G[Infer Next Optimal Action]
        G --> H[Playwright Executor: Click/Type/Scroll]
        H --> I[Capture Screenshot & Save Event]
        I --> C
    end
    
    I -. Session Complete .-> J[Gemini Multimodal UX Audit]
    J --> K[Generate Actionable UI Checklist]
```

### AI Pipeline Details
1. **App Recognition (LLaMA-3.3):** Upon landing, it identifies your app type (e.g., SaaS, Developer Tool) to adopt the correct testing persona.
2. **Autonomous Navigation:** The agent continuously pulls the live DOM state and chooses the single best next action, keeping track of its history to prevent interaction loops.
3. **Actionable UX Audit:** Uses the captured screenshots and exact timelines to write a highly technical, bias-free UI/UX report.

---

## 💻 Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | **Next.js 14** | App Router, API Routes for SSE streaming |
| **Database** | **PostgreSQL** | Managed via Prisma ORM for session/event storage |
| **Automation** | **Playwright** | Headless browser execution and DOM spatial extraction |
| **Reasoning** | **NVIDIA Llama 3.3 70b**| Powers the deep agentic navigation and decision logic |
| **Vision** | **Google Gemini Pro**| Multimodal visual analysis for the final UX Audit report |
| **Styling** | **Tailwind CSS** | Custom highly-polished developer interface |

---

## ⚙️ Environment Variables Reference

Create a `.env` file in the root directory.

| Variable | Required | Description |
| :--- | :---: | :--- |
| `DATABASE_URL` | Yes | Connection string for your PostgreSQL database (e.g., Supabase) |
| `DIRECT_URL` | Yes | Direct connection string for Prisma migrations |
| `NVIDIA_API_KEY` | Yes | API key from NVIDIA for Llama 3.3 inference |
| `GEMINI_API_KEY` | Yes | API key from Google AI Studio for visual UX reporting |

---

## 🚀 Local Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ux-ray.git
   cd ux-ray
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize Database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

---

## 🕹️ Usage Guide

1. Enter your target URL in the main dashboard.
2. Select your personalized Developer Testing Preset (e.g., **End-to-End Journey**, **Aggressive QA Tester**, or **Conversion Flow**).
3. Watch the live **Session Explorer** as the AI isolates your site in a sandbox, reads the spatial layout, and systematically tests buttons, forms, and workflows.
4. Click **Share report to team** to distribute the actionable UX Audit directly to your engineers.

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
