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

### Skip brotli size calculation
```sh
pkg-size --sizes=size,gzip
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

### -S, --sizes <sizes>
Comma separated list of sizes to show (size, gzip, brotli) (default: size,gzip,brotli)

### -s, --sort-by <property>
Sort list by (name, size, gzip, brotli) (default: brotli)

### -u, --unit <unit>
Display units (metric, iec, metric_octet, iec_octet) (default: metric)

### -i, --ignore-files <glob>
Glob to ignores files from list. Total size will still include them.

### --json
JSON output

### -h, --help
Display this message

### -v, --version
Display version number


## 👷‍♂️ Node.js API
```js
const pkgSize = require('pkg-size')

// Get the package size of the current working directory
const sizeData = await pkgSize()

// ... Or get the package size of a specific package path
const sizeDataForPath = await pkgSize('/path/to/package')
```

### Interface
```ts
type FileEntry = {
    path: string
    size: number
    sizeGzip: number
    sizeBrotli: number
}

type PkgSizeData = {
    pkgPath: string
    tarballSize: number
    files: FileEntry[]
}

function pkgSize(pkgPath?: string): Promise<PkgSizeData>
```


## 👨‍👩‍👦 Related

### [pkg-size action](https://github.com/pkg-size/action) 
A GitHub Action to automate package size regression reports on your pull requests—great for size-conscious development.
