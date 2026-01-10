/**
 * Replacement for cross-fetch that uses Obsidian's requestUrl API
 * This module will be used to replace cross-fetch at build time
 */

import { obsidianFetch } from "./fetch-adapter";

// Export as default (cross-fetch default export)
export default obsidianFetch;

// Export as named export (cross-fetch named export)
export const fetch = obsidianFetch;

// Re-export global Headers, Request, Response (these are browser globals)
// We need to reference them from globalThis to export
export const Headers = globalThis.Headers;
export const Request = globalThis.Request;
export const Response = globalThis.Response;
