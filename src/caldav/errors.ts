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
