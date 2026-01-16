/**
 * Calculate pass@k metric
 *
 * pass@k is true if at least one of the first k attempts succeeded.
 * This measures the probability that a correct solution appears
 * within k independent attempts.
 *
 * @param results Array of success/failure results for each attempt
 * @param k Number of attempts to consider
 * @returns Whether at least one of the first k attempts succeeded
 */
export function calculatePassAtK(results: boolean[], k: number): boolean {
  const firstK = results.slice(0, k);
  return firstK.some((success) => success);
}

/**
 * Calculate pass@k rate across multiple scenarios
 *
 * @param scenarioResults Map of scenario -> array of attempt results
 * @param k Number of attempts to consider
 * @returns Proportion of scenarios that pass@k
 */
export function calculatePassAtKRate(
  scenarioResults: Map<string, boolean[]>,
  k: number
): number {
  let passCount = 0;
  let totalCount = 0;

  for (const results of scenarioResults.values()) {
    if (calculatePassAtK(results, k)) {
      passCount++;
    }
    totalCount++;
  }

  return totalCount === 0 ? 0 : passCount / totalCount;
}

/**
 * Calculate the unbiased estimator for pass@k
 *
 * This is the proper statistical estimator when we have n samples
 * and want to estimate pass@k where k <= n.
 *
 * Based on the formula: pass@k = 1 - C(n-c, k) / C(n, k)
 * where n = total samples, c = correct samples
 *
 * @param n Total number of samples
 * @param c Number of correct samples
 * @param k Value of k for pass@k
 * @returns Estimated pass@k probability
 */
export function estimatePassAtK(n: number, c: number, k: number): number {
  if (n < k) {
    // Not enough samples
    return c > 0 ? 1 : 0;
  }

  if (c === 0) return 0;
  if (c >= n) return 1;

  // Calculate using the formula: 1 - C(n-c, k) / C(n, k)
  // To avoid overflow, compute the ratio directly

  let ratio = 1;
  for (let i = 0; i < k; i++) {
    ratio *= (n - c - i) / (n - i);
  }

  return 1 - ratio;
}

/**
 * Calculate aggregate metrics from evaluation results
 */
export interface AggregateMetrics {
  passAt1: number;
  passAt3: number;
  passAt5: number;
  successRate: number;
  avgDuration: number;
  healingRate: number;
}

export function calculateAggregateMetrics(
  results: Array<{
    success: boolean;
    duration: number;
    healingUsed: boolean;
  }>
): AggregateMetrics {
  const successes = results.filter((r) => r.success);
  const healed = results.filter((r) => r.healingUsed);

  const successBools = results.map((r) => r.success);

  return {
    passAt1: calculatePassAtK(successBools, 1) ? 1 : 0,
    passAt3: calculatePassAtK(successBools, 3) ? 1 : 0,
    passAt5: calculatePassAtK(successBools, 5) ? 1 : 0,
    successRate: results.length > 0 ? successes.length / results.length : 0,
    avgDuration:
      results.length > 0
        ? results.reduce((sum, r) => sum + r.duration, 0) / results.length
        : 0,
    healingRate: results.length > 0 ? healed.length / results.length : 0,
  };
}
