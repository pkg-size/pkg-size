<p align="center">
	<img width="70%" src=".github/screenshot.png">
	<br>
	<a href="https://npm.im/distsize"><img src="https://badgen.net/npm/v/distsize"></a>
	<a href="https://npm.im/distsize"><img src="https://badgen.net/npm/dm/distsize"></a>
	<a href="https://packagephobia.now.sh/result?p=distsize"><img src="https://packagephobia.now.sh/badge?p=distsize"></a>
	<br>
	<br>
	<i>Measure the size of your npm package distribution</i>
</p>

⚡️ Try it in your npm package:

```sh
$ npx distsize
```

<sub>If you like this project, please star it & [follow me](https://github.com/privatenumber) to see what other cool projects I'm working on! ❤️</sub>

## 🙋‍♂️ Why?
- **🔍 Size analysis** Quickly determine the total size of what you're publishing to npm!
- **🔥 Same behavior as npm `pack`/`publish`** Collects publish files as specified in your `package.json`!
- **🙌 Gzip & Brotli** See how your files compress in addition to normal size!
- **🤖 Node.js API** Integrate size checks to your CI via Node.js API

## 🚀 Install
```sh
npm i distsize
```

## 🚦 Quick Usage
```js
const distsize = require('distsize');

// Get distsize data from current working directory
const distsizeData = await distsize();

// Get distsize data from a specific package path
const distsizeData = await distsize('/path/to/package');
```

## ⚙️ API
```ts
type FileEntry = {
    path: string;
    mode: number;
    size: number;
    sizeGzip: number;
    sizeBrotli: number;
};

type Distsize = {
    pkgPath: string;
    files: FileEntry[];
};

function distsize(pkgPath?: string): Promise<Distsize>;
```
