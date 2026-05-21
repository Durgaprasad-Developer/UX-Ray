# `rules.md`

````md id="7sq8w1"
# AI User Simulator — Development Rules

# Purpose

This document defines the core engineering, product, and implementation rules for the project.

These rules exist to:
- prevent hallucinated architecture
- avoid fake implementations
- maintain realistic UX behavior
- ensure production-quality engineering
- keep development scalable and maintainable

Every implementation decision should follow these rules.

---

# CORE PRODUCT RULES

# 1. The Product Must Feel Real

The AI interaction must feel like:
> a real first-time human user

NOT:
- a crawler
- a QA automation script
- a random click bot
- an intentionally confused AI

---

# 2. The Product Must Deliver Real UX Insights

The report must:
- identify actual friction
- explain realistic confusion
- describe onboarding pain points
- provide actionable improvements

Avoid:
- fake AI-generated fluff
- meaningless scoring systems
- generic advice

---

# 3. The AI Must Follow Obvious Human Flows

If a website clearly guides the user:
- “Get Started”
- “Continue”
- “Sign Up”
- “Next”

the AI should follow those flows naturally.

The AI should NOT:
- intentionally wander
- ignore obvious CTAs
- behave irrationally
- create fake friction

---

# 4. Context-Aware Interaction Is Mandatory

Every test session MUST include:
- website URL
- app description
- optional test prompt

The app description helps simulate:
- realistic expectations
- natural interaction
- human-like understanding

Without context:
- interaction quality decreases
- UX feedback becomes unrealistic

---

# ENGINEERING RULES

# 5. Never Hardcode Dynamic Results

NEVER:
- hardcode reports
- hardcode interaction outputs
- fake screenshots
- fake timelines
- fake UX analysis

Everything shown to users must come from:
- real browser interaction
- real screenshots
- actual event logs
- actual AI analysis

---

# 6. Never Fake AI Behavior

The AI must NOT:
- pretend to analyze pages it never visited
- generate flows it never interacted with
- mention buttons it never saw
- hallucinate navigation paths

All reports must be grounded in:
- interaction history
- screenshots
- visited pages
- event logs

---

# 7. All Browser Actions Must Be Logged

Every browser action must generate logs.

This is mandatory.

---

# Required Logs

The system must log:
- browser launch
- page navigation
- clicks
- typing
- scrolling
- screenshots
- model decisions
- reasoning
- errors
- retries
- report generation steps

---

# Example Interaction Log

```json id="1i9c6o"
{
  "timestamp": "12:01:22",
  "action": "click",
  "target": "Get Started",
  "reasoning": "Attempting onboarding flow"
}
````

---

# 8. Development Logs Are Mandatory

The backend must provide detailed developer logs.

Purpose:

* debugging
* observability
* replay debugging
* error tracing
* interaction understanding

---

# Development Logging Requirements

Log:

* API execution
* browser lifecycle
* model prompts
* model responses
* interaction cycles
* screenshot generation
* failed selectors
* retries
* timeout issues
* parsing issues

---

# Log Structure Rules

Logs should be:

* structured
* readable
* timestamped
* searchable

Preferred format:

* JSON logs

---

# Example Developer Log

```json id="2d6krq"
{
  "service": "interaction-agent",
  "event": "selector_not_found",
  "selector": ".signup-btn",
  "timestamp": "2026-05-21T10:22:12Z"
}
```

---

# 9. User-Facing Errors Must Exist

If something fails,
the user should NEVER see:

* blank screen
* frozen UI
* silent failure

The UI must gracefully explain:

* what failed
* why it failed
* what user can do next

---

# Example User Errors

Good:

```txt id="r4y93y"
The website blocked automated interaction.
```

Good:

```txt id="m3ul4r"
The page took too long to load.
```

Good:

```txt id="q3x90p"
Unable to complete signup flow because required fields were missing.
```

Bad:

```txt id="yzk5ly"
Unknown error.
```

---

# 10. Error Logging Is Mandatory

Every error must:

* be logged
* contain context
* contain stack trace
* contain session reference

---

# Required Error Context

Errors should include:

* session ID
* current page URL
* last interaction
* model state
* timestamp

---

# AI MODEL RULES

# 11. Separate Interaction Model & Report Model

Two models must remain separated.

---

# Interaction Model

Responsibilities:

* deciding actions
* navigation
* exploration
* interaction reasoning

Must optimize for:

* speed
* cost
* responsiveness

---

# Report Model

Responsibilities:

* UX analysis
* multimodal reasoning
* friction analysis
* report generation

Must optimize for:

* quality
* reasoning depth
* structured insights

---

# 12. The LLM Must NOT Directly Control Browser APIs

The architecture must follow:

```txt id="95ytff"
LLM → decides action
Playwright → executes action
```

Never:

* expose raw browser execution to LLM
* allow unrestricted browser commands

This improves:

* stability
* debugging
* predictability
* security

---

# 13. Simplified Interaction Context Only

Do NOT send:

* full HTML pages
* massive DOM trees
* unnecessary tokens

Instead provide:

* simplified interactable elements
* visible text
* important buttons
* forms
* navigation items

This improves:

* speed
* reliability
* cost efficiency

---

# UX RULES

# 14. The Product Should Feel Fast

Avoid:

* long loading screens
* unnecessary waiting
* blocking interfaces

Users should quickly see:

* browser launch
* live interaction
* progress updates

---

# 15. Replay Experience Is Core Product

The replay system is NOT optional.

The replay experience is:

* the emotional hook
* the trust layer
* the engagement engine

Users should always understand:

> what the AI is doing right now

---

# 16. Reports Must Stay Concise

Avoid:

* giant enterprise reports
* excessive analytics
* fake complexity

Reports should focus on:

* usability
* friction
* onboarding clarity
* actionable improvements

---

# SECURITY RULES

# 17. Block Unsafe URLs

The system must reject:

* localhost
* private IPs
* internal networks
* file:// URLs
* malicious redirects

Only allow:

* public websites

---

# 18. Browser Sessions Must Be Isolated

Each session must:

* run independently
* clear cookies
* clear local storage
* terminate properly

Prevent:

* session leaks
* data contamination

---

# 19. Rate Limiting Is Required

Prevent:

* browser abuse
* spam sessions
* infrastructure overload

Implement:

* IP-based rate limiting
* request throttling

---

# ARCHITECTURE RULES

# 20. Build Modularly

Major systems should remain isolated.

Recommended modules:

* interaction engine
* replay engine
* report engine
* storage layer
* API layer

---

# 21. Avoid Premature Microservices

Initially:

* modular monolith only

Do NOT:

* split services early
* over-engineer deployment
* create unnecessary infra

Scale only after:

* validated demand
* real traffic
* clear bottlenecks

---

# 22. Optimize For Iteration Speed

The architecture should help:

* rapid experimentation
* feature iteration
* debugging
* shipping quickly

NOT:

* resume-driven engineering
* over-abstracted systems

---

# PRODUCT LEARNING RULES

# 23. Observe User Behavior

Users reveal product direction through:

* repeated actions
* common prompts
* replay usage
* feature requests
* testing patterns

This data is extremely valuable.

---

# 24. Product Decisions Must Be Behavior-Driven

Build features only after observing:

* repeated demand
* repeated workflows
* real usage patterns

Avoid:

* assumption-based development
* random feature additions

---

# 25. Do NOT Become Emotionally Attached To Features

Every feature is temporary until validated.

If users do not care:

* simplify it
* remove it
* replace it

The goal is:

* usefulness
* retention
* repeated usage

NOT:

* feature count
* complexity
* engineering ego

---

# DEVELOPMENT PRINCIPLES

# 26. Build → Ship → Learn

The development loop is:

```txt id="d7bdfx"
Build
↓
Ship
↓
Observe
↓
Learn
↓
Improve
```

This loop should guide all product decisions.

---

# 27. The Product Must Stay Useful

The product should always answer:

```txt id="1u2ev8"
“Does this genuinely help builders improve their product?”
```

If not:

* rethink the feature
* simplify the implementation
* remove unnecessary complexity

---

# FINAL PRODUCT IDENTITY

This product is NOT:

* an SEO checker
* an analytics dashboard
* an enterprise UX suite
* an AI gimmick

This product IS:

```txt id="r2d2x9"
An AI-powered first-time user simulator that helps builders understand how real users experience their website.
```

The replay experience is the product.

The report supports the replay.

The emotional realization:

> “Users probably struggle here too.”
> is the core value delivered.

```
```
