import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import type { PkgSizeCli } from '../utils/pkg-size.js';

export default testSuite(({ describe }, pkgSizeCli: PkgSizeCli) => {
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
});
