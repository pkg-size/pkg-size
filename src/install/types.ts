export type PackageEntry = {
	name: string;
	size: number;
	files: number;
};

export type InstallSizeResult = {
	packages: PackageEntry[];
	totalSize: number;
	totalFiles: number;
	installTime: number;
	packageManager: string;
};

export type InstallSizeOptions = {

	/**
	 * Package manager to use. Auto-detected from npm_config_user_agent by default.
	 * Available: 'npm', 'pnpm', 'yarn'
	 */
	packageManager?: string;
};

// Internal type
export type SizeResult = {
	size: number;
	files: number;
};
