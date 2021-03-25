import { PkgSizeData } from './interfaces';

declare function pkgSize(pkgPath?: string): Promise<PkgSizeData>;

export default pkgSize;
