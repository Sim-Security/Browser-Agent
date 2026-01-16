import { LLMClient } from './client.js';
import { DetectedElement, VisionAnalysisResult } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('vision');

const ELEMENT_DETECTION_SYSTEM = `You are a vision analysis system for browser automation. Your task is to analyze screenshots and identify interactive elements.

When asked to find an element, analyze the image and return:
1. The most likely CSS selector for the element
2. A confidence score (0-1)
3. The bounding box coordinates

Be precise and prefer specific selectors over generic ones. Consider:
- Button text and aria-labels
- Input placeholders and labels
- Link text and href patterns
- Unique class names or IDs`;

const ELEMENT_DETECTION_PROMPT = `Analyze this screenshot and find the element described as: "{description}"

Return a JSON object with this structure:
{
  "found": boolean,
  "element": {
    "description": "what you found",
    "selector": "CSS selector to target this element",
    "confidence": 0.0-1.0,
    "boundingBox": { "x": number, "y": number, "width": number, "height": number }
  },
  "alternatives": [
    // Other possible matches if confidence < 0.9
  ],
  "reasoning": "brief explanation of how you identified the element"
}`;

const PAGE_ANALYSIS_PROMPT = `Analyze this webpage screenshot and describe:
1. What type of page this is
2. The main interactive elements visible
3. Any forms, buttons, or links
4. The current state (loading, error, content loaded)

Return a JSON object:
{
  "pageType": "string",
  "description": "brief description",
  "elements": [
    { "type": "button|link|input|form", "description": "what it does", "selector": "best CSS selector" }
  ],
  "state": "loading|error|ready",
  "suggestedAction": "what a user might do next"
}`;

export class VisionAnalyzer {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async findElement(
    screenshot: string,
    description: string
  ): Promise<DetectedElement | null> {
    logger.info({ description }, 'Searching for element via vision');

    const prompt = ELEMENT_DETECTION_PROMPT.replace('{description}', description);

    try {
      const result = await this.llm.completeWithImage(
        prompt,
        screenshot,
        ELEMENT_DETECTION_SYSTEM
      );

      // Parse JSON response
      let parsed: {
        found: boolean;
        element?: DetectedElement;
        alternatives?: DetectedElement[];
        reasoning?: string;
      };

      try {
        let jsonStr = result.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
        if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
        parsed = JSON.parse(jsonStr.trim());
      } catch {
        logger.error({ result }, 'Failed to parse vision response as JSON');
        return null;
      }

      if (!parsed.found || !parsed.element) {
        logger.warn({ description, reasoning: parsed.reasoning }, 'Element not found');
        return null;
      }

      logger.info(
        {
          description,
          selector: parsed.element.selector,
          confidence: parsed.element.confidence,
        },
        'Element found'
      );

      return parsed.element;
    } catch (error) {
      logger.error({ description, error }, 'Vision analysis failed');
      return null;
    }
  }

  async analyzePage(screenshot: string): Promise<VisionAnalysisResult> {
    logger.info('Analyzing page via vision');

    try {
      const llmResponse = await this.llm.completeWithImage(
        PAGE_ANALYSIS_PROMPT,
        screenshot,
        ELEMENT_DETECTION_SYSTEM
      );

      let parsed: {
        pageType: string;
        description: string;
        elements: Array<{
          type: string;
          description: string;
          selector: string;
        }>;
        state: string;
        suggestedAction?: string;
      };

      try {
        let jsonStr = llmResponse.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
        if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
        parsed = JSON.parse(jsonStr.trim());
      } catch {
        logger.error({ llmResponse }, 'Failed to parse page analysis as JSON');
        return {
          elements: [],
          pageDescription: 'Unable to analyze page',
        };
      }

      const analysisResult: VisionAnalysisResult = {
        elements: parsed.elements.map((e) => ({
          description: e.description,
          selector: e.selector,
          confidence: 0.8,
          boundingBox: { x: 0, y: 0, width: 0, height: 0 },
        })),
        pageDescription: parsed.description,
      };
      if (parsed.suggestedAction) {
        analysisResult.suggestedAction = parsed.suggestedAction;
      }
      return analysisResult;
    } catch (error) {
      logger.error({ error }, 'Page analysis failed');
      return {
        elements: [],
        pageDescription: 'Analysis failed',
      };
    }
  }
}
