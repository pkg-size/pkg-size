declare module 'npm-packlist' {
	const packlist: (options: { path: string }) => Promise<string[]>;
	export default packlist;
}

declare module 'tar-fs' {
	import type { Readable } from 'stream';

	export function pack(cwd: string, options?: { entries?: string[] }): Readable;
}

declare module 'byte-size' {
	type ByteSizeResult = {
		value: string;
		unit: string;
		long: string;
		toString: () => string;
	};
	const byteSize: (bytes: number, options?: { units?: string }) => ByteSizeResult;
	export default byteSize;
}
