declare type FileEntry = {
    path: string;
    size: number;
    sizeGzip: number;
    sizeBrotli: number;
};
declare type PkgSizeData = {
    pkgPath: string;
    tarballSize: number;
    files: FileEntry[];
};

export { FileEntry, PkgSizeData };
