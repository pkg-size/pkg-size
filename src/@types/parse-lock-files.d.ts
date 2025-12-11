declare module 'parse-lock-files' {
	type LockfileType = 'npm' | 'yarn-v1' | 'yarn-berry' | 'pnpm';

	type PackageInfo = {
		version: string | null;
		resolved: string | null;
		integrity: string | null;
		dependencies: Record<string, string>;
		devDependencies: Record<string, string>;
		optionalDependencies: Record<string, string>;
		peerDependencies: Record<string, string>;
		engines: Record<string, string>;
	};

	type NpmLockfile = {
		type: 'npm';
		lockfileVersion: number;
		name?: string;
		version?: string;
		packages: Record<string, PackageInfo & {
			license?: string;
			bin?: Record<string, string>;
			funding?: string | { url: string };
			cpu?: string[];
			os?: string[];
		}>;
		dependencies?: Record<string, unknown>;
		requires?: boolean;
	};

	type YarnV1Lockfile = {
		type: 'yarn';
		version: 1;
		packages: Record<string, PackageInfo>;
	};

	type YarnBerryLockfile = {
		type: 'yarn-berry';
		version: number;
		packages: Record<string, PackageInfo>;
	};

	type PnpmLockfile = {
		type: 'pnpm';
		lockfileVersion: string | number;
		settings?: Record<string, unknown>;
		importers?: Record<string, unknown>;
		dependencies?: Record<string, unknown>;
		devDependencies?: Record<string, unknown>;
		specifiers?: Record<string, string>;
		packages: Record<string, PackageInfo & {
			dev?: boolean;
			optional?: boolean;
			hasBin?: boolean;
			cpu?: string[];
			os?: string[];
		}>;
		snapshots?: Record<string, unknown>;
	};

	type ParsedLockfile = NpmLockfile | YarnV1Lockfile | YarnBerryLockfile | PnpmLockfile;

	export function detectLockfileType(content: string): LockfileType | null;
	export function parseLockfile(content: string): ParsedLockfile;
	export function findLockfile(directory: string): Promise<string>;
	export function findAndParseLockfile(directory: string): Promise<ParsedLockfile>;

	export function parseNpmLockfile(content: string): NpmLockfile;
	export function parseYarnV1Lockfile(content: string): YarnV1Lockfile;
	export function parseYarnBerryLockfile(content: string): YarnBerryLockfile;
	export function parsePnpmLockfile(content: string): PnpmLockfile;
}
