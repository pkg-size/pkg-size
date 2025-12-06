export type FileEntry = {
	path: string;
	size: number;
	sizeGzip: number;
	sizeBrotli: number;
};

export type PackageSizeResult = {
	pkgPath: string;
	tarballSize: number;
	files: FileEntry[];
	privatePackage: boolean;
};

export type PackageSizeOptions = {

	/**
	 * Which sizes to calculate. Defaults to ['size', 'gzip'].
	 * Available: 'size', 'gzip', 'brotli'
	 */
	sizes?: string[];

	/**
	 * Glob pattern to exclude files from the result.
	 * Files are still included in tarballSize calculation.
	 */
	ignoreFiles?: string;
};
