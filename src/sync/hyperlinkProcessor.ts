import { HyperlinkSyncMode } from "../types";

/** A single extracted markdown hyperlink */
export interface MarkdownHyperlink {
	displayText: string;
	url: string;
	raw: string;
}

/** Output of processDescription */
export interface ProcessedDescription {
	summary: string;
	extractedLinksBlock: string;
}

// Matches [text](http(s)://url) — global flag for matchAll
export const MARKDOWN_HYPERLINK_REGEX = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;

/** Extract all well-formed markdown hyperlinks from a string */
export function extractHyperlinks(description: string): MarkdownHyperlink[] {
	const links: MarkdownHyperlink[] = [];
	for (const match of description.matchAll(MARKDOWN_HYPERLINK_REGEX)) {
		links.push({
			displayText: match[1] ?? "",
			url: match[2] ?? "",
			raw: match[0],
		});
	}
	return links;
}

/** Replace hyperlinks with display text, normalize whitespace */
export function stripHyperlinksFromSummary(
	description: string,
	links: MarkdownHyperlink[]
): string {
	let result = description;
	for (const link of links) {
		result = result.replace(link.raw, link.displayText);
	}
	return result.replace(/\s+/g, " ").trim();
}

/** Format extracted links as a plain-text block for DESCRIPTION */
export function formatLinksBlock(links: MarkdownHyperlink[]): string {
	const lines = links.map((link) => {
		const label = link.displayText || link.url;
		return `- ${label}: ${link.url}`;
	});
	return `Links:\n${lines.join("\n")}`;
}

/**
 * Main entry point: process a description according to the active mode.
 * Never throws. Never returns an empty summary.
 */
export function processDescription(
	description: string,
	mode: HyperlinkSyncMode
): ProcessedDescription {
	if (mode === HyperlinkSyncMode.Keep) {
		return { summary: description, extractedLinksBlock: "" };
	}

	const links = extractHyperlinks(description);
	if (links.length === 0) {
		return { summary: description, extractedLinksBlock: "" };
	}

	const processedSummary = stripHyperlinksFromSummary(description, links);

	// Empty summary guard
	if (!processedSummary.trim()) {
		return { summary: description, extractedLinksBlock: "" };
	}

	const extractedLinksBlock =
		mode === HyperlinkSyncMode.Move ? formatLinksBlock(links) : "";

	return { summary: processedSummary, extractedLinksBlock };
}
