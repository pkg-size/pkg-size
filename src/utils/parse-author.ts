export type ParsedAuthor = {
	name: string;
	url?: string;
} | null;

export const parseAuthor = (author: string): ParsedAuthor => {
	// Strip email in angle brackets: "Name <email>" → "Name"
	let name = author.replace(/<[^>]+>/g, '').trim();

	// Check for URL in parentheses: "Name (url)"
	const urlMatch = name.match(/^(.+?)\s*\((.+)\)$/);
	if (urlMatch) {
		const [, authorName, url] = urlMatch;
		const trimmedName = authorName.trim();
		if (!trimmedName) {
			return null;
		}
		if (url.startsWith('http://') || url.startsWith('https://')) {
			return { name: trimmedName, url };
		}
		return { name: trimmedName };
	}

	// Skip if what remains is empty or just an email (no name)
	if (!name || name.includes('@')) {
		return null;
	}

	return { name };
};
