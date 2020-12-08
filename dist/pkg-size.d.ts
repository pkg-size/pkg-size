declare type FileEntry = {
    path: string;
    mode: number;
    size: number;
    sizeGzip: number;
    sizeBrotli: number;
};
declare type PkgSizeData = {
    pkgPath: string;
    tarballSize: number;
    files: FileEntry[];
};
declare function pkgSize(pkgPath?: string): Promise<PkgSizeData>;
export default pkgSize;
