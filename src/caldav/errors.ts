/**
 * CalDAV-specific error types
 * Based on contracts/caldav-api.md specification
 */

/**
 * Base error class for CalDAV operations
 */
export class CalDAVError extends Error {
	statusCode?: number;
	serverMessage?: string;

	constructor(message: string, statusCode?: number, serverMessage?: string) {
		super(message);
		this.name = 'CalDAVError';
		this.statusCode = statusCode;
		this.serverMessage = serverMessage;

		// Maintains proper stack trace for where error was thrown (V8 only)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, CalDAVError);
		}
	}
}

/**
 * Authentication error (401/403)
 */
export class CalDAVAuthError extends CalDAVError {
	constructor(message: string) {
		super(message, 401);
		this.name = 'CalDAVAuthError';
	}
}

/**
 * Network connectivity error
 */
export class CalDAVNetworkError extends CalDAVError {
	constructor(message: string) {
		super(message);
		this.name = 'CalDAVNetworkError';
	}
}

/**
 * Conflict error (412 Precondition Failed - ETag mismatch)
 */
export class CalDAVConflictError extends CalDAVError {
	currentEtag: string;

	constructor(message: string, currentEtag: string) {
		super(message, 412);
		this.name = 'CalDAVConflictError';
		this.currentEtag = currentEtag;
	}
}

/**
 * Server error (500/503)
 * Transient error that may succeed on retry
 */
export class CalDAVServerError extends CalDAVError {
	constructor(message: string, statusCode: number) {
		super(message, statusCode);
		this.name = 'CalDAVServerError';
	}
}

/**
 * Timeout error
 * Network request took too long
 */
export class CalDAVTimeoutError extends CalDAVError {
	constructor(message: string) {
		super(message);
		this.name = 'CalDAVTimeoutError';
	}
}

/**
 * Rate limit error (429 Too Many Requests)
 */
export class CalDAVRateLimitError extends CalDAVError {
	retryAfter?: number; // Seconds to wait before retrying

	constructor(message: string, retryAfter?: number) {
		super(message, 429);
		this.name = 'CalDAVRateLimitError';
		this.retryAfter = retryAfter;
	}
}

/**
 * Check if an error is transient and should be retried
 */
export function isTransientError(error: unknown): boolean {
	if (error instanceof CalDAVServerError) {
		return true;
	}
	if (error instanceof CalDAVTimeoutError) {
		return true;
	}
	if (error instanceof CalDAVNetworkError) {
		return true;
	}
	return false;
}

/**
 * Check if an error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
	return error instanceof CalDAVAuthError;
}

/**
 * Check if an error is a conflict error
 */
export function isConflictError(error: unknown): boolean {
	return error instanceof CalDAVConflictError;
}
