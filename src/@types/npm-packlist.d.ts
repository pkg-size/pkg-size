declare module 'npm-packlist' {
	import { PackageJson } from 'type-fest';
	type MinimalTree = {
		path: string;
		package: PackageJson;
		edgesOut: Map<unknown, unknown>;
	};
	const packlist: (tree: MinimalTree) => Promise<string[]>;
	export default packlist;
}
