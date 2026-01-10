/**
 * Fetch adapter for Obsidian's requestUrl API
 * This bypasses CORS restrictions by using Obsidian's native request API
 */

import { requestUrl, RequestUrlParam, RequestUrlResponse } from "obsidian";

/**
 * Convert Obsidian's RequestUrlResponse to a Fetch API Response-like object
 */
class ObsidianResponse implements Response {
	readonly headers: Headers;
	readonly ok: boolean;
	readonly redirected: boolean = false;
	readonly status: number;
	readonly statusText: string;
	readonly type: ResponseType = "basic";
	readonly url: string = "";
	readonly bodyUsed: boolean = false;
	private _body: ArrayBuffer;

	constructor(response: RequestUrlResponse) {
		this.status = response.status;
		this.statusText = String(response.status);
		this.ok = response.status >= 200 && response.status < 300;

		// Convert headers to Headers object
		this.headers = new Headers();
		if (response.headers) {
			for (const [key, value] of Object.entries(response.headers)) {
				this.headers.set(key, value);
			}
		}

		// Store body as ArrayBuffer
		this._body = response.arrayBuffer;
	}

	async arrayBuffer(): Promise<ArrayBuffer> {
		return this._body;
	}

	async blob(): Promise<Blob> {
		return new Blob([this._body]);
	}

	async bytes(): Promise<Uint8Array> {
		return new Uint8Array(this._body);
	}

	async formData(): Promise<FormData> {
		throw new Error("formData() not implemented");
	}

	async json(): Promise<unknown> {
		const text = await this.text();
		return JSON.parse(text);
	}

	async text(): Promise<string> {
		const decoder = new TextDecoder();
		return decoder.decode(this._body);
	}

	clone(): Response {
		throw new Error("clone() not implemented");
	}

	get body(): ReadableStream<Uint8Array> | null {
		throw new Error("body stream not implemented");
	}
}

/**
 * Custom fetch function that uses Obsidian's requestUrl
 * This bypasses CORS restrictions
 */
export async function obsidianFetch(
	input: RequestInfo | URL,
	init?: RequestInit
): Promise<Response> {
	const url = typeof input === "string" ? input : input.toString();

	const requestParams: RequestUrlParam = {
		url,
		method: init?.method || "GET",
		headers: {},
		body: undefined,
		throw: false, // Don't throw on HTTP errors, let tsdav handle them
	};

	// Convert Headers object to plain object
	if (init?.headers) {
		if (init.headers instanceof Headers) {
			init.headers.forEach((value, key) => {
				if (requestParams.headers) {
					requestParams.headers[key] = value;
				}
			});
		} else if (Array.isArray(init.headers)) {
			init.headers.forEach(([key, value]) => {
				if (requestParams.headers) {
					requestParams.headers[key] = value;
				}
			});
		} else {
			requestParams.headers = init.headers as Record<string, string>;
		}
	}

	// Handle body
	if (init?.body) {
		if (typeof init.body === "string") {
			requestParams.body = init.body;
		} else if (init.body instanceof ArrayBuffer) {
			requestParams.body = new TextDecoder().decode(init.body);
		} else if (init.body instanceof Blob) {
			requestParams.body = await init.body.text();
		} else {
			requestParams.body = String(init.body);
		}
	}

	try {
		const response = await requestUrl(requestParams);
		return new ObsidianResponse(response);
	} catch (error) {
		// requestUrl throws on network errors
		throw error;
	}
}
