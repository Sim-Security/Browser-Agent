import { AgentContext } from '../graph.js';
import { BrowserAgentStateType } from '../state.js';
import { captureScreenshot } from '../../browser/screenshot.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('node-navigate');

export function navigateNode(context: AgentContext) {
  return async (state: BrowserAgentStateType) => {
    const action = state.currentAction;
    if (!action || action.type !== 'navigate' || !action.target) {
      return { needsHealing: false };
    }

    const startTime = Date.now();
    const url = action.target;

    logger.info({ url }, 'Executing navigate action');

    try {
      await context.browser.navigate(url);
      await context.browser.waitForNavigation();

      const page = context.browser.getPage();
      const screenshot = await captureScreenshot(page);
      const pageTitle = await context.browser.getPageTitle();
      const currentUrl = await context.browser.getUrl();
      const pageContent = await context.browser.getPageContent();

      const duration = Date.now() - startTime;

      logger.info({ url: currentUrl, title: pageTitle, duration }, 'Navigation successful');

      return {
        url: currentUrl,
        pageTitle,
        pageContent: pageContent.slice(0, 10000), // Truncate for state
        screenshot,
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

      logger.error({ url, error }, 'Navigation failed');

      return {
        lastError: String(error),
        needsHealing: true,
        results: [
          {
            action,
            success: false,
            error: String(error),
            duration,
            healingUsed: false,
          },
        ],
      };
    }
  };
}
