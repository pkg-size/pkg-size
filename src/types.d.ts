declare module 'npm-packlist' {
	const packlist: (options: { path: string }) => Promise<string[]>;
	export default packlist;
}
