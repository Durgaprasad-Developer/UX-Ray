# `execution_phases.md`

````md id="h9v2qa"
# AI User Simulator — Execution Phases

# Overview

This document defines:
- product execution phases
- implementation order
- reasoning behind each phase
- validation goals
- expected outcomes

The goal is NOT to build a perfect product immediately.

The goal is:
- build fast
- validate quickly
- observe user behavior
- iterate based on real usage

Every phase should produce:
- something usable
- something testable
- something learnable

---

# Core Development Philosophy

## Important Rule

Do NOT become emotionally attached to features.

The process is:

```txt
Build
→ Ship
→ Observe
→ Learn
→ Improve
````

If users strongly care about something:

* double down

If users ignore something:

* simplify it
* remove it
* move on

---

# Product Validation Philosophy

The real validation is NOT:

* compliments
* likes
* screenshots

The real validation is:

* repeated usage
* user retention
* founders testing multiple times
* users changing their product based on feedback

---

# PHASE 1 — Input Layer & Validation System

# Goal

Create the initial product entry point.

Users should be able to:

* paste website URL
* choose test type
* start interaction safely

---

# Why This Phase Matters

This phase defines:

* first impression
* onboarding friction
* trust
* simplicity

If this layer feels complicated:

* users leave immediately

This phase also prevents:

* malicious usage
* infrastructure abuse
* unsafe execution

---

# Features

## 1. URL Input

User submits:

* website URL

Example:

```txt id="sazdne"
https://example.com
```

---

## 2. Prompt Input

Optional instruction field.

Purpose:

* guide interaction behavior
* simulate specific scenarios

Examples:

* “Try signing up”
* “Use it like a first-time user”
* “Try buying a product”
* “Test onboarding”
* “Find confusing UX”

---

## 3. Demo Prompt Buttons

Quick-select prompts.

Examples:

* First Impression
* UX Review
* Test Signup
* Simulate Customer
* Find Friction

Purpose:

* reduce thinking friction
* improve onboarding speed
* increase successful usage

---

4. App Description Input

Users must provide a short description about the app before starting the test.

Purpose:

simulate realistic user expectations
improve interaction quality
reduce meaningless wandering
create human-like behavior
Why This Is Important

Real users rarely enter products with zero context.

Usually they already know:

what the product does
why they opened it
what they want to achieve

Without context:

the AI may behave unrealistically
onboarding feedback becomes inaccurate
interaction quality decreases
Example Inputs
This app helps recruiters analyze GitHub profiles.
This is a productivity SaaS for managing startup tasks.
Agent Behavior Rule

The AI should use the description to:

understand expected product flow
identify intended actions
evaluate whether UX matches product promise

BUT:

the AI should still critique unclear onboarding
the AI should still mention if the website fails to explain itself properly
Example

If the user provides:

This is an AI-powered interview preparation platform.

But the homepage fails to communicate that clearly,
the report should mention:

The product purpose becomes understandable after exploration,
but the homepage does not communicate the value proposition clearly to first-time visitors.
UX Goal

The AI should behave like:

a real informed first-time user

NOT:

a random crawler
a blind explorer
a QA automation script

This creates:

more realistic interaction
better feedback
stronger UX insights

# Security & Verification Layer

This is extremely important.

The browser agent must NEVER access:

* localhost
* internal IPs
* private networks
* dangerous URLs
* malicious domains

---

# URL Validation Rules

Reject:

* localhost
* 127.0.0.1
* internal IPs
* file:// protocols
* suspicious redirects

Allow only:

* public HTTPS websites

---

# Safety Goals

Prevent:

* SSRF attacks
* browser abuse
* infrastructure misuse
* unsafe execution

---

# UX Goals

The landing page should feel:

* instant
* simple
* lightweight

The user should understand the product within seconds.

---

# Validation Goals

At the end of this phase validate:

* do users understand the product quickly?
* do users know what to test?
* do users complete the flow?
* which prompts are used most?

---

# PHASE 2 — Browser Agent & Live Interaction Engine

# Goal

Build the core interaction system.

This is the heart of the product.

The AI agent should:

* open website
* interact naturally
* simulate real user behavior
* stream interaction live

---

# Why This Phase Matters

This is the “magic moment.”

The user should feel:

```txt id="yv02hb"
“Oh wow…
it’s actually using my website.”
```

This phase creates:

* engagement
* curiosity
* emotional connection
* trust

---

# Core Features

## 1. Browser Launch

The system:

* launches Playwright browser
* creates isolated session
* opens target website

---

## 2. Live Browser View

The user watches:

* mouse movement
* scrolling
* clicks
* typing
* navigation

This should feel:

* cinematic
* alive
* interactive

---

## 3. Interaction Timeline

Live thoughts shown beside interaction.

Examples:

```txt id="dzad2k"
Trying to understand the product...

The CTA is unclear...

Looking for signup flow...

Too many options visible...
```

---

# VERY IMPORTANT AGENT RULE

The AI should behave like:

> a real first-time user

NOT:

* a QA tester
* a crawler
* a developer

The interaction must feel:

* natural
* imperfect
* human

---

# Human Simulation Rules

The AI should:

* hesitate occasionally
* misunderstand unclear UX
* miss hidden CTAs
* become confused by clutter
* abandon confusing flows

This creates realistic UX feedback.

---

# CRITICAL RULE — FOLLOW CLEAR INSTRUCTIONS

The AI must understand obvious user guidance.

Example:

If the website clearly says:

* “Click Here”
* “Get Started”
* “Continue”
* “Begin”

The AI should follow that flow.

The AI should NOT:

* randomly wander
* intentionally act stupid
* ignore obvious navigation

---

# Interaction Intelligence Rules

The AI should:

* prioritize clear actions
* follow onboarding flow naturally
* attempt realistic navigation paths
* simulate human expectations

Example:

* landing page
* pricing
* signup
* onboarding
* dashboard exploration

This is how real users behave.

---

# Agent Decision Flow

```txt id="95kjep"
Observe page
↓
Understand available actions
↓
Choose most human action
↓
Execute action
↓
Reflect on experience
↓
Repeat
```

---

# Important Engineering Rule

The LLM should NOT directly control browser APIs.

Instead:

```txt id="s90g0h"
LLM decides action
Playwright executes action
```

This improves:

* stability
* debugging
* reliability

---

# Validation Goals

At the end of this phase validate:

* does the interaction feel realistic?
* do users enjoy watching replay?
* do users trust the system?
* does the AI behave naturally?
* does the AI follow obvious flows correctly?

---

# PHASE 3 — UX Review & Report Generation

# Goal

Generate useful, realistic, actionable UX feedback.

NOT fake AI reports.

---

# Why This Phase Matters

Most AI products fail here.

They generate:

* generic feedback
* fake insights
* meaningless scores
* obvious suggestions

This product must feel:

* observant
* realistic
* human
* genuinely useful

---

# Important Product Rule

The report should feel like:

> an experienced builder reviewing your product

NOT:

* a robotic analyzer
* an SEO checker
* an AI buzzword machine

---

# Input Sources For Report

The report model should analyze:

* screenshots
* interaction history
* clicks
* hesitation points
* abandoned flows
* navigation behavior
* confusion moments
* onboarding friction

---

# Report Goals

The report should answer:

* what worked well?
* where users struggled?
* what caused confusion?
* what felt smooth?
* what felt overwhelming?
* what likely causes drop-offs?

---

# Real UX Understanding

The report should understand:

* onboarding flow
* navigation clarity
* visual hierarchy
* CTA visibility
* cognitive load
* interaction friction

The AI should explain:

* WHY users may struggle
* not just WHAT happened

---

# Example Good Feedback

Good feedback:

```txt id="v21et0"
The landing page looks modern,
but the product value proposition is unclear in the first few seconds.
```

Good feedback:

```txt id="gg2c2g"
The signup flow asks for too much information too early,
which may reduce onboarding completion.
```

---

# Example BAD Feedback

Avoid fake generic feedback like:

```txt id="jw3q6u"
Improve user experience for better engagement.
```

This provides no value.

---

# User Psychology Simulation

The report should simulate:

* emotional response
* user mindset
* first impression

Examples:

```txt id="z2zvf9"
The product initially feels technically impressive,
but slightly overwhelming for first-time users.
```

---

# Different User Perspectives

The system should eventually support:

* founder perspective
* customer perspective
* impatient user perspective
* investor perspective
* beginner user perspective

But initially:

* first-time user simulation only

---

# Important Product Insight System

The AI should identify:

* unexpected user behavior
* emerging usage patterns
* repeated interaction flows

Example:

GitHub X-Ray insight:
Users originally came for GitHub understanding,
but started using it for comparison.

That insight revealed:

> comparison feature demand

This same behavioral observation system should exist here.

---

# Product Learning Layer

The platform should observe:

* what flows users repeatedly test
* what frustrations appear often
* what prompts are common
* what pages users care about most

This helps discover:

* future features
* real user needs
* product direction

---

# Final Report Structure

## 1. Overall Experience

Short human summary.

---

## 2. What Worked Well

Positive UX observations.

---

## 3. Friction Points

Areas causing confusion or hesitation.

---

## 4. Timeline Replay

Chronological interaction summary.

---

## 5. Top Improvements

Most impactful fixes.

---

# Important Report Design Rule

Reports should be:

* concise
* readable
* actionable

Avoid:

* giant reports
* enterprise PDFs
* fake scoring systems

---

# Validation Goals

At the end of this phase validate:

* do users find feedback useful?
* do users improve their websites?
* do users retest after changes?
* do users trust the insights?
* are reports specific and realistic?

---

# PHASE 4 — Replay System & Experience Refinement

# Goal

Make the interaction replay addictive and insightful.

---

# Features

## 1. Replay Timeline

Users can:

* replay sessions
* revisit interaction moments
* inspect confusion points

---

## 2. Visual Event Tracking

Display:

* click points
* hesitation moments
* navigation patterns

---

## 3. Emotional Interaction Layer

Display:

* curiosity
* confusion
* frustration
* confidence

during flows.

---

# Why This Matters

The replay experience creates:

* emotional understanding
* stronger product connection
* memorable experience

This becomes one of the strongest retention drivers.

---

# Validation Goals

At the end validate:

* do users rewatch sessions?
* do users share sessions with teammates?
* do users discover UX problems themselves?

---

# PHASE 5 — Product Learning & Iteration Layer

# Goal

Learn from user behavior and improve product direction.

---

# Core Principle

Users reveal product direction through behavior.

Not through surveys.

---

# Things To Observe

## Prompt Patterns

Example:

* many users testing onboarding

Insight:

* onboarding analysis valuable

---

## Interaction Patterns

Example:

* many users repeatedly checking pricing flow

Insight:

* pricing UX important

---

## Replay Usage

Example:

* users replay confusion moments repeatedly

Insight:

* replay system highly valuable

---

# Feature Discovery Engine

Observe:

* repeated usage patterns
* common workflows
* common frustrations

Then:

* build features based on observed demand

NOT assumptions.

---

# Important Philosophy

The product evolves from:

* real user behavior
* repeated interactions
* validated demand

NOT:

* founder assumptions
* feature excitement
* AI hype

---

# Long-Term Vision

Eventually the platform can evolve into:

* AI product usability testing
* onboarding optimization engine
* conversion flow simulator
* customer journey analysis platform

here is the api key for the gemini : <REDACTED>

Hugging face token for free models : <REDACTED>

open router api key for all the fall backs : <REDACTED>

But initially:

> focus on one useful experience done extremely well

That experience is:

```txt id="y4j3u3"
Watching AI behave like a real first-time user on your website.
```

```
```
