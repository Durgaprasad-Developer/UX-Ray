# ⚡ UX-Ray

![UX-Ray Banner](https://via.placeholder.com/1200x400/09090b/a855f7?text=UX-Ray+-+Automated+AI+User+Testing)

**UX-Ray** is an autonomous AI agent designed for startups and indie builders. It acts as a simulation of 1,000 real first-time users, intelligently navigating your web application to identify UX friction, discover behavior patterns, and generate developer-ready actionable checklists before you launch.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Browser_Automation-2EAD33?style=flat&logo=playwright)](https://playwright.dev/)
[![LLaMA 3.3](https://img.shields.io/badge/Powered_by-LLaMA_3.3_70B-blue?style=flat&logo=meta)](https://ai.meta.com/llama/)
[![Gemini](https://img.shields.io/badge/Multimodal-Gemini_Pro-orange?style=flat&logo=google)](https://deepmind.google/technologies/gemini/)

## ✨ Features

- 🧠 **Senior QA Algorithmic Explorer:** UX-Ray is prompted with strict algorithmic rules. It deduces visual hierarchy based on button sizes (width/height), explicitly tests edge cases, and maps out core workflows without getting stuck in loops.
- 👁️ **Spatial & Semantic Awareness:** The internal Playwright engine extracts rich DOM metadata including `width`, `height`, `disabled` states, `aria-labels`, and `hrefs`. This gives the AI true "sight" of your app to understand exactly what each button does.
- ⏳ **Smart Auto-Wait:** Built directly into the execution engine, the AI automatically detects active spinners or loading text and waits for your app to finish loading before proceeding. This mimics true human patience and prevents false "bug" reports.
- 🛠️ **Heuristic UI Evaluation:** The AI acts as a Senior UX/UI Engineer, grading your app against Nielsen's 10 Usability Heuristics. Instead of generic advice, it outputs exact, developer-ready CSS and layout fixes (e.g., *"Increase the contrast ratio from #555 to #333"*).
- 🚀 **Built-in Session Replay:** Watch the AI test your app in real-time, complete with a timeline of events, network interactions, and AI "thoughts".

## 🏗️ Architecture

UX-Ray operates on a multi-modal AI architecture:
1. **App Recognition (LLaMA-3.3):** Upon landing, it identifies your app type (e.g., SaaS, Portfolio, Developer Tool) to adopt the correct testing persona.
2. **Autonomous Navigation (Playwright + LLaMA-3.3):** Instead of a static queue, the agent continuously pulls the live DOM state (including spatial data) and chooses the single best next action (Click, Type, Wait, Scroll).
3. **Actionable UX Audit (Gemini Multimodal):** Uses screenshots and action timelines to write a highly technical, developer-ready UI/UX report.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Chromium (installed automatically by Playwright)
- NVIDIA API Key (for LLaMA-3.3 70b inference)
- Google Gemini API Key (for Multimodal UX reporting)
- Supabase (PostgreSQL Database)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ux-ray.git
   cd ux-ray
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="your-supabase-connection-string"
   DIRECT_URL="your-supabase-direct-connection-string"
   NVIDIA_API_KEY="nvapi-your-key-here"
   GEMINI_API_KEY="AIzaSy-your-key-here"
   ```

4. **Initialize Database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

## 🕹️ How to Use

1. Enter the target URL in the main dashboard.
2. Provide context about your app or credentials for login flows.
3. Watch the live **Session Explorer** as the AI isolates your site in a sandbox, reads the spatial layout, and systematically tests buttons, forms, and workflows.
4. Click **Share report to team** to distribute the actionable UX Audit directly to your engineers.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.
