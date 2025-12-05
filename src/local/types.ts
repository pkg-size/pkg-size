export type FileEntry = {
	path: string;
	size: number;
	sizeGzip: number;
	sizeBrotli: number;
	sizeZstd: number;
};

export type PkgSizeData = {
	pkgPath: string;
	tarballSize: number;
	files: FileEntry[];
};

export type PkgSizeOptions = {
	sizes: string[];
	ignoreFiles?: string;
};
