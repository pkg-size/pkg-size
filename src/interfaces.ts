export type FileEntry = {
	path: string;
	size: number;
	sizeGzip: number;
	sizeBrotli: number;
};

export type PkgSizeData = {
	pkgPath: string;
	tarballSize: number;
	files: FileEntry[];
};

export const SizeMap = {
	size: {
		property: 'size',
		label: 'Size',
	},
	brotli: {
		property: 'sizeBrotli',
		label: 'Brotli',
	},
	gzip: {
		property: 'sizeGzip',
		label: 'Gzip',
	},
} as const;

export type Sizes = keyof typeof SizeMap;
