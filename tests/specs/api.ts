import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { getPackageSize, getInstallSize } from '../../src/index.js';
import { detectPackageManager } from '../../src/utils/package-manager.js';

export default testSuite(({ describe }) => {
	describe('API', ({ describe }) => {
		describe('Local Mode', ({ test }) => {
			test('returns package size data', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'module.exports = "hello";',
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size', 'gzip', 'brotli'],
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

				const result = await getPackageSize(fixture.path, {
					sizes: ['size', 'gzip', 'brotli'],
				});

				const dataFile = result.files.find(file => file.path === 'data.txt');
				expect(dataFile).toBeDefined();
				expect(dataFile!.size).toBe(1000);
				expect(dataFile!.sizeGzip).toBeLessThan(dataFile!.size);
				expect(dataFile!.sizeBrotli).toBeLessThan(dataFile!.size);
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

				const result = await getPackageSize(fixture.path, {
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

				const result = await getPackageSize(fixture.path, {
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

				const result = await getPackageSize(fixture.path, {
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

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				const indexFile = result.files.find(file => file.path === 'index.js');
				expect(indexFile!.size).toBeGreaterThan(0);
				expect(indexFile!.sizeGzip).toBe(0);
				expect(indexFile!.sizeBrotli).toBe(0);
			});

			test('works without options', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
				});

				const result = await getPackageSize(fixture.path);

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

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				const largeFile = result.files.find(file => file.path === 'large.txt');
				// Tarball should be smaller than uncompressed file due to gzip
				expect(result.tarballSize).toBeLessThan(largeFile!.size);
			});

			test('returns privatePackage: true for private packages', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test-package',
						version: '1.0.0',
						private: true,
					}),
					'index.js': 'content',
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				expect(result.privatePackage).toBe(true);
			});

			test('returns privatePackage: false for public packages', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				expect(result.privatePackage).toBe(false);
			});

			test('handles package with only package.json', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				expect(result.files.length).toBe(1);
				expect(result.files[0].path).toBe('package.json');
			});

			test('handles empty files array in package.json', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test-package',
						version: '1.0.0',
						files: [],
					}),
					'index.js': 'should be excluded',
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				// package.json is always included by npm
				expect(result.files.length).toBe(1);
				expect(result.files[0].path).toBe('package.json');
			});

			test('handles .npmignore that excludes all files', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
					'.npmignore': '*\n!package.json',
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				// package.json is always included
				expect(result.files.length).toBe(1);
				expect(result.files[0].path).toBe('package.json');
			});

			test('throws on corrupt package.json', async () => {
				await using fixture = await createFixture({
					'package.json': '{ invalid json }',
				});

				const packageJsonPath = fixture.getPath('package.json');
				await expect(getPackageSize(fixture.path)).rejects.toThrow(
					`Failed to parse ${packageJsonPath}:`,
				);
			});
		});

		describe('Install Mode', ({ test }) => {
			test('returns install size data', async () => {
				const result = await getInstallSize('is-odd', {
					packageManager: 'pnpm',
				});

				expect(result).toEqual({
					packages: expect.arrayContaining([
						{
							name: 'is-odd',
							size: expect.any(Number),
							files: expect.arrayContaining([
								{
									path: 'package.json',
									size: expect.any(Number),
								},
								{
									path: 'index.js',
									size: expect.any(Number),
								},
							]),
						},
						{
							name: 'is-number',
							size: expect.any(Number),
							files: expect.arrayContaining([
								{
									path: 'package.json',
									size: expect.any(Number),
								},
								{
									path: 'index.js',
									size: expect.any(Number),
								},
							]),
						},
					]),
					totalSize: expect.any(Number),
					installTime: expect.any(Number),
					packageManager: 'pnpm',
				});
			});

			test('accepts space-delimited packages', async () => {
				const result = await getInstallSize('is-odd is-even', {
					packageManager: 'pnpm',
				});

				const packageNames = result.packages.map(pkg => pkg.name);
				expect(packageNames).toContain('is-odd');
				expect(packageNames).toContain('is-even');
			});

			test('detectPackageManager returns npm by default', () => {
				const originalAgent = process.env.npm_config_user_agent;
				delete process.env.npm_config_user_agent;

				expect(detectPackageManager()).toBe('npm');

				if (originalAgent !== undefined) {
					process.env.npm_config_user_agent = originalAgent;
				}
			});

			test('detectPackageManager detects pnpm', () => {
				const originalAgent = process.env.npm_config_user_agent;
				process.env.npm_config_user_agent = 'pnpm/10.24.0 npm/? node/v22.0.0';

				expect(detectPackageManager()).toBe('pnpm');

				if (originalAgent === undefined) {
					delete process.env.npm_config_user_agent;
				} else {
					process.env.npm_config_user_agent = originalAgent;
				}
			});

			test('detectPackageManager detects yarn', () => {
				const originalAgent = process.env.npm_config_user_agent;
				process.env.npm_config_user_agent = 'yarn/4.0.0 npm/? node/v22.0.0';

				expect(detectPackageManager()).toBe('yarn');

				if (originalAgent === undefined) {
					delete process.env.npm_config_user_agent;
				} else {
					process.env.npm_config_user_agent = originalAgent;
				}
			});
		});
	});
});
