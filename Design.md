# `design.md`

````md id="m3f0na"
# AI User Simulator — System Design & Architecture

# Overview

AI User Simulator is a browser interaction platform that simulates how a real first-time user experiences a website.

The system is designed around:
- modular architecture
- rapid iteration
- scalability
- low operational complexity
- future extensibility

The product must initially optimize for:
- fast shipping
- useful feedback
- smooth interaction replay
- simple architecture

The architecture should avoid:
- premature microservices
- over-engineering
- unnecessary abstractions

The system should remain:
- developer-friendly
- highly modular
- easy to iterate rapidly

---

# Core Architecture Philosophy

## 1. Simple First, Scalable Later

The architecture should:
- work well as a small product
- scale incrementally
- avoid massive rewrites later

Initial architecture:
- modular monolith

Future architecture:
- service separation only when needed

---

## 2. Two-Model Architecture

The platform uses two separate AI systems:

---

## Model 1 — Interaction Agent

Purpose:
- interact with website
- simulate user behavior
- decide next actions

Responsibilities:
- click buttons
- fill forms
- scroll pages
- navigate website
- explore flows
- generate interaction reasoning

Characteristics:
- fast
- cheap
- iterative
- action-oriented

Preferred models:
- Qwen
- DeepSeek
- Llama
- small open-source reasoning models

This model should optimize for:
- speed
- cost efficiency
- interaction continuity

---

## Model 2 — Report Generator

Purpose:
- analyze interaction history
- analyze screenshots
- generate UX insights
- summarize friction points
- create actionable reports

Responsibilities:
- UX review
- onboarding analysis
- friction analysis
- usability explanation
- timeline generation
- improvement suggestions

Preferred model:
- Gemini 2.5 Flash / Pro

This model should optimize for:
- reasoning quality
- multimodal understanding
- structured output
- human-like feedback

---

# High-Level System Architecture

```txt
Frontend (Next.js)
↓
API Gateway Layer
↓
Session Manager
↓
Browser Interaction Engine (Playwright)
↓
Interaction Agent Model
↓
Event + Screenshot Storage
↓
Report Generator Model
↓
Frontend Replay + Report UI
````

---

# Core System Components

# 1. Frontend Application

## Stack

* Next.js
* React
* TailwindCSS
* shadcn/ui
* Framer Motion

---

## Responsibilities

Frontend handles:

* URL submission
* prompt selection
* live interaction display
* replay timeline
* report rendering
* loading states
* interaction visualization

---

## Frontend Principles

The frontend should feel:

* alive
* interactive
* cinematic
* minimal
* modern

NOT:

* dashboard-heavy
* enterprise-style
* analytics-focused

---

# 2. API Layer

## Purpose

Acts as orchestration layer between:

* frontend
* browser engine
* models
* storage

---

## Responsibilities

* create sessions
* start browser agents
* stream interaction updates
* store logs
* trigger report generation
* return replay data

---

## Suggested Structure

```txt
/app/api
    /session
    /run
    /report
    /replay
```

---

# 3. Browser Interaction Engine

## Technology

* Playwright

---

## Purpose

Responsible for:

* browser control
* page navigation
* screenshots
* DOM extraction
* interaction execution

---

## Browser Context Rules

Each session must:

* run isolated
* use separate context
* avoid leaking cookies/sessions

---

## Interaction Cycle

```txt
Observe page
↓
Extract interactive elements
↓
Build simplified page context
↓
Send to interaction model
↓
Receive next action
↓
Execute action
↓
Capture screenshot + logs
↓
Repeat
```

---

# 4. Interaction Agent Layer

## Purpose

Acts as simulated user brain.

This layer decides:

* what to click
* what feels confusing
* where to navigate
* what action to try next

---

## Important Design Rule

The model should NOT directly control raw browser APIs.

Instead:

```txt
Playwright = executor
LLM = decision maker
```

---

# Recommended Interaction Abstraction

Instead of exposing:

* raw DOM
* full HTML
* massive token contexts

Create simplified interaction objects.

Example:

```json
[
  {
    "id": 1,
    "type": "button",
    "text": "Get Started",
    "position": "top-right"
  },
  {
    "id": 2,
    "type": "input",
    "placeholder": "Email"
  }
]
```

This reduces:

* token cost
* hallucinations
* instability

---

# Interaction Agent Prompting

The model prompt should enforce:

```txt
You are a first-time user exploring a website.

Your goal:
- understand the product
- attempt onboarding
- identify confusing experiences
- behave naturally

You are NOT a QA tester.
You are NOT a developer.
You are an impatient first-time user.
```

---

# 5. Event Logging System

## Purpose

Every interaction must be logged.

---

## Events To Store

* page visited
* button clicked
* text entered
* hesitation moments
* reasoning
* screenshots
* timestamps
* errors

---

## Event Object Example

```json
{
  "timestamp": 12,
  "action": "click",
  "target": "Get Started",
  "reasoning": "Trying to begin onboarding flow"
}
```

---

# 6. Screenshot Pipeline

## Purpose

Visual replay and report analysis.

---

## Screenshots Required

Capture:

* initial landing page
* post interaction states
* errors
* onboarding pages
* final state

---

## Screenshot Strategy

Avoid:

* screenshot every millisecond

Instead:

* event-based screenshots

Capture after:

* clicks
* navigation
* forms
* scroll milestones

---

# 7. Report Generation Engine

## Input Sources

The report model receives:

* interaction timeline
* screenshots
* interaction reasoning
* page metadata
* friction events

---

## Responsibilities

Generate:

* UX summary
* friction analysis
* emotional interpretation
* onboarding feedback
* actionable improvements

---

# Report Structure

## Sections

1. Overall Experience
2. What Worked Well
3. Friction Points
4. Timeline Analysis
5. Top Improvements

---

## Important Rule

Reports must:

* feel human
* stay concise
* avoid fake AI jargon

---

# Database Design

# Initial MVP

Use:

* PostgreSQL

Optional:

* Supabase

---

# Core Tables

## sessions

```txt
id
url
prompt
status
created_at
completed_at
```

---

## interaction_events

```txt
id
session_id
timestamp
action
target
reasoning
screenshot_url
```

---

## reports

```txt
id
session_id
summary
friction_points
improvements
created_at
```

---

# Real-Time Architecture

## Recommended

Use:

* WebSockets
  or
* Server-Sent Events (SSE)

---

## Purpose

Stream:

* live browser state
* interaction thoughts
* replay events
* progress updates

This creates:

* engagement
* trust
* interactivity

---

# Replay System Design

The replay system is one of the most important features.

---

# Replay Components

## 1. Timeline

Displays:

* chronological events
* timestamps
* observations

---

## 2. Visual Replay

Displays:

* screenshots
* interactions
* navigation progression

---

## 3. Interaction Thoughts

Displays:

* AI reasoning
* confusion
* expectations
* frustrations

---

# Future Scalability Design

# Scaling Strategy

Scale only after:

* validated demand
* real usage
* clear bottlenecks

---

# Potential Future Services

Possible future separation:

```txt
Frontend Service
Interaction Service
Replay Service
Report Service
Analytics Service
```

But initially:

* keep monolithic

---

# Queue System (Future)

As traffic grows:

Use:

* Redis + BullMQ

For:

* browser job queues
* report generation queues
* screenshot processing

---

# Browser Scaling Strategy

Browser automation is expensive.

Future scaling:

* browser pooling
* browser workers
* distributed Playwright nodes

Possible future tools:

* Browserless
* Playwright Cluster

---

# AI Cost Optimization

# Important Design Principle

Use expensive models ONLY where necessary.

---

## Cheap Models

Use for:

* navigation
* clicking
* exploration
* interaction loops

---

## Expensive Models

Use for:

* final report generation
* multimodal reasoning
* screenshot analysis

This architecture significantly reduces costs.

---

# Security Design

## Restrictions

Prevent:

* localhost access
* internal network access
* malicious URLs
* SSRF attacks

---

## Browser Isolation

Each browser context must:

* remain isolated
* clear cookies/session
* terminate cleanly

---

# UI/UX Design System

# Design Language

The interface should feel:

* futuristic
* minimal
* fluid
* cinematic
* premium

Inspired by:

* Vercel
* Linear
* Perplexity
* modern AI products

---

# Theme

## Primary Theme

* dark mode first

---

# Colors

## Background

```txt
#09090B
```

---

## Primary Accent

```txt
#7C3AED
```

Purple/violet accent for:

* actions
* highlights
* interaction glow

---

## Secondary Accent

```txt
#06B6D4
```

Cyan accent for:

* active states
* live interactions

---

## Text

Primary:

```txt
#FAFAFA
```

Secondary:

```txt
#A1A1AA
```

---

# Typography

Recommended:

* Inter
* Geist
* Satoshi

---

# UI Feel

The UI should feel:

* smooth
* reactive
* lightweight

Animations:

* subtle
* fast
* meaningful

Avoid:

* flashy effects
* excessive motion
* heavy gradients

---

# Main Screens

# 1. Landing Screen

Contains:

* hero text
* URL input
* quick prompts
* CTA button

Minimal layout.

---

# 2. Live Interaction Screen

Split layout:

* browser replay
* interaction timeline

This is the main product experience.

---

# 3. Report Screen

Contains:

* summary
* friction points
* improvements
* replay timeline

---

# Engineering Rules

## 1. Build Modularly

Every major feature should be isolated.

Example:

* replay module
* report module
* interaction module

---

## 2. Avoid Premature Complexity

Do NOT:

* microservice too early
* optimize too early
* abstract unnecessarily

---

## 3. Prioritize Shipping

The architecture exists to:

* support iteration
* support speed
* support learning

Not to appear technically impressive.

---

# Product Success Philosophy

The real success metric is:

* repeated usage
* builders testing repeatedly
* founders improving UX based on reports

NOT:

* vanity metrics
* AI complexity
* feature count

---

# Final Product Identity

This product is NOT:

* a static analyzer
* an SEO checker
* an enterprise UX suite

This product IS:

```txt
An AI-powered first-time user simulator.
```

The replay experience is the product.

The report is secondary.

The emotional realization:

> “Users probably struggle here too.”
> is the core value delivered.

```
```
