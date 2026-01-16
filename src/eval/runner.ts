import { createAgent } from '../agent/graph.js';
import { SentinelConfig, EvalScenario, EvalResult, EvalReport } from '../types/index.js';
import { gradeResult } from './graders.js';
import { calculatePassAtK } from './metrics.js';
import { getDefaultScenarios } from './scenarios/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('eval-runner');

export interface EvalOptions {
  suitePath?: string;
  kValues: number[];
  runsPerScenario: number;
}

export async function runEvaluation(
  config: SentinelConfig,
  options: EvalOptions
): Promise<EvalReport> {
  const { kValues, runsPerScenario } = options;

  // Load scenarios
  let scenarios: EvalScenario[];
  if (options.suitePath) {
    const content = await Bun.file(options.suitePath).text();
    scenarios = JSON.parse(content) as EvalScenario[];
  } else {
    scenarios = getDefaultScenarios();
  }

  logger.info(
    { scenarioCount: scenarios.length, runsPerScenario },
    'Starting evaluation'
  );

  const results: EvalResult[] = [];

  for (const scenario of scenarios) {
    logger.info({ scenario: scenario.name }, 'Running scenario');

    const runResults: Array<{ success: boolean; duration: number; error?: string }> = [];

    for (let run = 0; run < runsPerScenario; run++) {
      logger.debug({ scenario: scenario.name, run: run + 1 }, 'Starting run');

      const agent = await createAgent(config);

      try {
        const startTime = Date.now();
        const result = await agent.run(scenario.task);
        const duration = Date.now() - startTime;

        const success = gradeResult(result, scenario.expectedOutcome);

        if (success) {
          runResults.push({ success, duration });
        } else {
          runResults.push({ success, duration, error: 'Did not meet expected outcome' });
        }

        logger.debug(
          { scenario: scenario.name, run: run + 1, success, duration },
          'Run completed'
        );
      } catch (error) {
        runResults.push({
          success: false,
          duration: 0,
          error: String(error),
        });

        logger.error(
          { scenario: scenario.name, run: run + 1, error },
          'Run failed'
        );
      } finally {
        await agent.close();
      }
    }

    const successes = runResults.filter((r) => r.success).length;
    const failures = runResults.filter((r) => !r.success).length;
    const avgDuration =
      runResults.reduce((sum, r) => sum + r.duration, 0) / runResults.length;

    const passAtK: Record<number, boolean> = {};
    for (const k of kValues) {
      passAtK[k] = calculatePassAtK(runResults.map((r) => r.success), k);
    }

    const errors = runResults
      .filter((r) => r.error)
      .map((r) => r.error as string)
      .filter((e, i, arr) => arr.indexOf(e) === i); // Unique errors

    results.push({
      scenario: scenario.name,
      attempts: runsPerScenario,
      successes,
      failures,
      passAtK,
      avgDuration,
      errors,
    });

    logger.info(
      { scenario: scenario.name, successes, failures, passAtK },
      'Scenario completed'
    );
  }

  // Calculate summary
  const totalScenarios = results.length;
  const passAt1 =
    results.filter((r) => r.passAtK[1]).length / totalScenarios;
  const passAt3 =
    results.filter((r) => r.passAtK[3]).length / totalScenarios;
  const passAt5 =
    results.filter((r) => r.passAtK[5]).length / totalScenarios;
  const avgDuration =
    results.reduce((sum, r) => sum + r.avgDuration, 0) / totalScenarios;

  const report: EvalReport = {
    timestamp: new Date(),
    scenarios: results,
    summary: {
      totalScenarios,
      passAt1,
      passAt3,
      passAt5,
      avgDuration,
    },
  };

  logger.info(
    { passAt1, passAt3, passAt5, avgDuration },
    'Evaluation complete'
  );

  return report;
}
