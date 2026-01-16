import { Annotation } from '@langchain/langgraph';
import {
  Action,
  StepResult,
  HealingAttempt,
  TaskResult,
} from '../types/index.js';

/**
 * BrowserAgentState - The state schema for the LangGraph state machine
 *
 * This defines all state that flows through the agent graph.
 * Each node can read and update portions of this state.
 */
export const BrowserAgentState = Annotation.Root({
  // Task context
  task: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  currentStep: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  totalSteps: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  // Browser state
  url: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  pageTitle: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  pageContent: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  screenshot: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // Execution state - actions accumulate
  actions: Annotation<Action[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Results accumulate
  results: Annotation<StepResult[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Healing state
  lastError: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  healingAttempts: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  healingHistory: Annotation<HealingAttempt[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Current action being executed
  currentAction: Annotation<Action | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Output
  extractedData: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  finalResult: Annotation<TaskResult | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Control flow
  needsHealing: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),

  isComplete: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),

  // Track steps that failed even after healing exhaustion
  failedSteps: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  // Flag indicating healing was exhausted for current step
  healingExhausted: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
});

export type BrowserAgentStateType = typeof BrowserAgentState.State;
