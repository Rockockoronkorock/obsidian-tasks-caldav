/**
 * Retry logic with exponential backoff
 * Implements T073: Implement retry logic with exponential backoff
 * Based on contracts/caldav-api.md retry strategy
 */

import { Logger } from "../sync/logger";
import {
	isTransientError,
	isAuthError,
	CalDAVRateLimitError,
} from "./errors";

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
	/** Maximum number of retry attempts */
	maxRetries: number;
	/** Initial backoff delay in milliseconds */
	initialDelayMs: number;
	/** Maximum backoff delay in milliseconds */
	maxDelayMs: number;
	/** Backoff multiplier (exponential) */
	backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 3,
	initialDelayMs: 1000, // 1 second
	maxDelayMs: 10000, // 10 seconds
	backoffMultiplier: 2,
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate backoff delay with exponential backoff
 */
function calculateBackoff(
	attempt: number,
	config: RetryConfig
): number {
	const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
	return Math.min(delay, config.maxDelayMs);
}

/**
 * Wrapper function that implements retry logic with exponential backoff
 *
 * Retry strategy:
 * - Transient errors (500, 503, network errors): Retry with exponential backoff
 * - Authentication errors (401, 403): Do NOT retry
 * - Rate limiting (429): Wait for Retry-After header, then retry
 * - Other errors: Do NOT retry
 *
 * @param operation The async operation to retry
 * @param config Retry configuration
 * @returns The result of the operation
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
	let lastError: Error;
	let attempt = 0;

	while (attempt < config.maxRetries) {
		try {
			// Attempt the operation
			const result = await operation();

			// Success! Return the result
			if (attempt > 0) {
				Logger.info(`Operation succeeded after ${attempt} retries`);
			}
			return result;
		} catch (error) {
			lastError = error as Error;
			attempt++;

			// Check if we should retry this error
			if (!shouldRetry(error)) {
				Logger.error(
					`Operation failed with non-retryable error: ${lastError.message}`,
					lastError
				);
				throw lastError;
			}

			// Check if we've exhausted retries
			if (attempt >= config.maxRetries) {
				Logger.error(
					`Operation failed after ${attempt} attempts: ${lastError.message}`,
					lastError
				);
				throw lastError;
			}

			// Calculate backoff delay
			let delayMs = calculateBackoff(attempt - 1, config);

			// Handle rate limiting specially
			if (error instanceof CalDAVRateLimitError && error.retryAfter) {
				delayMs = error.retryAfter * 1000; // Convert seconds to milliseconds
				Logger.warn(
					`Rate limited. Waiting ${error.retryAfter} seconds before retry ${attempt}/${config.maxRetries}`
				);
			} else {
				Logger.warn(
					`Transient error detected. Retrying in ${delayMs}ms (attempt ${attempt}/${config.maxRetries}): ${lastError.message}`
				);
			}

			// Wait before retrying
			await sleep(delayMs);
		}
	}

	// This should never be reached, but TypeScript needs it
	throw lastError!;
}

/**
 * Determine if an error should be retried
 *
 * Rules:
 * - Auth errors: NO (credentials are wrong)
 * - Transient errors (network, 500, 503): YES
 * - Rate limiting: YES (with delay)
 * - Other errors: NO
 */
function shouldRetry(error: unknown): boolean {
	// Never retry authentication errors
	if (isAuthError(error)) {
		return false;
	}

	// Retry transient errors (network, 500, 503, timeout)
	if (isTransientError(error)) {
		return true;
	}

	// Retry rate limiting errors
	if (error instanceof CalDAVRateLimitError) {
		return true;
	}

	// Don't retry other errors
	return false;
}

/**
 * Create a custom retry configuration
 */
export function createRetryConfig(
	overrides: Partial<RetryConfig>
): RetryConfig {
	return {
		...DEFAULT_RETRY_CONFIG,
		...overrides,
	};
}
