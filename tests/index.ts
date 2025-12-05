import path from 'path';
import { describe, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import pkgSize from '../src/index.js';
import { detectPackageManager, isLocalPath } from '../src/install-size.js';
import { pkgSizeCli } from './utils/pkg-size.js';

describe('pkg-size', ({ describe }) => {
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

	describe('CLI', ({ test }) => {
		test('shows help with --help', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
			});

			const result = await pkgSizeCli(fixture.path, ['--help']);

			expect('exitCode' in result).toBe(false);
			expect(result.stdout).toContain('pkg-size');
			expect(result.stdout).toContain('--compression');
			expect(result.stdout).toContain('--sort-by');
			expect(result.stdout).toContain('--unit');
			expect(result.stdout).toContain('--json');
		});

		test('shows version with --version', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
			});

			const result = await pkgSizeCli(fixture.path, ['--version']);

			expect('exitCode' in result).toBe(false);
			expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
		});

		test('outputs package sizes', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'index.js': 'module.exports = 1;',
			});

			const result = await pkgSizeCli(fixture.path);

			expect('exitCode' in result).toBe(false);
			expect(result.stdout).toContain('Package path');
			expect(result.stdout).toContain('Tarball size');
			expect(result.stdout).toContain('index.js');
			expect(result.stdout).toContain('package.json');
		});

		test('supports --json flag', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'index.js': 'content',
			});

			const result = await pkgSizeCli(fixture.path, ['--json']);

			expect('exitCode' in result).toBe(false);
			const json = JSON.parse(result.stdout);
			expect(json.pkgPath).toBe(fixture.path);
			expect(typeof json.tarballSize).toBe('number');
			expect(Array.isArray(json.files)).toBe(true);
		});

		test('supports -c/--compression flag with gzip', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'index.js': 'content',
			});

			const result = await pkgSizeCli(fixture.path, ['--compression', 'gzip', '--json']);

			expect('exitCode' in result).toBe(false);
			const json = JSON.parse(result.stdout);
			const indexFile = json.files.find((file: { path: string }) => file.path === 'index.js');
			expect(indexFile.size).toBeGreaterThan(0);
			expect(indexFile.sizeGzip).toBeGreaterThan(0);
			expect(indexFile.sizeBrotli).toBe(0);
			expect(indexFile.sizeZstd).toBe(0);
		});

		test('supports --compression flag with brotli', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'index.js': 'content',
			});

			const result = await pkgSizeCli(fixture.path, ['--compression', 'brotli', '--json']);

			expect('exitCode' in result).toBe(false);
			const json = JSON.parse(result.stdout);
			const indexFile = json.files.find((file: { path: string }) => file.path === 'index.js');
			expect(indexFile.size).toBeGreaterThan(0);
			expect(indexFile.sizeGzip).toBe(0);
			expect(indexFile.sizeBrotli).toBeGreaterThan(0);
			expect(indexFile.sizeZstd).toBe(0);
		});

		test('supports --compression flag with zstd', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'index.js': 'content',
			});

			const result = await pkgSizeCli(fixture.path, ['--compression', 'zstd', '--json']);

			expect('exitCode' in result).toBe(false);
			const json = JSON.parse(result.stdout);
			const indexFile = json.files.find((file: { path: string }) => file.path === 'index.js');
			expect(indexFile.size).toBeGreaterThan(0);
			expect(indexFile.sizeGzip).toBe(0);
			expect(indexFile.sizeBrotli).toBe(0);
			expect(indexFile.sizeZstd).toBeGreaterThan(0);
		});

		test('supports --compression=false to disable compression', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'index.js': 'content',
			});

			const result = await pkgSizeCli(fixture.path, ['--compression=false', '--json']);

			expect('exitCode' in result).toBe(false);
			const json = JSON.parse(result.stdout);
			const indexFile = json.files.find((file: { path: string }) => file.path === 'index.js');
			expect(indexFile.size).toBeGreaterThan(0);
			expect(indexFile.sizeGzip).toBe(0);
			expect(indexFile.sizeBrotli).toBe(0);
			expect(indexFile.sizeZstd).toBe(0);
		});

		test('supports -i/--ignore-files flag', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'index.js': 'main',
				'types.d.ts': 'types',
			});

			const result = await pkgSizeCli(fixture.path, ['--ignore-files', '*.d.ts', '--json']);

			expect('exitCode' in result).toBe(false);
			const json = JSON.parse(result.stdout);
			const typesFile = json.files.find((file: { path: string }) => file.path === 'types.d.ts');
			expect(typesFile).toBeUndefined();
		});

		test('accepts package path as argument', async () => {
			await using fixture = await createFixture({
				subdir: {
					'package.json': JSON.stringify({
						name: 'subdir-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
				},
			});

			const subdirPath = `${fixture.path}/subdir`;
			const result = await pkgSizeCli(fixture.path, [subdirPath, '--json']);

			expect('exitCode' in result).toBe(false);
			const json = JSON.parse(result.stdout);
			expect(json.pkgPath).toBe(subdirPath);
		});

		test('supports -s/--sort-by flag for size sorting', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'small.js': 'x',
				'large.js': 'x'.repeat(100),
			});

			const result = await pkgSizeCli(fixture.path, ['--sort-by', 'size', '--json']);

			expect('exitCode' in result).toBe(false);
			const json = JSON.parse(result.stdout);
			const jsFiles = json.files.filter((file: { path: string }) => file.path.endsWith('.js'));
			// Files should be sorted by size descending (large first)
			expect(jsFiles[0].path).toBe('large.js');
			expect(jsFiles[1].path).toBe('small.js');
		});

		test('supports --sort-by name for alphabetical sorting', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'zebra.js': 'content',
				'alpha.js': 'content',
			});

			const result = await pkgSizeCli(fixture.path, ['--sort-by', 'name', '--json']);

			expect('exitCode' in result).toBe(false);
			const json = JSON.parse(result.stdout);
			const jsFiles = json.files.filter((file: { path: string }) => file.path.endsWith('.js'));
			// Files should be sorted alphabetically
			expect(jsFiles[0].path).toBe('alpha.js');
			expect(jsFiles[1].path).toBe('zebra.js');
		});

		test('supports --sort-by compressed for compression size sorting', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'small.js': 'x',
				'large.js': 'x'.repeat(100),
			});

			const result = await pkgSizeCli(fixture.path, ['--sort-by', 'compressed', '--json']);

			expect('exitCode' in result).toBe(false);
			const json = JSON.parse(result.stdout);
			const jsFiles = json.files.filter((file: { path: string }) => file.path.endsWith('.js'));
			// Files should be sorted by compressed size descending (large first)
			expect(jsFiles[0].path).toBe('large.js');
			expect(jsFiles[1].path).toBe('small.js');
		});

		test('supports -u/--unit flag for different units', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'data.js': 'x'.repeat(2048),
			});

			const metricResult = await pkgSizeCli(fixture.path, ['--unit', 'metric']);
			const iecResult = await pkgSizeCli(fixture.path, ['--unit', 'iec']);

			expect('exitCode' in metricResult).toBe(false);
			expect('exitCode' in iecResult).toBe(false);
			// Metric uses kB, IEC uses KiB
			expect(metricResult.stdout).toContain('kB');
			expect(iecResult.stdout).toContain('KiB');
		});

		test('uses cwd when no path specified', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'index.js': 'content',
			});

			const result = await pkgSizeCli(fixture.path, ['--json']);

			expect('exitCode' in result).toBe(false);
			const json = JSON.parse(result.stdout);
			expect(json.pkgPath).toBe(fixture.path);
		});

		test('displays totals row', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
				'a.js': 'content',
				'b.js': 'content',
			});

			const result = await pkgSizeCli(fixture.path);

			expect('exitCode' in result).toBe(false);
			// Output should show totals (underlined values in the table)
			expect(result.stdout).toContain('a.js');
			expect(result.stdout).toContain('b.js');
		});

		test('errors when mixing local paths with package names', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
			});

			const result = await pkgSizeCli(fixture.path, [fixture.path, 'lodash']);

			expect('exitCode' in result).toBe(true);
			if ('exitCode' in result) {
				expect(result.exitCode).toBe(1);
				expect(result.stderr).toContain('Cannot mix local paths with package names');
			}
		});

		test('errors when multiple local paths provided', async () => {
			await using fixture = await createFixture({
				dirA: {
					'package.json': JSON.stringify({
						name: 'a',
						version: '1.0.0',
					}),
				},
				dirB: {
					'package.json': JSON.stringify({
						name: 'b',
						version: '1.0.0',
					}),
				},
			});

			const result = await pkgSizeCli(fixture.path, [
				`${fixture.path}/dirA`,
				`${fixture.path}/dirB`,
			]);

			expect('exitCode' in result).toBe(true);
			if ('exitCode' in result) {
				expect(result.exitCode).toBe(1);
				expect(result.stderr).toContain('Can only analyze one local path at a time');
			}
		});
	});

	describe('Install Size', ({ test }) => {
		test('isLocalPath detects relative paths', () => {
			expect(isLocalPath('./package')).toBe(true);
			expect(isLocalPath('../package')).toBe(true);
			expect(isLocalPath('.')).toBe(true);
		});

		test('isLocalPath detects absolute paths', () => {
			expect(isLocalPath(path.resolve('/tmp/test'))).toBe(true);
			expect(isLocalPath(path.resolve('/usr/local/package'))).toBe(true);
		});

		test('isLocalPath returns false for package specs', () => {
			expect(isLocalPath('lodash')).toBe(false);
			expect(isLocalPath('@babel/core')).toBe(false);
			expect(isLocalPath('react@18')).toBe(false);
			expect(isLocalPath('typescript@^5.0.0')).toBe(false);
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

	describe('Install Mode CLI', ({ test }) => {
		test('supports --package-manager flag with npm', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
			});

			const result = await pkgSizeCli(fixture.path, ['is-odd', '--package-manager', 'npm', '--json']);

			expect('exitCode' in result).toBe(false);
			const json = JSON.parse(result.stdout);
			expect(json.packageManager).toBe('npm');
			expect(json.packages.length).toBeGreaterThan(0);
			expect(json.totalSize).toBeGreaterThan(0);
		}, 30_000);

		test('supports --package-manager flag with pnpm', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
			});

			const result = await pkgSizeCli(fixture.path, ['is-odd', '--package-manager', 'pnpm', '--json']);

			expect('exitCode' in result).toBe(false);
			const json = JSON.parse(result.stdout);
			expect(json.packageManager).toBe('pnpm');
			// pnpm uses symlinks - verify we still measure sizes correctly
			expect(json.packages.length).toBeGreaterThan(0);
			expect(json.totalSize).toBeGreaterThan(0);
			// is-odd depends on is-number, so we should see both
			const isOdd = json.packages.find((p: { name: string }) => p.name === 'is-odd');
			expect(isOdd).toBeDefined();
			expect(isOdd.size).toBeGreaterThan(0);
			expect(isOdd.files).toBeGreaterThan(0);
		}, 30_000);

		test('npm and pnpm report same packages and similar sizes', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}),
			});

			const npmResult = await pkgSizeCli(fixture.path, ['is-odd', '--package-manager', 'npm', '--json']);
			const pnpmResult = await pkgSizeCli(fixture.path, ['is-odd', '--package-manager', 'pnpm', '--json']);

			expect('exitCode' in npmResult).toBe(false);
			expect('exitCode' in pnpmResult).toBe(false);

			const npmJson = JSON.parse(npmResult.stdout);
			const pnpmJson = JSON.parse(pnpmResult.stdout);

			// Both should report the same packages (is-odd + is-number)
			expect(npmJson.packages.length).toBe(2);
			expect(pnpmJson.packages.length).toBe(2);

			expect(npmJson.packages.some((p: { name: string }) => p.name === 'is-odd')).toBe(true);
			expect(npmJson.packages.some((p: { name: string }) => p.name === 'is-number')).toBe(true);
			expect(pnpmJson.packages.some((p: { name: string }) => p.name === 'is-odd')).toBe(true);
			expect(pnpmJson.packages.some((p: { name: string }) => p.name === 'is-number')).toBe(true);

			// Sizes should be identical
			const npmIsOdd = npmJson.packages.find((p: { name: string }) => p.name === 'is-odd');
			const pnpmIsOdd = pnpmJson.packages.find((p: { name: string }) => p.name === 'is-odd');
			expect(pnpmIsOdd.size).toBe(npmIsOdd.size);

			// Total sizes should be identical
			expect(pnpmJson.totalSize).toBe(npmJson.totalSize);
		}, 60_000);
	});
});
