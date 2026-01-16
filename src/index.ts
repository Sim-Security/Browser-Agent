#!/usr/bin/env bun
import { Command } from 'commander';
import { createAgent } from './agent/graph.js';
import { runEvaluation } from './eval/runner.js';
import { SentinelConfigSchema } from './types/index.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('cli');

const program = new Command();

program
  .name('sentinel')
  .description('AI-powered browser automation agent with self-healing capabilities')
  .version('1.0.0');

// Run command - execute a task
program
  .command('run')
  .description('Execute a browser automation task')
  .argument('<task>', 'The task to execute in natural language')
  .option('-H, --headless', 'Run browser in headless mode', true)
  .option('--no-headless', 'Run browser with visible UI')
  .option('-r, --retries <number>', 'Max self-healing retries', '3')
  .option('-t, --timeout <ms>', 'Action timeout in milliseconds', '30000')
  .option('-p, --provider <provider>', 'LLM provider: anthropic, openrouter', 'openrouter')
  .option('--model <model>', 'LLM model to use', 'x-ai/grok-4.1-fast')
  .option('-o, --output <format>', 'Output format: json, text', 'text')
  .action(async (task: string, options) => {
    // Determine API key based on provider
    const provider = options.provider as 'anthropic' | 'openrouter';
    const apiKey = provider === 'openrouter'
      ? process.env.OPENROUTER_API_KEY
      : process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      const envVar = provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'ANTHROPIC_API_KEY';
      console.error(`Error: ${envVar} environment variable is required`);
      process.exit(1);
    }

    const config = SentinelConfigSchema.parse({
      llm: {
        provider,
        model: options.model,
        apiKey,
      },
      healing: {
        enabled: true,
        maxRetries: parseInt(options.retries),
        backoff: 'exponential',
      },
      browser: {
        headless: options.headless,
        timeout: parseInt(options.timeout),
      },
    });

    logger.info({ task, config: { ...config, llm: { ...config.llm, apiKey: '[REDACTED]' } } }, 'Starting task');

    let agent;
    try {
      agent = await createAgent(config);
      const result = await agent.run(task);

      if (options.output === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('\n=== Task Result ===');
        console.log(`Success: ${result?.success ? 'Yes' : 'No'}`);
        console.log(`Duration: ${result?.duration}ms`);
        console.log(`Steps: ${result?.steps.length}`);
        console.log(`Healing attempts: ${result?.healingAttempts.length}`);

        if (result?.data && Object.keys(result.data).length > 0) {
          console.log('\nExtracted Data:');
          console.log(JSON.stringify(result.data, null, 2));
        }

        if (!result?.success) {
          console.log('\nErrors:');
          result?.steps
            .filter((s) => !s.success)
            .forEach((s) => console.log(`  - ${s.error}`));
        }
      }

      process.exit(result?.success ? 0 : 1);
    } catch (error) {
      logger.error({ error }, 'Task failed');
      console.error('Error:', error);
      process.exit(1);
    } finally {
      if (agent) {
        await agent.close();
      }
    }
  });

// Eval command - run evaluation suite
program
  .command('eval')
  .description('Run evaluation suite')
  .option('-s, --suite <path>', 'Path to evaluation suite YAML')
  .option('-k, --k <numbers>', 'K values for pass@k (comma-separated)', '1,3,5')
  .option('-r, --runs <number>', 'Number of runs per scenario', '5')
  .option('-o, --output <path>', 'Output path for report')
  .option('--format <format>', 'Report format: json, markdown', 'markdown')
  .option('-p, --provider <provider>', 'LLM provider: anthropic, openrouter', 'openrouter')
  .option('--model <model>', 'LLM model to use', 'x-ai/grok-4.1-fast')
  .option('-H, --headless', 'Run browser in headless mode', true)
  .option('--no-headless', 'Run browser with visible UI')
  .action(async (options) => {
    const provider = (options.provider ?? 'openrouter') as 'anthropic' | 'openrouter';
    const apiKey = provider === 'openrouter'
      ? process.env.OPENROUTER_API_KEY
      : process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      const envVar = provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'ANTHROPIC_API_KEY';
      console.error(`Error: ${envVar} environment variable is required`);
      process.exit(1);
    }

    const config = SentinelConfigSchema.parse({
      llm: {
        provider,
        model: options.model ?? 'x-ai/grok-4.1-fast',
        apiKey,
      },
      healing: {
        enabled: true,
        maxRetries: 3,
        backoff: 'exponential',
      },
      browser: {
        headless: options.headless,
        timeout: 30000,
      },
    });

    const kValues = options.k.split(',').map(Number);
    const runsPerScenario = parseInt(options.runs);

    logger.info({ kValues, runsPerScenario, suite: options.suite }, 'Starting evaluation');

    try {
      const report = await runEvaluation(config, {
        suitePath: options.suite,
        kValues,
        runsPerScenario,
      });

      if (options.format === 'json') {
        const output = JSON.stringify(report, null, 2);
        if (options.output) {
          await Bun.write(options.output, output);
          console.log(`Report written to ${options.output}`);
        } else {
          console.log(output);
        }
      } else {
        const markdown = generateMarkdownReport(report);
        if (options.output) {
          await Bun.write(options.output, markdown);
          console.log(`Report written to ${options.output}`);
        } else {
          console.log(markdown);
        }
      }

      const passRate = report.summary.passAt1;
      process.exit(passRate >= 0.75 ? 0 : 1);
    } catch (error) {
      logger.error({ error }, 'Evaluation failed');
      console.error('Error:', error);
      process.exit(1);
    }
  });

function generateMarkdownReport(report: {
  timestamp: Date;
  scenarios: Array<{
    scenario: string;
    attempts: number;
    successes: number;
    failures: number;
    passAtK: Record<number, boolean>;
    avgDuration: number;
    errors: string[];
  }>;
  summary: {
    totalScenarios: number;
    passAt1: number;
    passAt3: number;
    passAt5: number;
    avgDuration: number;
  };
}): string {
  const lines = [
    '# SentinelBrowser Evaluation Report',
    '',
    `**Generated:** ${report.timestamp.toISOString()}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Scenarios | ${report.summary.totalScenarios} |`,
    `| pass@1 | ${(report.summary.passAt1 * 100).toFixed(1)}% |`,
    `| pass@3 | ${(report.summary.passAt3 * 100).toFixed(1)}% |`,
    `| pass@5 | ${(report.summary.passAt5 * 100).toFixed(1)}% |`,
    `| Avg Duration | ${report.summary.avgDuration.toFixed(0)}ms |`,
    '',
    '## Scenario Results',
    '',
    '| Scenario | Attempts | Successes | pass@1 | pass@3 | Avg Duration |',
    '|----------|----------|-----------|--------|--------|--------------|',
  ];

  for (const s of report.scenarios) {
    lines.push(
      `| ${s.scenario} | ${s.attempts} | ${s.successes} | ${s.passAtK[1] ? 'Pass' : 'Fail'} | ${s.passAtK[3] ? 'Pass' : 'Fail'} | ${s.avgDuration.toFixed(0)}ms |`
    );
  }

  lines.push('', '## Errors', '');

  for (const s of report.scenarios) {
    if (s.errors.length > 0) {
      lines.push(`### ${s.scenario}`, '');
      s.errors.forEach((e) => lines.push(`- ${e}`));
      lines.push('');
    }
  }

  return lines.join('\n');
}

program.parse();
