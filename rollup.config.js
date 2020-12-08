import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import {terser} from 'rollup-plugin-terser';
import filesize from 'rollup-plugin-filesize';
import builtins from 'builtin-modules';
import path from 'path';

const pkgSizePath = path.resolve('./src/pkg-size.ts');

const rollupConfig = [
	{
		input: 'src/pkg-size.ts',
		plugins: [
			typescript(),
			commonjs({
				extensions: ['.js', '.ts'],
			}),
			nodeResolve({
				preferBuiltins: false,
			}),
			terser(),
			filesize(),
		],
		external: ['libnpmpack', ...builtins],
		output: {
			format: 'cjs',
			exports: 'default',
			file: 'dist/pkg-size.js',
		},
	},
	{
		input: 'src/cli.ts',
		plugins: [
			typescript(),
			commonjs({
				extensions: ['.js', '.ts'],
			}),
			nodeResolve({
				preferBuiltins: false,
			}),
			terser(),
			filesize(),
		],
		external: [
			pkgSizePath,
			/\.json$/,
			...builtins,
		],
		output: {
			format: 'cjs',
			file: 'dist/cli.js',
			paths: {
				[pkgSizePath]: './pkg-size',
			},
		},
	},
];

export default rollupConfig;
