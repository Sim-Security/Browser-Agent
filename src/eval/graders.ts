import { TaskResult } from '../types/index.js';

export interface ExpectedOutcome {
  type: 'contains' | 'equals' | 'matches' | 'exists';
  field?: string;
  value?: string | RegExp;
}

/**
 * Grade a task result against expected outcome
 */
export function gradeResult(
  result: TaskResult | null,
  expected: ExpectedOutcome
): boolean {
  if (!result) return false;

  // Basic success check
  if (!result.success) return false;

  switch (expected.type) {
    case 'exists':
      // Just needs to succeed and have some data
      return (
        result.success &&
        (Object.keys(result.data ?? {}).length > 0 || result.steps.length > 0)
      );

    case 'contains':
      if (!expected.field || !expected.value) return result.success;
      return checkContains(result.data, expected.field, expected.value as string);

    case 'equals':
      if (!expected.field || !expected.value) return result.success;
      return checkEquals(result.data, expected.field, expected.value as string);

    case 'matches':
      if (!expected.field || !expected.value) return result.success;
      return checkMatches(
        result.data,
        expected.field,
        expected.value as string | RegExp
      );

    default:
      return result.success;
  }
}

function checkContains(
  data: Record<string, unknown> | undefined,
  field: string,
  value: string
): boolean {
  if (!data) return false;

  const fieldValue = getNestedField(data, field);
  if (fieldValue === undefined) return false;

  if (typeof fieldValue === 'string') {
    return fieldValue.toLowerCase().includes(value.toLowerCase());
  }

  if (Array.isArray(fieldValue)) {
    return fieldValue.some((item) => {
      if (typeof item === 'string') {
        return item.toLowerCase().includes(value.toLowerCase());
      }
      return JSON.stringify(item).toLowerCase().includes(value.toLowerCase());
    });
  }

  return JSON.stringify(fieldValue).toLowerCase().includes(value.toLowerCase());
}

function checkEquals(
  data: Record<string, unknown> | undefined,
  field: string,
  value: string
): boolean {
  if (!data) return false;

  const fieldValue = getNestedField(data, field);
  if (fieldValue === undefined) return false;

  if (typeof fieldValue === 'string') {
    return fieldValue === value;
  }

  return JSON.stringify(fieldValue) === value;
}

function checkMatches(
  data: Record<string, unknown> | undefined,
  field: string,
  pattern: string | RegExp
): boolean {
  if (!data) return false;

  const fieldValue = getNestedField(data, field);
  if (fieldValue === undefined) return false;

  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

  if (typeof fieldValue === 'string') {
    return regex.test(fieldValue);
  }

  if (Array.isArray(fieldValue)) {
    return fieldValue.some((item) => {
      if (typeof item === 'string') {
        return regex.test(item);
      }
      return regex.test(JSON.stringify(item));
    });
  }

  return regex.test(JSON.stringify(fieldValue));
}

function getNestedField(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
