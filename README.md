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

Command-line tool to:
- Analyze the publish size of your npm package (what gets uploaded to npm)
- Measure the install size of any npm packages (including all dependencies)
- Analyze your existing `node_modules` directory

**Curious how big your npm package's publish size is?**

Try it in your package:
```sh
npx pkg-size publish
```

<sub>Support this project by ⭐️ starring and sharing it. [Follow me](https://github.com/privatenumber) to see what other cool projects I'm working on! ❤️</sub>

## 🚦 Quick Usage

pkg-size has three subcommands:

### `publish` - Analyze publish size

Analyze what will be published to npm:

```sh
# Analyze current directory
npx pkg-size publish

# Analyze specific package path
npx pkg-size publish ./package/path

# Order files by name
npx pkg-size publish --sort-by=name

# Use brotli compression instead of gzip
npx pkg-size publish --compression=brotli

# Show only uncompressed size
npx pkg-size publish --compression=false

# JSON output
npx pkg-size publish --json
```

### `install` - Measure install size

Measure the install size of npm packages (including all transitive dependencies):

```sh
# Measure install size of a package
npx pkg-size install lodash

# Measure install size of packages
npx pkg-size install lodash @babel/core typescript

# Use a specific package manager
npx pkg-size install react --package-manager=pnpm

# Group by scope (e.g., @babel/*)
npx pkg-size install @babel/core --group=scope

# JSON output
npx pkg-size install lodash --json
```

This mode installs the specified packages in a temporary directory and measures the total `node_modules` size.

### `analyze` - Analyze existing node_modules

Analyze an existing `node_modules` directory:

```sh
# Analyze current directory's node_modules
npx pkg-size analyze

# Analyze specific project path
npx pkg-size analyze ./path/to/project

# Sort by name
npx pkg-size analyze --sort-by=name

# Group by scope (e.g., @babel/*)
npx pkg-size analyze --group=scope

# JSON output
npx pkg-size analyze --json
```

## ⚙️ CLI Options

### `publish` options

#### -c, --compression \<algorithm\>
Compression algorithm to display alongside uncompressed size. Options: `gzip`, `brotli`, or `false` to disable. (default: `gzip`)

#### -s, --sort-by \<property\>
Sort list by `name`, `size`, or `compressed` (default: `compressed`)

#### -i, --ignore-files \<glob\>
Glob to ignore files from list. Total size will still include them.

#### --json
JSON output

### `install` options

#### -p, --package-manager \<manager\>
Package manager to use. Options: `npm`, `pnpm`, `yarn`. Auto-detected from `npm_config_user_agent` by default.

#### -s, --sort-by \<property\>
Sort list by `name` or `size` (default: `size`)

#### -g, --group \<type\>
Group packages by `scope`. Scoped packages (e.g., `@babel/core`) are grouped under their organization.

#### --json
JSON output

### `analyze` options

#### -s, --sort-by \<property\>
Sort list by `name` or `size` (default: `size`)

#### -g, --group \<type\>
Group packages by `scope`. Scoped packages (e.g., `@babel/core`) are grouped under their organization.

#### --json
JSON output

### Global options

#### -h, --help
Display help message

#### --version
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
    packagePath: string
    tarballSize: number
    files: FileEntry[]
    privatePackage: boolean
}

type PackageSizeOptions = {
    // default: ['size', 'gzip']
    sizes?: ('size' | 'gzip' | 'brotli')[]
    ignoreFiles?: string
}

function getPackageSize(
    packagePath: string,
    options?: PackageSizeOptions
): Promise<PackageSizeResult>
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
    // defaults to os.tmpdir()
    tempDirectory?: string
}

function getInstallSize(
    packages: string | string[],
    options?: InstallSizeOptions
): Promise<InstallSizeResult>
```

### analyzeNodeModules

Analyze an existing `node_modules` directory:

```js
import { analyzeNodeModules } from 'pkg-size'

// Analyze current directory's node_modules
const result = await analyzeNodeModules(process.cwd())

// Analyze specific project path
const otherResult = await analyzeNodeModules('/path/to/project')
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

type NodeModulesAnalysis = {
    packages: InstalledPackage[]
    totalSize: number
}

function analyzeNodeModules(
    projectPath: string
): Promise<NodeModulesAnalysis>
```


## 👨‍👩‍👦 Related

### [pkg-size action](https://github.com/pkg-size/action) 
A GitHub Action to automate package size regression reports on your pull requests—great for size-conscious development.
