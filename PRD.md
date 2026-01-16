# Product Requirements Document: Browser Agent with Self-Healing

**Project:** SentinelBrowser
**Version:** 1.0
**Date:** 2026-01-15
**Author:** Adam (via AdamOS)
**Status:** Draft

---

## Executive Summary

SentinelBrowser is an AI-powered browser automation agent built with TypeScript, Bun, and LangGraph.js. It autonomously navigates websites, executes multi-step tasks, and self-heals when encountering errors through vision-based element re-detection and intelligent retry strategies.

---

## Problem Statement

### The Problem

Current browser automation solutions suffer from three critical failures:

1. **Brittleness**: Traditional selectors (XPath, CSS) break when websites update their UI
2. **No Recovery**: When automation fails, it stops completely with no self-correction
3. **Blind Execution**: Scripts execute without understanding page context or state

### Who Experiences This Problem

- **Developers** building web scrapers that break constantly
- **QA Engineers** maintaining flaky end-to-end tests
- **Business Users** running RPA workflows that fail silently
- **AI Engineers** building agents that need reliable web interaction

### Impact

- 40%+ of RPA workflows require weekly maintenance (Forrester 2025)
- E2E test suites have 15-30% flaky test rates (Google Testing Blog)
- Browser automation failure costs enterprises $4.2B annually in maintenance

---

## Target User

**Primary Persona: AI Engineer building agentic applications**

| Attribute | Value |
|-----------|-------|
| Role | AI/ML Engineer, Full-Stack Developer |
| Experience | 2-5 years |
| Pain Point | Needs reliable browser automation for agent workflows |
| Tech Stack | TypeScript, Node.js/Bun, familiar with LLMs |
| Success Metric | Automation completes without manual intervention |

**Secondary Persona: QA Automation Engineer**

| Attribute | Value |
|-----------|-------|
| Role | QA Engineer, SDET |
| Pain Point | Flaky tests, constant selector maintenance |
| Success Metric | Test stability > 95% |

---

## Functional Requirements

### Epic 1: Core Browser Automation

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| US-1.1 | As a user, I can navigate to any URL and wait for page load | P0 | Page loads within 30s timeout, returns success/failure |
| US-1.2 | As a user, I can click elements by natural language description | P0 | "Click the blue Submit button" resolves and clicks correctly |
| US-1.3 | As a user, I can fill form fields by natural language | P0 | "Enter 'john@email.com' in the email field" works |
| US-1.4 | As a user, I can extract data from pages | P0 | Returns structured JSON from page content |
| US-1.5 | As a user, I can take screenshots at any point | P1 | PNG screenshot saved to specified path |
| US-1.6 | As a user, I can execute multi-step task sequences | P0 | Chain of actions executes in order |

### Epic 2: Self-Healing & Recovery

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| US-2.1 | As a user, when a click fails, the agent retries with vision-based re-detection | P0 | Agent takes screenshot, uses vision LLM to find element, retries |
| US-2.2 | As a user, I can configure retry strategies (count, backoff) | P1 | Configurable retries: 1-5, backoff: linear/exponential |
| US-2.3 | As a user, the agent recovers from navigation errors | P0 | 404, timeout, crash → agent attempts recovery |
| US-2.4 | As a user, I see detailed logs of healing attempts | P1 | Logs show: original failure, detection attempt, retry result |
| US-2.5 | As a user, the agent detects and handles popups/modals | P1 | Cookie banners, modals dismissed automatically |

### Epic 3: State Machine Orchestration

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| US-3.1 | As a user, I can define workflows as state graphs | P0 | LangGraph.js StateGraph defines workflow |
| US-3.2 | As a user, workflow state persists across steps | P0 | State object passed between nodes |
| US-3.3 | As a user, I can add conditional branching | P1 | If/else routing based on page state |
| US-3.4 | As a user, I can define human-in-the-loop checkpoints | P2 | Workflow pauses for user confirmation |

### Epic 4: Evaluation & Observability

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| US-4.1 | As a user, I can run evaluation suites against the agent | P0 | Eval framework executes test scenarios |
| US-4.2 | As a user, I see pass@k metrics for reliability | P0 | pass@1, pass@3, pass@5 calculated |
| US-4.3 | As a user, I get detailed execution traces | P1 | Each step logged with timing, screenshots |
| US-4.4 | As a user, I can export evaluation reports | P1 | JSON/Markdown report generated |

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SentinelBrowser                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   CLI/API    │───▶│  Orchestrator │───▶│   LangGraph.js       │  │
│  │   Interface  │    │   (Bun)       │    │   State Machine      │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                              │                       │               │
│                              ▼                       ▼               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      Agent Nodes                               │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │  │
│  │  │Navigate │  │  Click  │  │  Fill   │  │    Extract      │  │  │
│  │  │  Node   │  │  Node   │  │  Node   │  │     Node        │  │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────────┬────────┘  │  │
│  │       │            │            │                 │           │  │
│  │       └────────────┴────────────┴─────────────────┘           │  │
│  │                            │                                   │  │
│  └────────────────────────────┼───────────────────────────────────┘  │
│                               ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Self-Healing Layer                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │  │
│  │  │  Screenshot │  │ Vision LLM  │  │   Retry Strategy    │   │  │
│  │  │   Capture   │──▶│  Analysis   │──▶│   (Exponential)    │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                               │                                      │
│                               ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Browser Engine                              │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │              Playwright (Chromium)                       │  │  │
│  │  │   • Page Management  • Element Interaction  • Network    │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        External Services                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │
│  │   Claude    │  │  OpenRouter │  │      Target Websites         │ │
│  │   API       │  │   (backup)  │  │                              │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────┐     ┌───────────┐     ┌──────────┐     ┌─────────┐
│  User   │────▶│   Task    │────▶│  State   │────▶│ Browser │
│ Request │     │  Parser   │     │  Graph   │     │ Action  │
└─────────┘     └───────────┘     └──────────┘     └────┬────┘
                                                        │
                    ┌───────────────────────────────────┘
                    │
                    ▼
            ┌───────────────┐     ┌──────────────┐
            │    Success?   │─No─▶│ Self-Healing │
            └───────┬───────┘     └──────┬───────┘
                    │                     │
                   Yes                    │
                    │                     │
                    ▼                     ▼
            ┌───────────────┐     ┌──────────────┐
            │ Update State  │◀────│ Retry Action │
            └───────────────┘     └──────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Runtime | Bun | Fast startup, native TypeScript, Adam's standard |
| Language | TypeScript | Type safety, Adam's preference |
| Agent Framework | LangGraph.js | State machine orchestration, production-grade |
| Browser Engine | Playwright | Best-in-class browser automation, Chromium support |
| Vision LLM | Claude claude-sonnet-4-20250514 | Fast, accurate vision analysis for element detection |
| Primary LLM | Claude Opus 4.5 | Complex reasoning for task planning |
| Testing | Bun test | Native Bun testing framework |

### Directory Structure

```
browser-agent-self-healing/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── agent/
│   │   ├── graph.ts          # LangGraph state machine definition
│   │   ├── state.ts          # State type definitions
│   │   └── nodes/
│   │       ├── navigate.ts   # Navigation node
│   │       ├── click.ts      # Click with self-healing
│   │       ├── fill.ts       # Form filling node
│   │       ├── extract.ts    # Data extraction node
│   │       └── heal.ts       # Self-healing logic
│   ├── browser/
│   │   ├── client.ts         # Playwright wrapper
│   │   ├── screenshot.ts     # Screenshot utilities
│   │   └── selectors.ts      # Element resolution
│   ├── llm/
│   │   ├── client.ts         # LLM client abstraction
│   │   ├── vision.ts         # Vision analysis prompts
│   │   └── planner.ts        # Task planning prompts
│   ├── eval/
│   │   ├── runner.ts         # Evaluation executor
│   │   ├── graders.ts        # Success/failure graders
│   │   ├── metrics.ts        # pass@k calculation
│   │   └── scenarios/        # Test scenarios
│   └── types/
│       └── index.ts          # Shared type definitions
├── tests/
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
├── evals/
│   └── scenarios/            # Evaluation scenario definitions
├── PRD.md                    # This document
├── package.json
├── tsconfig.json
├── bunfig.toml
└── README.md
```

---

## API Specification

### CLI Interface

```bash
# Execute a single task
sentinel run "Go to amazon.com and search for 'mechanical keyboard'"

# Execute from task file
sentinel run --file tasks/amazon-search.yaml

# Run with specific config
sentinel run "..." --retries 3 --timeout 60000 --headless

# Run evaluation suite
sentinel eval --suite evals/scenarios/e-commerce.yaml

# Generate evaluation report
sentinel eval --report markdown --output reports/eval-2026-01-15.md
```

### Programmatic API

```typescript
import { SentinelBrowser } from 'sentinel-browser';

// Initialize agent
const agent = new SentinelBrowser({
  headless: true,
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  healing: {
    enabled: true,
    maxRetries: 3,
    backoff: 'exponential',
  },
});

// Execute task
const result = await agent.run({
  task: 'Search for "laptop" on amazon.com and extract the first 5 product titles',
  timeout: 60000,
});

// Result structure
interface TaskResult {
  success: boolean;
  data?: Record<string, unknown>;
  steps: StepLog[];
  healingAttempts: HealingLog[];
  duration: number;
  screenshots: string[];
}
```

### State Schema

```typescript
interface BrowserAgentState {
  // Task context
  task: string;
  currentStep: number;
  totalSteps: number;

  // Browser state
  url: string;
  pageTitle: string;
  pageContent: string;
  screenshot: string; // base64

  // Execution state
  actions: Action[];
  results: StepResult[];

  // Healing state
  lastError: Error | null;
  healingAttempts: number;
  healingHistory: HealingAttempt[];

  // Output
  extractedData: Record<string, unknown>;
  finalResult: TaskResult | null;
}
```

---

## Success Metrics

### Quantitative Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Task Completion Rate** | > 85% | Successful task completions / Total attempts |
| **Self-Healing Success** | > 70% | Healed failures / Total failures |
| **pass@1** | > 75% | First-attempt success rate |
| **pass@3** | > 90% | Success within 3 attempts |
| **Latency (simple task)** | < 10s | Time from request to completion |
| **Latency (complex task)** | < 60s | Multi-step workflow completion |

### Evaluation Scenarios

| Scenario | Description | Success Criteria |
|----------|-------------|------------------|
| E-commerce Search | Search product on Amazon/eBay | Returns 5+ product titles |
| Form Submission | Fill and submit contact form | Form submitted, confirmation shown |
| Login Flow | Authenticate with credentials | Dashboard/home page reached |
| Data Extraction | Scrape structured data from table | JSON matches expected schema |
| Navigation Chain | Multi-page navigation sequence | All pages visited in order |
| Error Recovery | Handle 404, popup, timeout | Task completes despite errors |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Website blocks automation** | Medium | High | Implement stealth mode, respect robots.txt |
| **Vision LLM misidentifies elements** | Medium | Medium | Confidence thresholds, fallback selectors |
| **Rate limiting by LLM provider** | Low | Medium | Request batching, caching, fallback models |
| **Playwright version incompatibility** | Low | Medium | Pin versions, CI testing |
| **Complex dynamic pages fail** | Medium | Medium | Wait strategies, mutation observers |
| **CAPTCHA blocking** | High | High | Detect and report, human escalation option |

---

## Out of Scope (v1.0)

- Multi-browser support (Firefox, Safari) - Chromium only
- Distributed execution across machines
- Built-in proxy rotation
- CAPTCHA solving
- Mobile browser emulation
- Video recording of sessions

---

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `@langchain/langgraph` | ^0.2.x | State machine orchestration |
| `playwright` | ^1.50.x | Browser automation |
| `@anthropic-ai/sdk` | ^0.35.x | Claude API client |
| `zod` | ^3.23.x | Schema validation |
| `commander` | ^12.x | CLI framework |
| `pino` | ^9.x | Structured logging |

---

## Timeline Considerations

**Critical Path:**
1. Browser engine setup + basic navigation
2. LangGraph state machine skeleton
3. Self-healing layer with vision LLM
4. Evaluation framework
5. CLI interface polish

**Parallelizable:**
- Unit tests (alongside implementation)
- Documentation (alongside implementation)
- Evaluation scenarios (after core complete)

---

## Approval

| Role | Name | Status | Date |
|------|------|--------|------|
| Product Owner | Adam | Pending | - |
| Technical Lead | AdamOS | Draft Complete | 2026-01-15 |

---

## Appendix A: Competitive Analysis

| Tool | Strengths | Weaknesses | Our Differentiation |
|------|-----------|------------|---------------------|
| browser-use | Popular, Python, cloud-ready | Python-only, no self-healing | TypeScript, self-healing |
| Stagehand | Hybrid code/NL, caching | Complex setup | Simpler API, LangGraph |
| Skyvern | Vision-first, enterprise | Heavy infrastructure | Lightweight, portable |
| Playwright | Rock-solid, fast | No AI, no self-healing | AI-powered, self-healing |

## Appendix B: Sample Task Definitions

```yaml
# tasks/amazon-search.yaml
name: Amazon Product Search
steps:
  - action: navigate
    url: https://www.amazon.com
  - action: fill
    target: "search box"
    value: "{{ query }}"
  - action: click
    target: "search button"
  - action: wait
    condition: "results loaded"
  - action: extract
    target: "product titles"
    limit: 5
variables:
  query: "mechanical keyboard"
```
