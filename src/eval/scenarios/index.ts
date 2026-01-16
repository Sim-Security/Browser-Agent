import { EvalScenario } from '../../types/index.js';

/**
 * Default evaluation scenarios for testing the browser agent
 */
export function getDefaultScenarios(): EvalScenario[] {
  return [
    // Scenario 1: Simple Navigation
    {
      name: 'Simple Navigation',
      description: 'Navigate to a website and verify the page loaded',
      task: 'Go to https://example.com and tell me what the page title is',
      expectedOutcome: {
        type: 'exists',
      },
      timeout: 30000,
    },

    // Scenario 2: Books to Scrape (test-friendly)
    {
      name: 'Books Extraction',
      description: 'Extract book information from a scraping practice site',
      task: 'Go to books.toscrape.com and extract the titles and prices of the first 3 books displayed',
      expectedOutcome: {
        type: 'exists',
      },
      timeout: 45000,
    },

    // Scenario 3: Quotes to Scrape (test-friendly)
    {
      name: 'Quotes Extraction',
      description: 'Extract quotes from a scraping practice site',
      task: 'Go to quotes.toscrape.com and extract the first 3 quotes along with their authors',
      expectedOutcome: {
        type: 'exists',
      },
      timeout: 45000,
    },

    // Scenario 4: Hacker News Headlines
    {
      name: 'Hacker News',
      description: 'Extract headlines from Hacker News',
      task: 'Go to news.ycombinator.com and extract the titles of the top 5 stories',
      expectedOutcome: {
        type: 'exists',
      },
      timeout: 45000,
    },

    // Scenario 5: GitHub Repository Info
    {
      name: 'GitHub Repo',
      description: 'Navigate to a GitHub repo and extract info',
      task: 'Go to github.com/langchain-ai/langgraphjs and extract the repository description and star count',
      expectedOutcome: {
        type: 'exists',
      },
      timeout: 60000,
    },

    // Scenario 6: Multi-step Navigation
    {
      name: 'Multi-step Navigation',
      description: 'Navigate through multiple pages',
      task: 'Go to example.com, then navigate to the "More information" link if present, and report what page you end up on',
      expectedOutcome: {
        type: 'exists',
      },
      timeout: 45000,
    },
  ];
}

/**
 * E-commerce focused scenarios (require specific test sites)
 */
export function getEcommerceScenarios(): EvalScenario[] {
  return [
    {
      name: 'Product Search',
      description: 'Search for a product on an e-commerce site',
      task: 'Go to amazon.com, search for "mechanical keyboard", and extract the titles and prices of the first 3 results',
      expectedOutcome: {
        type: 'exists',
      },
      timeout: 90000,
    },
  ];
}

/**
 * Form interaction scenarios
 */
export function getFormScenarios(): EvalScenario[] {
  return [
    {
      name: 'Contact Form',
      description: 'Fill out a contact form',
      task: 'Go to httpbin.org/forms/post, fill out the form with test data (name: Test User, email: test@example.com), and submit it',
      expectedOutcome: {
        type: 'exists',
      },
      timeout: 60000,
    },
  ];
}
