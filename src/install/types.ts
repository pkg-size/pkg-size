export type PackageEntry = {
	name: string;
	size: number;
	files: number;
};

export type InstallSizeData = {
	packages: PackageEntry[];
	totalSize: number;
	totalFiles: number;
	installTime: number;
	packageManager: string;
};

export type InstallSizeOptions = {
	packageManager?: string;
};

export type SizeResult = {
	size: number;
	files: number;
};
