import { AgentContext } from '../graph.js';
import { BrowserAgentStateType } from '../state.js';
import { captureScreenshot } from '../../browser/screenshot.js';
import { HealingAttempt } from '../../types/index.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('node-heal');

export function healNode(context: AgentContext) {
  return async (state: BrowserAgentStateType) => {
    const { healingConfig } = context;

    // Check if healing is exhausted
    if (state.healingAttempts >= healingConfig.maxRetries) {
      logger.warn(
        { attempts: state.healingAttempts, max: healingConfig.maxRetries },
        'Healing exhausted - step will be marked as FAILED'
      );

      return {
        needsHealing: false,
        healingExhausted: true, // Signal to graph that this step failed
        healingHistory: [
          {
            attemptNumber: state.healingAttempts,
            originalError: state.lastError ?? 'Unknown error',
            strategy: 'exhausted',
            elementFound: false,
            screenshot: state.screenshot,
            timestamp: new Date(),
          } as HealingAttempt,
        ],
      };
    }

    const action = state.currentAction;
    if (!action || !action.target) {
      return { needsHealing: false };
    }

    logger.info(
      {
        action: action.type,
        target: action.target,
        attempt: state.healingAttempts + 1,
        maxAttempts: healingConfig.maxRetries,
      },
      'Attempting self-healing'
    );

    const page = context.browser.getPage();

    try {
      // Calculate backoff delay
      const delay =
        healingConfig.backoff === 'exponential'
          ? healingConfig.baseDelayMs * Math.pow(2, state.healingAttempts)
          : healingConfig.baseDelayMs * (state.healingAttempts + 1);

      logger.debug({ delay }, 'Waiting before healing attempt');
      await page.waitForTimeout(delay);

      // Take fresh screenshot
      const screenshot = await captureScreenshot(page);

      // Use vision to find the element with more context
      const healingPrompt = `The previous attempt to find "${action.target}" failed with error: ${state.lastError}

Please analyze the page more carefully and find an alternative way to identify this element.
Consider:
- The element might have a different text than expected
- It might be inside a frame or shadow DOM
- It might require scrolling to be visible
- There might be a similar element that serves the same purpose`;

      const detected = await context.vision.findElement(screenshot, healingPrompt);

      if (detected && detected.confidence > 0.6) {
        logger.info(
          {
            target: action.target,
            newSelector: detected.selector,
            confidence: detected.confidence,
          },
          'Self-healing found alternative element'
        );

        // Update the action with the new selector
        const healedAction = {
          ...action,
          target: detected.selector,
        };

        return {
          currentAction: healedAction,
          screenshot,
          needsHealing: true, // Will retry with new selector
          healingAttempts: state.healingAttempts + 1,
          healingHistory: [
            {
              attemptNumber: state.healingAttempts + 1,
              originalError: state.lastError ?? 'Unknown error',
              strategy: 'vision-redetection',
              elementFound: true,
              newSelector: detected.selector,
              screenshot,
              timestamp: new Date(),
            } as HealingAttempt,
          ],
        };
      }

      // Try page-level healing strategies
      logger.info('Vision detection failed, trying page-level strategies');

      // Strategy 1: Scroll down
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(500);

      const scrolledScreenshot = await captureScreenshot(page);
      const scrollDetected = await context.vision.findElement(
        scrolledScreenshot,
        action.target
      );

      if (scrollDetected && scrollDetected.confidence > 0.6) {
        logger.info('Element found after scrolling');

        return {
          currentAction: { ...action, target: scrollDetected.selector },
          screenshot: scrolledScreenshot,
          needsHealing: true,
          healingAttempts: state.healingAttempts + 1,
          healingHistory: [
            {
              attemptNumber: state.healingAttempts + 1,
              originalError: state.lastError ?? 'Unknown error',
              strategy: 'scroll-and-detect',
              elementFound: true,
              newSelector: scrollDetected.selector,
              screenshot: scrolledScreenshot,
              timestamp: new Date(),
            } as HealingAttempt,
          ],
        };
      }

      // Strategy 2: Wait for dynamic content
      logger.info('Waiting for dynamic content');
      await page.waitForTimeout(2000);

      const waitedScreenshot = await captureScreenshot(page);
      const waitDetected = await context.vision.findElement(
        waitedScreenshot,
        action.target
      );

      if (waitDetected && waitDetected.confidence > 0.6) {
        logger.info('Element found after waiting');

        return {
          currentAction: { ...action, target: waitDetected.selector },
          screenshot: waitedScreenshot,
          needsHealing: true,
          healingAttempts: state.healingAttempts + 1,
          healingHistory: [
            {
              attemptNumber: state.healingAttempts + 1,
              originalError: state.lastError ?? 'Unknown error',
              strategy: 'wait-and-detect',
              elementFound: true,
              newSelector: waitDetected.selector,
              screenshot: waitedScreenshot,
              timestamp: new Date(),
            } as HealingAttempt,
          ],
        };
      }

      // All strategies failed for this attempt
      logger.warn('Healing attempt failed, will retry');

      return {
        screenshot,
        needsHealing: true,
        healingAttempts: state.healingAttempts + 1,
        healingHistory: [
          {
            attemptNumber: state.healingAttempts + 1,
            originalError: state.lastError ?? 'Unknown error',
            strategy: 'all-strategies-failed',
            elementFound: false,
            screenshot,
            timestamp: new Date(),
          } as HealingAttempt,
        ],
      };
    } catch (error) {
      logger.error({ error }, 'Healing attempt threw error');

      return {
        needsHealing: true,
        healingAttempts: state.healingAttempts + 1,
        healingHistory: [
          {
            attemptNumber: state.healingAttempts + 1,
            originalError: state.lastError ?? 'Unknown error',
            strategy: 'error',
            elementFound: false,
            screenshot: state.screenshot,
            timestamp: new Date(),
          } as HealingAttempt,
        ],
      };
    }
  };
}
