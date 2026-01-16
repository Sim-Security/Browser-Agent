import { Page } from 'playwright';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('screenshot');

export interface ScreenshotOptions {
  fullPage?: boolean;
  quality?: number;
  type?: 'png' | 'jpeg';
}

export async function captureScreenshot(
  page: Page,
  options: ScreenshotOptions = {},
  timeout = 10000
): Promise<string> {
  const { fullPage = false, quality = 80, type = 'png' } = options;

  logger.debug({ fullPage, type }, 'Capturing screenshot');

  const screenshotPromise = page.screenshot({
    fullPage,
    type,
    timeout,
    ...(type === 'jpeg' ? { quality } : {}),
  });

  const buffer = await Promise.race([
    screenshotPromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Screenshot timeout')), timeout)
    )
  ]);

  const base64 = buffer.toString('base64');

  logger.debug({ size: buffer.length }, 'Screenshot captured');

  return base64;
}

export async function captureElementScreenshot(
  page: Page,
  selector: string
): Promise<string | null> {
  logger.debug({ selector }, 'Capturing element screenshot');

  try {
    const element = await page.$(selector);
    if (!element) {
      logger.warn({ selector }, 'Element not found for screenshot');
      return null;
    }

    const buffer = await element.screenshot({ type: 'png' });
    return buffer.toString('base64');
  } catch (error) {
    logger.error({ selector, error }, 'Failed to capture element screenshot');
    return null;
  }
}

export function base64ToDataUrl(base64: string, type: 'png' | 'jpeg' = 'png'): string {
  return `data:image/${type};base64,${base64}`;
}
