import { AgentContext } from '../graph.js';
import { BrowserAgentStateType } from '../state.js';
import { captureScreenshot } from '../../browser/screenshot.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('node-click');

export function clickNode(context: AgentContext) {
  return async (state: BrowserAgentStateType) => {
    const action = state.currentAction;
    if (!action || action.type !== 'click' || !action.target) {
      return { needsHealing: false };
    }

    const startTime = Date.now();
    const target = action.target;

    logger.info({ target }, 'Executing click action');

    const page = context.browser.getPage();

    // Check if this is a search button click that's no longer needed
    // (because the previous fill auto-submitted with Enter)
    const isSearchButtonClick =
      target.toLowerCase().includes('search') &&
      (target.toLowerCase().includes('button') ||
        target.toLowerCase().includes('icon') ||
        target.toLowerCase().includes('magnifying'));

    if (isSearchButtonClick) {
      const currentUrl = await context.browser.getUrl();
      // If we're already on a search results or article page, skip the click
      if (
        currentUrl.includes('/wiki/') ||
        currentUrl.includes('search?') ||
        currentUrl.includes('/search/') ||
        currentUrl.includes('?q=') ||
        currentUrl.includes('?search=')
      ) {
        logger.info(
          { target, currentUrl },
          'Skipping search button click - already navigated via Enter key'
        );
        const screenshot = await captureScreenshot(page);
        return {
          screenshot,
          needsHealing: false,
          results: [
            {
              action,
              success: true,
              duration: Date.now() - startTime,
              screenshot,
              healingUsed: false,
            },
          ],
        };
      }
    }

    try {
      // First, try to find element using vision if target is natural language
      let selector = target;

      // Check if target looks like a CSS selector
      const isCssSelector =
        target.startsWith('.') ||
        target.startsWith('#') ||
        target.startsWith('[') ||
        target.includes('>') ||
        /^[a-z]+$/.test(target);

      if (!isCssSelector) {
        // Use vision to find the element
        logger.info({ target }, 'Using vision to find element');

        const screenshot = await captureScreenshot(page);
        const detected = await context.vision.findElement(screenshot, target);

        if (detected && detected.confidence > 0.6) {
          selector = detected.selector;
          logger.info(
            { target, selector, confidence: detected.confidence },
            'Element found via vision'
          );
        } else {
          // Try common selector patterns
          const patterns = [
            `button:has-text("${target}")`,
            `a:has-text("${target}")`,
            `[aria-label="${target}"]`,
            `[title="${target}"]`,
            `input[placeholder*="${target}" i]`,
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
            throw new Error(`Could not find element: ${target}`);
          }
        }
      }

      // Click the element
      await context.browser.click(selector);

      // Wait for any navigation or updates
      await page.waitForTimeout(500);

      const screenshot = await captureScreenshot(page);
      const duration = Date.now() - startTime;

      logger.info({ target, selector, duration }, 'Click successful');

      return {
        screenshot,
        pageContent: (await context.browser.getPageContent()).slice(0, 10000),
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

      logger.error({ target, error }, 'Click failed');

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
