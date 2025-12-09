export type ParsedAuthor = {
	name: string;
	url?: string;
} | null;

export const parseAuthor = (author: string): ParsedAuthor => {
	// Strip email in angle brackets: "Name <email>" → "Name"
	const name = author.replaceAll(/<[^>]+>/g, '').trim();

	// Check for URL in parentheses: "Name (url)"
	const urlMatch = name.match(/^(.+?)\s*\((.+)\)$/);
	if (urlMatch) {
		const [, authorName, url] = urlMatch;
		const trimmedName = authorName.trim();
		if (!trimmedName) {
			return null;
		}
		if (url.startsWith('http://') || url.startsWith('https://')) {
			return {
				name: trimmedName,
				url,
			};
		}
		return { name: trimmedName };
	}

	// Skip if empty
	if (!name) {
		return null;
	}

	// If name contains @, try to strip social handles like "@sokra" or "@ handle"
	// Handles are typically: space(s) + @ + alphanumeric/hyphen/underscore
	if (name.includes('@')) {
		const withoutHandle = name.replaceAll(/\s+@[\w-]+/g, '').trim();
		// If nothing remains, it was just an email or handle
		if (!withoutHandle) {
			return null;
		}
		return { name: withoutHandle };
	}

	return { name };
};
