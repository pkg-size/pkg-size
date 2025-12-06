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
- **🙌 Gzip & Brotli** See how your files compress in addition to normal size!
- **📦 Install size** Measure the install size of any npm package (including all dependencies)!
- **🤖 Node.js API** Integrate size checks to your CI via Node.js API

<sub>Support this project by ⭐️ starring and sharing it. [Follow me](https://github.com/privatenumber) to see what other cool projects I'm working on! ❤️</sub>

## 🙋‍♂️ Why?
To quickly determine the uncompressed size, gzip size, and brotli size of your package before publishing it to npm.


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

### Show only uncompressed size
```sh
pkg-size --compression=false
```

### Order files by name
```sh
pkg-size --sort-by=name
```

## 📦 Install Size Mode

Measure the install size of npm packages (including all transitive dependencies):

```sh
# Measure install size of packages
pkg-size lodash react vue

# Measure scoped packages
pkg-size @babel/core typescript

# Use a specific package manager
pkg-size react --package-manager=pnpm

# JSON output
pkg-size lodash --json
```

This mode installs the specified packages in a temporary directory and measures the total `node_modules` size.

## ⚙️ CLI Options

### -c, --compression \<algorithm\>
Compression algorithm to display alongside uncompressed size. Options: `gzip`, `brotli`, or `false` to disable. (default: `gzip`)

### -s, --sort-by \<property\>
Sort list by `name`, `size`, or `compressed` (default: `compressed`)

### -i, --ignore-files \<glob\>
Glob to ignore files from list. Total size will still include them.

### --json
JSON output

### -p, --package-manager \<manager\>
Package manager to use for install size mode. Options: `npm`, `pnpm`, `yarn`. Auto-detected from `npm_config_user_agent` by default.

### -h, --help
Display this message

### --version
Display version number


## 👷‍♂️ Node.js API

### getPackageSize

Analyze the publish size of a local package:

```js
import { getPackageSize } from 'pkg-size'

// Get the package size of the current working directory
const result = await getPackageSize(process.cwd())

// With options
const resultWithOptions = await getPackageSize('/path/to/package', {
    sizes: ['size', 'gzip', 'brotli'],
    ignoreFiles: '*.map'
})
```

#### Types
```ts
type FileEntry = {
    path: string
    size: number
    sizeGzip: number
    sizeBrotli: number
}

type PackageSizeResult = {
    pkgPath: string
    tarballSize: number
    files: FileEntry[]
}

type PackageSizeOptions = {
    // default: ['size', 'gzip']
    sizes?: ('size' | 'gzip' | 'brotli')[]
    ignoreFiles?: string
}

function getPackageSize(pkgPath: string, options?: PackageSizeOptions): Promise<PackageSizeResult>
```

### getInstallSize

Measure the install size of npm packages (including all dependencies):

```js
import { getInstallSize } from 'pkg-size'

// Single package
const result = await getInstallSize(['lodash'])

// Multiple packages
const multiResult = await getInstallSize(['lodash', 'react', '@babel/core'])

// Also accepts space-delimited string
const stringResult = await getInstallSize('lodash react')
```

#### Types
```ts
type PackageFile = {
    path: string
    size: number
}

type InstalledPackage = {
    name: string
    size: number
    files: PackageFile[]
}

type InstallSizeResult = {
    packages: InstalledPackage[]
    totalSize: number
    installTime: number
    packageManager: string
}

type InstallSizeOptions = {
    // auto-detected by default
    packageManager?: 'npm' | 'pnpm' | 'yarn'
}

function getInstallSize(
    packages: string | string[],
    options?: InstallSizeOptions
): Promise<InstallSizeResult>
```


## 👨‍👩‍👦 Related

### [pkg-size action](https://github.com/pkg-size/action) 
A GitHub Action to automate package size regression reports on your pull requests—great for size-conscious development.
