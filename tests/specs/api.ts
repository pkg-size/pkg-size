import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import pkgSize from '../../src/index.js';

export default testSuite(({ describe }) => {
	describe('API', ({ test }) => {
		test('exports a function', () => {
			expect(typeof pkgSize).toBe('function');
		});

		test('returns package size data', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'index.js': 'module.exports = "hello";',
			});

			const result = await pkgSize(fixture.path, {
				sizes: ['size', 'gzip', 'brotli', 'zstd'],
			});

			expect(result.pkgPath).toBe(fixture.path);
			expect(typeof result.tarballSize).toBe('number');
			expect(result.tarballSize).toBeGreaterThan(0);
			expect(Array.isArray(result.files)).toBe(true);
			expect(result.files.length).toBe(2);
		});

		test('calculates file sizes correctly', async () => {
			const content = 'x'.repeat(1000);

			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'data.txt': content,
			});

			const result = await pkgSize(fixture.path, {
				sizes: ['size', 'gzip', 'brotli', 'zstd'],
			});

			const dataFile = result.files.find(file => file.path === 'data.txt');
			expect(dataFile).toBeDefined();
			expect(dataFile!.size).toBe(1000);
			expect(dataFile!.sizeGzip).toBeLessThan(dataFile!.size);
			expect(dataFile!.sizeBrotli).toBeLessThan(dataFile!.size);
			expect(dataFile!.sizeZstd).toBeLessThan(dataFile!.size);
		});

		test('respects .npmignore', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'index.js': 'module.exports = 1;',
				'ignored.js': 'ignored content',
				'.npmignore': 'ignored.js',
			});

			const result = await pkgSize(fixture.path, {
				sizes: ['size'],
			});

			const ignoredFile = result.files.find(file => file.path === 'ignored.js');
			expect(ignoredFile).toBeUndefined();
		});

		test('respects files field in package.json', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
					files: ['dist'],
				}),
				'src/index.js': 'source',
				'dist/index.js': 'built',
			});

			const result = await pkgSize(fixture.path, {
				sizes: ['size'],
			});

			const srcFile = result.files.find(file => file.path === 'src/index.js');
			const distFile = result.files.find(file => file.path === 'dist/index.js');
			expect(srcFile).toBeUndefined();
			expect(distFile).toBeDefined();
		});

		test('supports ignoreFiles option', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'index.js': 'main',
				'types.d.ts': 'types',
			});

			const result = await pkgSize(fixture.path, {
				sizes: ['size'],
				ignoreFiles: '*.d.ts',
			});

			const typesFile = result.files.find(file => file.path === 'types.d.ts');
			expect(typesFile).toBeUndefined();
		});

		test('calculates only requested sizes', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'index.js': 'content',
			});

			const result = await pkgSize(fixture.path, {
				sizes: ['size'],
			});

			const indexFile = result.files.find(file => file.path === 'index.js');
			expect(indexFile!.size).toBeGreaterThan(0);
			expect(indexFile!.sizeGzip).toBe(0);
			expect(indexFile!.sizeBrotli).toBe(0);
			expect(indexFile!.sizeZstd).toBe(0);
		});

		test('works without options', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'index.js': 'content',
			});

			const result = await pkgSize(fixture.path);

			expect(result.pkgPath).toBe(fixture.path);
			expect(result.tarballSize).toBeGreaterThan(0);
			expect(result.files.length).toBe(2);
		});

		test('tarball is gzip compressed', async () => {
			const largeContent = 'x'.repeat(10_000);

			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'large.txt': largeContent,
			});

			const result = await pkgSize(fixture.path, {
				sizes: ['size'],
			});

			const largeFile = result.files.find(file => file.path === 'large.txt');
			// Tarball should be smaller than uncompressed file due to gzip
			expect(result.tarballSize).toBeLessThan(largeFile!.size);
		});
	});
});
