import path from 'node:path';

export const detectPackageManager = (): string => {
	const agent = process.env.npm_config_user_agent || '';
	if (agent.startsWith('pnpm')) {
		return 'pnpm';
	}
	if (agent.startsWith('yarn')) {
		return 'yarn';
	}
	return 'npm';
};

// Only explicit path indicators - no fs.existsSync to avoid shadowing
// (e.g., a folder named "test" shouldn't shadow the npm package "test")
export const isLocalPath = (argument: string): boolean => (
	argument.startsWith('.') || path.isAbsolute(argument)
);
