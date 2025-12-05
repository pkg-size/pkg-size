declare module 'npm-packlist' {
	type MinimalTree = {
		path: string;
		package: Record<string, unknown>;
		edgesOut: Map<unknown, unknown>;
	};
	const packlist: (tree: MinimalTree) => Promise<string[]>;
	export default packlist;
}
