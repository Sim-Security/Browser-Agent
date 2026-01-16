import { AgentContext } from '../graph.js';
import { BrowserAgentStateType } from '../state.js';
import { captureScreenshot } from '../../browser/screenshot.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('node-fill');

export function fillNode(context: AgentContext) {
  return async (state: BrowserAgentStateType) => {
    const action = state.currentAction;
    if (!action || action.type !== 'fill' || !action.target) {
      return { needsHealing: false };
    }

    const startTime = Date.now();
    const target = action.target;
    const value = action.value ?? '';

    logger.info({ target, valueLength: value.length }, 'Executing fill action');

    const page = context.browser.getPage();

    try {
      // Determine selector
      let selector = target;

      // Check if target looks like a CSS selector
      const isCssSelector =
        target.startsWith('.') ||
        target.startsWith('#') ||
        target.startsWith('[') ||
        target.includes('>') ||
        /^(input|textarea|select)/.test(target);

      if (!isCssSelector) {
        // Use vision to find the input element
        logger.info({ target }, 'Using vision to find input element');

        const screenshot = await captureScreenshot(page);
        const detected = await context.vision.findElement(
          screenshot,
          `input field for ${target}`
        );

        if (detected && detected.confidence > 0.6) {
          selector = detected.selector;
          logger.info(
            { target, selector, confidence: detected.confidence },
            'Input found via vision'
          );
        } else {
          // Try common selector patterns for inputs
          const patterns = [
            `input[placeholder*="${target}" i]`,
            `input[name*="${target}" i]`,
            `input[aria-label*="${target}" i]`,
            `textarea[placeholder*="${target}" i]`,
            `label:has-text("${target}") + input`,
            `label:has-text("${target}") ~ input`,
          ];

          let found = false;
          for (const pattern of patterns) {
            try {
              const element = await page.$(pattern);
              if (element) {
                selector = pattern;
                found = true;
                break;
              }
            } catch {
              continue;
            }
          }

          if (!found) {
            throw new Error(`Could not find input: ${target}`);
          }
        }
      }

      // Clear existing value and fill
      await page.fill(selector, '');
      await context.browser.fill(selector, value);

      // Check if this is a search input that should auto-submit
      const isSearchInput =
        target.toLowerCase().includes('search') ||
        selector.toLowerCase().includes('search') ||
        selector.includes('[type="search"]') ||
        selector.includes('placeholder*="Search"');

      if (isSearchInput) {
        logger.info({ target, selector }, 'Auto-submitting search input with Enter key');
        await context.browser.pressKey('Enter');
        // Wait briefly for navigation to start
        try {
          await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
        } catch {
          // Navigation may not happen immediately, continue
        }
      }

      const screenshot = await captureScreenshot(page);
      const duration = Date.now() - startTime;

      logger.info({ target, selector, duration }, 'Fill successful');

      return {
        screenshot,
        needsHealing: false,
        results: [
          {
            action,
            success: true,
            duration,
            screenshot,
            healingUsed: state.healingAttempts > 0,
          },
        ],
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const screenshot = await captureScreenshot(page);

      logger.error({ target, error }, 'Fill failed');

      return {
        screenshot,
        lastError: String(error),
        needsHealing: true,
        healingAttempts: state.healingAttempts + 1,
        results: [
          {
            action,
            success: false,
            error: String(error),
            duration,
            screenshot,
            healingUsed: state.healingAttempts > 0,
          },
        ],
      };
    }
  };
}
