export type PackageFile = {
	path: string;
	size: number;
};

export type InstalledPackage = {
	name: string;
	size: number;
	files: PackageFile[];
};

export type InstallSizeResult = {
	packages: InstalledPackage[];
	totalSize: number;
	installTime: number;
	packageManager: string;
};

export type InstallSizeOptions = {

	/**
	 * Package manager to use. Auto-detected from npm_config_user_agent by default.
	 * Available: 'npm', 'pnpm', 'yarn'
	 */
	packageManager?: string;

	/**
	 * Parent directory for creating the temporary install directory.
	 * Defaults to os.tmpdir().
	 */
	tempDirectory?: string;
};

// Internal type
export type SizeResult = {
	size: number;
	files: PackageFile[];
};
