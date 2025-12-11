import type { PackageReference } from '../types.js';

// Parse pnpm directory name to extract package name and version
//
// Directory name formats:
//   - Standard:   lodash@4.17.21
//   - Scoped:     @scope+name@1.0.0 (+ replaces / in filesystem)
//   - Git refs:   user+repo@commit-hash
//   - Aliases:    npm+package@version
//   - Peer deps:  foo@1.0.0_bar@2.0.0+@scope+qar@3.0.0
//
// Parsing strategy (from pnpm's @pnpm/dependency-path):
//   1. Strip peer dep suffix (everything after first _)
//   2. Find first @ after index 0 - this is the version delimiter
//   3. Everything before is the name, everything after is the version
//
// Why this works: npm package names cannot contain @ except at the start
// for scoped packages (@scope/name). So the first @ after position 0
// always marks where the version begins.
//
// References:
//   - Parse logic: https://github.com/pnpm/pnpm/blob/main/packages/dependency-path/src/index.ts
//   - Dep path spec: https://github.com/pnpm/spec/blob/master/dependency-path.md
//   - depPathToFilename: https://github.com/pnpm/pnpm/blob/main/packages/dependency-path/src/index.ts
//
// Note: pnpm may hash long directory names (>120 chars) with MD5, making them
// unparseable. These directories are skipped gracefully.
export const parsePnpmDirName = (
	dirName: string,
): PackageReference | undefined => {
	// Remove peer dep suffix first (everything after first _)
	let cleanName = dirName;
	const underscoreIndex = cleanName.indexOf('_');
	if (underscoreIndex !== -1) {
		cleanName = cleanName.slice(0, underscoreIndex);
	}

	// Find first @ after index 0 (skips the @ in scoped packages like @scope+name)
	// This matches pnpm's parsing: dependencyPath.indexOf('@', 1)
	const atIndex = cleanName.indexOf('@', 1);
	if (atIndex === -1) {
		return undefined;
	}

	const nameWithPlus = cleanName.slice(0, atIndex);
	const version = cleanName.slice(atIndex + 1);

	if (!version) {
		return undefined;
	}

	// Convert @scope+name to @scope/name for scoped packages
	const name = nameWithPlus.replace('+', '/');

	return {
		name,
		version,
	};
};
