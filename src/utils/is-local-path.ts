import path from 'node:path';

// Only explicit path indicators - no fs.existsSync to avoid shadowing
// (e.g., a folder named "test" shouldn't shadow the npm package "test")
export const isLocalPath = (argument: string): boolean => (
	argument.startsWith('.') || path.isAbsolute(argument)
);
