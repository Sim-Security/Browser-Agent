import { AgentContext } from '../graph.js';
import { BrowserAgentStateType } from '../state.js';
import { captureScreenshot } from '../../browser/screenshot.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('node-extract');

const EXTRACTION_PROMPT = `Analyze this webpage and extract the following data: {target}

Return a JSON object with the extracted data. Structure it logically based on what was requested.
If extracting a list, return an array. If extracting specific fields, return an object with those fields.

Example outputs:
- For "product titles": { "titles": ["Product 1", "Product 2", ...] }
- For "price and name": { "name": "...", "price": "..." }
- For "all links": { "links": [{ "text": "...", "href": "..." }, ...] }`;

export function extractNode(context: AgentContext) {
  return async (state: BrowserAgentStateType) => {
    const action = state.currentAction;
    if (!action || action.type !== 'extract' || !action.target) {
      return { needsHealing: false };
    }

    const startTime = Date.now();
    const target = action.target;

    logger.info({ target }, 'Executing extract action');

    const page = context.browser.getPage();

    try {
      // Capture screenshot for vision-based extraction
      const screenshot = await captureScreenshot(page);

      // Use LLM to extract data based on visual analysis
      const prompt = EXTRACTION_PROMPT.replace('{target}', target);

      const response = await context.llm.completeWithImage(
        prompt,
        screenshot,
        'You are a data extraction assistant. Extract structured data from webpage screenshots accurately.'
      );

      // Parse the extracted data
      let extractedData: Record<string, unknown>;
      try {
        let jsonStr = response.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
        if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
        extractedData = JSON.parse(jsonStr.trim());
      } catch {
        // If JSON parsing fails, wrap in an object
        extractedData = { raw: response };
      }

      const duration = Date.now() - startTime;

      logger.info(
        { target, dataKeys: Object.keys(extractedData), duration },
        'Extraction successful'
      );

      return {
        screenshot,
        extractedData,
        needsHealing: false,
        results: [
          {
            action,
            success: true,
            duration,
            screenshot,
            healingUsed: false,
          },
        ],
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const screenshot = await captureScreenshot(page);

      logger.error({ target, error }, 'Extraction failed - will attempt healing');

      return {
        screenshot,
        lastError: String(error),
        needsHealing: true, // Enable healing for extraction - may recover with new screenshot
        results: [
          {
            action,
            success: false,
            error: String(error),
            duration,
            screenshot,
            healingUsed: false,
          },
        ],
      };
    }
  };
}
