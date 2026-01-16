import { StateGraph, START, END } from '@langchain/langgraph';
import { BrowserAgentState, BrowserAgentStateType } from './state.js';
import { BrowserClient } from '../browser/client.js';
import { LLMClient } from '../llm/client.js';
import { VisionAnalyzer } from '../llm/vision.js';
import { TaskPlanner } from '../llm/planner.js';
import { SentinelConfig, HealingConfig } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

import { navigateNode } from './nodes/navigate.js';
import { clickNode } from './nodes/click.js';
import { fillNode } from './nodes/fill.js';
import { extractNode } from './nodes/extract.js';
import { healNode } from './nodes/heal.js';

const logger = createLogger('agent-graph');

export interface AgentContext {
  browser: BrowserClient;
  llm: LLMClient;
  vision: VisionAnalyzer;
  planner: TaskPlanner;
  healingConfig: HealingConfig;
}

/**
 * Creates the LangGraph state machine for the browser agent
 */
export function createAgentGraph(context: AgentContext) {
  const graph = new StateGraph(BrowserAgentState)
    // Plan node - breaks task into actions
    .addNode('plan', async (state: BrowserAgentStateType) => {
      logger.info({ task: state.task }, 'Planning task');

      const actions = await context.planner.planTask(state.task);

      return {
        actions,
        totalSteps: actions.length,
        currentStep: 0,
      };
    })

    // Router node - decides which action to execute
    .addNode('router', async (state: BrowserAgentStateType) => {
      if (state.currentStep >= state.totalSteps) {
        return { isComplete: true };
      }

      const currentAction = state.actions[state.currentStep];

      logger.info(
        { step: state.currentStep, action: currentAction },
        'Routing to action'
      );

      return {
        currentAction,
        needsHealing: false,
      };
    })

    // Action nodes
    .addNode('navigate', navigateNode(context))
    .addNode('click', clickNode(context))
    .addNode('fill', fillNode(context))
    .addNode('extract', extractNode(context))

    // Self-healing node
    .addNode('heal', healNode(context))

    // Success handler - moves to next step
    .addNode('success', async (state: BrowserAgentStateType) => {
      return {
        currentStep: state.currentStep + 1,
        healingAttempts: 0,
        needsHealing: false,
      };
    })

    // Finalize node - creates final result
    .addNode('finalize', async (state: BrowserAgentStateType) => {
      // Count success based on whether we completed all planned actions
      // (some intermediate failures are OK if healing recovered)
      const completedSteps = state.currentStep;
      const plannedSteps = state.totalSteps;

      // Task is successful if we completed all planned steps and have extracted data
      // OR if the last result was successful (indicating recovery from healing)
      const lastResult = state.results[state.results.length - 1];
      const lastStepSucceeded = lastResult?.success ?? false;

      // Success criteria: either all steps completed, or last extraction succeeded
      const success =
        completedSteps >= plannedSteps ||
        (lastStepSucceeded && Object.keys(state.extractedData).length > 0);

      const totalDuration = state.results.reduce((sum, r) => sum + r.duration, 0);

      const finalResult = {
        success,
        data: state.extractedData,
        steps: state.results,
        healingAttempts: state.healingHistory,
        duration: totalDuration,
        screenshots: state.results
          .map((r) => r.screenshot)
          .filter((s): s is string => !!s),
      };

      logger.info({ success, duration: totalDuration }, 'Task completed');

      return { finalResult };
    })

    // Edges
    .addEdge(START, 'plan')
    .addEdge('plan', 'router')

    // Router decides which action to take
    .addConditionalEdges('router', (state: BrowserAgentStateType) => {
      if (state.isComplete) return 'finalize';

      const action = state.currentAction;
      if (!action) return 'finalize';

      switch (action.type) {
        case 'navigate':
          return 'navigate';
        case 'click':
          return 'click';
        case 'fill':
          return 'fill';
        case 'extract':
          return 'extract';
        default:
          logger.warn({ actionType: action.type }, 'Unknown action type');
          return 'success'; // Skip unknown actions
      }
    })

    // Action outcomes - success or heal
    .addConditionalEdges('navigate', (state: BrowserAgentStateType) =>
      state.needsHealing ? 'heal' : 'success'
    )
    .addConditionalEdges('click', (state: BrowserAgentStateType) =>
      state.needsHealing ? 'heal' : 'success'
    )
    .addConditionalEdges('fill', (state: BrowserAgentStateType) =>
      state.needsHealing ? 'heal' : 'success'
    )
    .addConditionalEdges('extract', (state: BrowserAgentStateType) =>
      state.needsHealing ? 'heal' : 'success'
    )

    // Healing outcomes
    .addConditionalEdges('heal', (state: BrowserAgentStateType) => {
      // If healing exhausted, move to next step anyway
      if (
        state.healingAttempts >= context.healingConfig.maxRetries ||
        !state.needsHealing
      ) {
        return 'success';
      }

      // Retry the current action
      const action = state.currentAction;
      if (!action) return 'success';

      switch (action.type) {
        case 'click':
          return 'click';
        case 'fill':
          return 'fill';
        default:
          return 'success';
      }
    })

    // Success goes back to router
    .addEdge('success', 'router')

    // Finalize ends
    .addEdge('finalize', END);

  return graph.compile();
}

/**
 * Factory function to create a fully configured agent
 */
export async function createAgent(config: SentinelConfig) {
  const browser = new BrowserClient(config.browser);
  await browser.initialize();

  const llm = new LLMClient(config.llm);
  const vision = new VisionAnalyzer(llm);
  const planner = new TaskPlanner(llm);

  const context: AgentContext = {
    browser,
    llm,
    vision,
    planner,
    healingConfig: config.healing,
  };

  const graph = createAgentGraph(context);

  return {
    graph,
    browser,
    context,

    async run(task: string) {
      const result = await graph.invoke({
        task,
      });

      return result.finalResult;
    },

    async close() {
      await browser.close();
    },
  };
}
