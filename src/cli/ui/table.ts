import ansis from 'ansis';

// Using .length instead of string-width because our aligned columns contain
// only ASCII content (sizes, percentages, package names). Emojis and author
// names appear at the end of lines, not in fixed-width columns.
const getTextWidth = (text: string): number => ansis.strip(text).length;

export const padLeft = (text: string, width: number): string => {
	const textWidth = getTextWidth(text);
	const padding = Math.max(0, width - textWidth);
	return ' '.repeat(padding) + text;
};

export const padRight = (text: string, width: number): string => {
	const textWidth = getTextWidth(text);
	const padding = Math.max(0, width - textWidth);
	return text + ' '.repeat(padding);
};

type PrintRowsOptions = {
	columnGap?: number;
	// 'left' or 'right' for each column, or a single value for all
	align?: 'left' | 'right' | ('left' | 'right')[];
};

export const printRows = (rows: string[][], options: PrintRowsOptions = {}): void => {
	const { columnGap = 2, align = 'right' } = options;

	// Calculate max width for each column
	const columnWidths: number[] = [];
	for (const row of rows) {
		for (let i = 0; i < row.length; i += 1) {
			const width = getTextWidth(row[i]);
			if (!columnWidths[i] || width > columnWidths[i]) {
				columnWidths[i] = width;
			}
		}
	}

	const gap = ' '.repeat(columnGap);

	for (const row of rows) {
		if (row.every(cell => !cell)) {
			console.log('');
		} else {
			const formatted = row.map((cell, i) => {
				const colAlign = Array.isArray(align) ? (align[i] ?? 'right') : align;
				return colAlign === 'left'
					? padRight(cell, columnWidths[i])
					: padLeft(cell, columnWidths[i]);
			});
			console.log(formatted.join(gap));
		}
	}
};
