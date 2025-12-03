<p align="center">
	<br>
	<br>
	<img width="65%" src=".github/screenshot.png">
	<br>
	<br>
	<a href="https://npm.im/pkg-size"><img src="https://badgen.net/npm/v/pkg-size"></a>
	<a href="https://npm.im/pkg-size"><img src="https://badgen.net/npm/dm/pkg-size"></a>
	<a href="https://packagephobia.now.sh/result?p=pkg-size"><img src="https://packagephobia.now.sh/badge?p=pkg-size"></a>
	<br>
	<br>
	<i>Calculate the size of your npm package distribution</i>
</p>

**⚡️ Try it in your npm package**

```sh
$ npx pkg-size
```

### Features
- **🔍 Size analysis** Quickly determine the total size of what you're publishing to npm!
- **🔥 Same behavior as npm `pack`/`publish`** Collects publish files as specified in your `package.json`!
- **🙌 Gzip, Brotli & Zstd** See how your files compress in addition to normal size!
- **🤖 Node.js API** Integrate size checks to your CI via Node.js API

<sub>Support this project by ⭐️ starring and sharing it. [Follow me](https://github.com/privatenumber) to see what other cool projects I'm working on! ❤️</sub>

## 🙋‍♂️ Why?
To quickly determine the uncompressed size, gzip size, brotli size, and zstd size of your package before publishing it to npm.


## 🚀 Install
```sh
npm i pkg-size
```

## 🚦 Quick Usage

### Get the package size by package path
```sh
pkg-size ./package/path
```

### Use brotli compression instead of gzip
```sh
pkg-size --compression=brotli
```

### Use zstd compression
```sh
pkg-size --compression=zstd
```

### Show only uncompressed size
```sh
pkg-size --compression=false
```

### Order files by name
```sh
pkg-size --sort-by=name
```

### Use [IEC units](https://github.com/75lb/byte-size#byte-size) (insted of metric) for size
```sh
pkg-size --unit=iec
```

## ⚙️ CLI Options

### -c, --compression \<algorithm\>
Compression algorithm to display alongside uncompressed size. Options: `gzip`, `brotli`, `zstd`, or `false` to disable. (default: `gzip`)

### -s, --sort-by \<property\>
Sort list by `name`, `size`, or `compressed` (default: `compressed`)

### -u, --unit \<unit\>
Display units: `metric`, `iec`, `metric_octet`, `iec_octet` (default: `metric`)

### -i, --ignore-files \<glob\>
Glob to ignore files from list. Total size will still include them.

### --json
JSON output

### -h, --help
Display this message

### --version
Display version number


## 👷‍♂️ Node.js API
```js
import pkgSize from 'pkg-size'

// Get the package size of the current working directory
const sizeData = await pkgSize(process.cwd(), {
    sizes: ['size', 'gzip', 'brotli', 'zstd']
})

// Get the package size of a specific package path
const sizeDataForPath = await pkgSize('/path/to/package', {
    sizes: ['size', 'gzip']
})
```

### Interface
```ts
type FileEntry = {
    path: string
    size: number
    sizeGzip: number
    sizeBrotli: number
    sizeZstd: number
}

type PkgSizeData = {
    pkgPath: string
    tarballSize: number
    files: FileEntry[]
}

type PkgSizeOptions = {
    sizes: ('size' | 'gzip' | 'brotli' | 'zstd')[]
    ignoreFiles?: string
}

function pkgSize(pkgPath: string, options?: PkgSizeOptions): Promise<PkgSizeData>
```


## 👨‍👩‍👦 Related

### [pkg-size action](https://github.com/pkg-size/action) 
A GitHub Action to automate package size regression reports on your pull requests—great for size-conscious development.
