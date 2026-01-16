import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { BrowserConfig, NavigationError } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('browser-client');

// Stealth mode configuration
const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
  '--enable-webgl',
  '--use-gl=swiftshader',
  '--enable-accelerated-2d-canvas',
  '--no-first-run',
  '--disable-infobars',
];

const STEALTH_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const STEALTH_INIT_SCRIPT = `
  // Hide webdriver property
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // Add fake plugins
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5]
  });

  // Add fake languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en']
  });

  // Add chrome runtime object
  window.chrome = { runtime: {} };

  // Override permissions query
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters) => (
    parameters.name === 'notifications' ?
      Promise.resolve({ state: Notification.permission }) :
      originalQuery(parameters)
  );
`;

export class BrowserClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;

  constructor(config: BrowserConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing browser...');

    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: STEALTH_ARGS,
      timeout: 30000, // 30s launch timeout
    });

    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent: STEALTH_USER_AGENT,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });

    // Apply stealth init script to all pages
    await this.context.addInitScript(STEALTH_INIT_SCRIPT);

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.config.timeout);

    logger.info('Browser initialized successfully');
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    logger.info({ url }, 'Navigating to URL');

    try {
      const response = await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout,
      });

      if (!response) {
        throw new NavigationError(url, 'No response received');
      }

      if (!response.ok() && response.status() !== 304) {
        throw new NavigationError(url, `HTTP ${response.status()}`);
      }

      logger.info({ url, status: response.status() }, 'Navigation successful');
    } catch (error) {
      if (error instanceof NavigationError) throw error;
      throw new NavigationError(url, String(error));
    }
  }

  async click(selector: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    logger.info({ selector }, 'Clicking element');
    await this.page.click(selector, { timeout: this.config.timeout });
  }

  async fill(selector: string, value: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    logger.info({ selector, valueLength: value.length }, 'Filling element');
    await this.page.fill(selector, value, { timeout: this.config.timeout });
  }

  async pressKey(key: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    logger.info({ key }, 'Pressing key');
    await this.page.keyboard.press(key);
  }

  async fillAndSubmit(selector: string, value: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    logger.info({ selector, valueLength: value.length }, 'Filling element and submitting');
    await this.page.fill(selector, value, { timeout: this.config.timeout });
    await this.page.keyboard.press('Enter');
    // Wait for navigation after form submission
    await this.page.waitForLoadState('domcontentloaded', { timeout: this.config.timeout });
  }

  async getPageContent(): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    return await this.page.content();
  }

  async getPageTitle(): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    return await this.page.title();
  }

  async getUrl(): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    return this.page.url();
  }

  async waitForSelector(selector: string, timeout?: number): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.waitForSelector(selector, {
      timeout: timeout ?? this.config.timeout,
    });
  }

  async waitForNavigation(timeout?: number): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.waitForLoadState('domcontentloaded', {
      timeout: timeout ?? this.config.timeout,
    });
  }

  async evaluate<T>(fn: () => T): Promise<T> {
    if (!this.page) throw new Error('Browser not initialized');
    return await this.page.evaluate(fn);
  }

  async evaluateWithArg<T>(fn: (arg: unknown) => T, arg: unknown): Promise<T> {
    if (!this.page) throw new Error('Browser not initialized');
    return await this.page.evaluate(fn, arg);
  }

  getPage(): Page {
    if (!this.page) throw new Error('Browser not initialized');
    return this.page;
  }

  async close(): Promise<void> {
    logger.info('Closing browser...');

    const closeWithTimeout = async (fn: () => Promise<void>, name: string, timeout = 5000) => {
      try {
        await Promise.race([
          fn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${name} close timeout`)), timeout)
          )
        ]);
      } catch (error) {
        logger.warn({ error, name }, 'Close operation failed or timed out');
      }
    };

    if (this.page) {
      await closeWithTimeout(() => this.page!.close(), 'page');
      this.page = null;
    }

    if (this.context) {
      await closeWithTimeout(() => this.context!.close(), 'context');
      this.context = null;
    }

    if (this.browser) {
      await closeWithTimeout(() => this.browser!.close(), 'browser');
      this.browser = null;
    }

    logger.info('Browser closed');
  }
}
