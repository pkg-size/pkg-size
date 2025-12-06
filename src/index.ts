// Local package size analysis
export { getPackageSize } from './local/index.js';
export type {
	FileEntry,
	PackageSizeResult,
	PackageSizeOptions,
} from './local/types.js';

// Install size analysis
export { getInstallSize } from './install/index.js';
export { analyzeNodeModules } from './install/analyze-node-modules.js';
export type {
	PackageFile,
	InstalledPackage,
	NodeModulesAnalysis,
	InstallSizeResult,
	InstallSizeOptions,
} from './install/types.js';
