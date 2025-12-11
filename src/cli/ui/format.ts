import byteSize from 'byte-size';

export const formatSize = (bytes: number): string => byteSize(bytes).toString();
