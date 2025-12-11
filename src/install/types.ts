export type PackageFile = {
	path: string;
	size: number;
};

export type PackageReference = {
	name: string;
	version: string;
};

export type InstalledPackage = {
	name: string;
	version: string;
	size: number;
	files: PackageFile[];
	license?: string;
	author?: string;
	repository?: string;
	homepage?: string;
	funding?: string;
	// Dependency chain showing how this package was installed
	installedBy: PackageReference[];
	// Filesystem path to the package directory (relative to cwd)
	path: string;
	dependencySize: number;
	dependencyCount: number;
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

	/**
	 * Include dependency path data (installedBy chain).
	 * Requires parsing lockfile which adds overhead for large projects.
	 * Defaults to false.
	 */
	verbose?: boolean;
};

// Internal type
export type SizeResult = {
	size: number;
	files: PackageFile[];
};
