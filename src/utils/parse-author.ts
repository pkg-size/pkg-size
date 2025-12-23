import parseAuthorLib from 'parse-author';

export type ParsedAuthor = {
	name?: string;
	email?: string;
	url?: string;
};

// Strip surrounding quotes (single or double) from a string
// parse-author doesn't handle quoted names like "'Julian Viereck'"
const unquote = (string: string): string => {
	if (
		(string.startsWith('"') && string.endsWith('"'))
		|| (string.startsWith("'") && string.endsWith("'"))
	) {
		return string.slice(1, -1);
	}
	return string;
};

export const parseAuthor = (author: string): ParsedAuthor | null => {
	const trimmed = author.trim();
	if (!trimmed) {
		return null;
	}

	const result = parseAuthorLib(trimmed) as ParsedAuthor;

	// Fallback: If parse-author couldn't extract any structure (e.g. CJK names,
	// broken brackets), treat the raw input as the name to prevent data loss
	if (Object.keys(result).length === 0) {
		return { name: unquote(trimmed) };
	}

	// Strip surrounding quotes from name (parse-author doesn't handle this)
	if (result.name) {
		result.name = unquote(result.name);
	}

	return result;
};

/**
 * Get a display string for an author, with fallback chain:
 * name → email → url → null
 */
export const getAuthorDisplayName = (author: ParsedAuthor | null | undefined): string | null => {
	if (!author) {
		return null;
	}
	return author.name ?? author.email ?? author.url ?? null;
};
