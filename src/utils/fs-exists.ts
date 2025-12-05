import fsp from 'node:fs/promises';

export const fsExists = (filePath: string) => fsp.access(filePath).then(() => true, () => false);
