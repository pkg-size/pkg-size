export type PackageFile = {
	path: string;
	size: number;
};

export type InstalledPackage = {
	name: string;
	version: string;
	size: number;
	files: PackageFile[];
	license?: string;
	author?: string;
};

export type NodeModulesAnalysis = {
	packages: InstalledPackage[];
	totalSize: number;
};

export type InstallSizeResult = NodeModulesAnalysis & {
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
