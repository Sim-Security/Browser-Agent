import { z } from 'zod';

// ============================================================================
// Core Configuration Types
// ============================================================================

export const LLMConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openrouter']),
  model: z.string().default('x-ai/grok-4.1-fast'),
  apiKey: z.string(),
  maxTokens: z.number().default(4096),
  baseUrl: z.string().optional(),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

export const HealingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxRetries: z.number().min(1).max(10).default(3),
  backoff: z.enum(['linear', 'exponential']).default('exponential'),
  baseDelayMs: z.number().default(1000),
});

export type HealingConfig = z.infer<typeof HealingConfigSchema>;

export const BrowserConfigSchema = z.object({
  headless: z.boolean().default(true),
  timeout: z.number().default(30000),
  viewport: z.object({
    width: z.number().default(1280),
    height: z.number().default(720),
  }).default({}),
});

export type BrowserConfig = z.infer<typeof BrowserConfigSchema>;

export const SentinelConfigSchema = z.object({
  llm: LLMConfigSchema,
  healing: HealingConfigSchema.default({}),
  browser: BrowserConfigSchema.default({}),
});

export type SentinelConfig = z.infer<typeof SentinelConfigSchema>;

// ============================================================================
// Action Types
// ============================================================================

export const ActionTypeSchema = z.enum([
  'navigate',
  'click',
  'fill',
  'extract',
  'wait',
  'screenshot',
]);

export type ActionType = z.infer<typeof ActionTypeSchema>;

export const ActionSchema = z.object({
  type: ActionTypeSchema,
  target: z.string().optional(),
  value: z.string().optional(),
  timeout: z.number().optional(),
});

export type Action = z.infer<typeof ActionSchema>;

// ============================================================================
// Result Types
// ============================================================================

export interface StepResult {
  action: Action;
  success: boolean;
  error?: string;
  duration: number;
  screenshot?: string;
  healingUsed: boolean;
}

export interface HealingAttempt {
  attemptNumber: number;
  originalError: string;
  strategy: string;
  elementFound: boolean;
  newSelector?: string;
  screenshot: string;
  timestamp: Date;
}

export interface TaskResult {
  success: boolean;
  data?: Record<string, unknown>;
  steps: StepResult[];
  healingAttempts: HealingAttempt[];
  duration: number;
  screenshots: string[];
}

// ============================================================================
// Agent State Types
// ============================================================================

export interface BrowserAgentState {
  // Task context
  task: string;
  currentStep: number;
  totalSteps: number;

  // Browser state
  url: string;
  pageTitle: string;
  pageContent: string;
  screenshot: string;

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

// ============================================================================
// Evaluation Types
// ============================================================================

export interface EvalScenario {
  name: string;
  description: string;
  task: string;
  expectedOutcome: {
    type: 'contains' | 'equals' | 'matches' | 'exists';
    field?: string;
    value?: string | RegExp;
  };
  timeout: number;
}

export interface EvalResult {
  scenario: string;
  attempts: number;
  successes: number;
  failures: number;
  passAtK: Record<number, boolean>;
  avgDuration: number;
  errors: string[];
}

export interface EvalReport {
  timestamp: Date;
  scenarios: EvalResult[];
  summary: {
    totalScenarios: number;
    passAt1: number;
    passAt3: number;
    passAt5: number;
    avgDuration: number;
  };
}

// ============================================================================
// Element Detection Types
// ============================================================================

export interface DetectedElement {
  description: string;
  selector: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface VisionAnalysisResult {
  elements: DetectedElement[];
  pageDescription: string;
  suggestedAction?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class SentinelError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'SentinelError';
  }
}

export class ElementNotFoundError extends SentinelError {
  constructor(target: string) {
    super(`Element not found: ${target}`, 'ELEMENT_NOT_FOUND', true);
    this.name = 'ElementNotFoundError';
  }
}

export class NavigationError extends SentinelError {
  constructor(url: string, reason: string) {
    super(`Navigation failed to ${url}: ${reason}`, 'NAVIGATION_FAILED', true);
    this.name = 'NavigationError';
  }
}

export class HealingExhaustedError extends SentinelError {
  constructor(attempts: number) {
    super(
      `Self-healing exhausted after ${attempts} attempts`,
      'HEALING_EXHAUSTED',
      false
    );
    this.name = 'HealingExhaustedError';
  }
}
