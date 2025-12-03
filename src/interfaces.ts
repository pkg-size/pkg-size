type FileEntry = {
	path: string;
	size: number;
	sizeGzip: number;
	sizeBrotli: number;
	sizeZstd: number;
};

type PkgSizeData = {
	pkgPath: string;
	tarballSize: number;
	files: FileEntry[];
};

export type {
	FileEntry,
	PkgSizeData,
};
