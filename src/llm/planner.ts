import { LLMClient } from './client.js';
import { Action } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('planner');

const TASK_PLANNER_SYSTEM = `You are a browser automation task planner. Given a natural language task, break it down into concrete browser actions.

Available actions:
- navigate: Go to a URL
- click: Click an element (describe what to click)
- fill: Fill a form field (describe the field and the value)
- extract: Extract data from the page (describe what to extract)
- wait: Wait for something to happen

Be specific in element descriptions. Use visible text, placeholders, and visual descriptions rather than technical selectors.`;

const TASK_PLANNER_PROMPT = `Task: {task}

Break this task into a sequence of browser actions. Return a JSON array:
[
  { "type": "navigate", "target": "https://example.com" },
  { "type": "click", "target": "the search button with magnifying glass icon" },
  { "type": "fill", "target": "the search input field", "value": "search term" },
  { "type": "extract", "target": "all product titles on the page" }
]

Important:
- Be specific about which elements to interact with
- Use visual descriptions that a human would understand
- Include waits if needed for page loads
- Extract only what's relevant to the task`;

export class TaskPlanner {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async planTask(task: string): Promise<Action[]> {
    logger.info({ task }, 'Planning task');

    const prompt = TASK_PLANNER_PROMPT.replace('{task}', task);

    try {
      const result = await this.llm.complete(prompt, TASK_PLANNER_SYSTEM);

      // Parse JSON response
      let jsonStr = result.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

      const actions: Action[] = JSON.parse(jsonStr.trim());

      logger.info({ actionCount: actions.length }, 'Task planned');

      return actions;
    } catch (error) {
      logger.error({ task, error }, 'Task planning failed');
      throw new Error(`Failed to plan task: ${error}`);
    }
  }

  async refineAction(
    action: Action,
    context: { pageContent: string; previousResults: string[] }
  ): Promise<Action> {
    const prompt = `Given this action and page context, refine the action description to be more specific.

Action: ${JSON.stringify(action)}

Page context (truncated):
${context.pageContent.slice(0, 2000)}

Previous action results:
${context.previousResults.slice(-3).join('\n')}

Return the refined action as JSON. Keep the same structure but make the target more specific if possible.`;

    try {
      const result = await this.llm.complete(prompt, TASK_PLANNER_SYSTEM);

      let jsonStr = result.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

      return JSON.parse(jsonStr.trim()) as Action;
    } catch {
      // If refinement fails, return original action
      return action;
    }
  }
}
