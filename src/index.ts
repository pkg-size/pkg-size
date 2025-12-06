// Local package size analysis
export { getPackageSize } from './local/index.js';
export type {
	FileEntry,
	PackageSizeResult,
	PackageSizeOptions,
} from './local/types.js';

// Install size analysis
export { getInstallSize } from './install/index.js';
export type {
	PackageEntry,
	InstallSizeResult,
	InstallSizeOptions,
} from './install/types.js';
