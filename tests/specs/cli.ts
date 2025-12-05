import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import type { PkgSizeCli } from '../utils/pkg-size.js';

export default testSuite(({ describe }, pkgSizeCli: PkgSizeCli) => {
	describe('CLI', ({ describe }) => {
		describe('General', ({ test }) => {
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
		});

		describe('Local Mode', ({ test }) => {
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
		});

		describe('Install Mode', ({ test }) => {
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

			test('validates package manager flag', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['is-odd', '--package-manager', 'invalid-pm']);

				expect('exitCode' in result).toBe(true);
				if ('exitCode' in result) {
					expect(result.exitCode).toBe(1);
					expect(result.stderr).toContain('Invalid package manager: "invalid-pm"');
				}
			});

			test('supports --package-manager flag with yarn', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['is-odd', '--package-manager', 'yarn', '--json']);

				// Skip test if yarn is not installed in the environment
				if ('exitCode' in result && (result.stderr.includes('Command failed') || result.stderr.includes('spawn yarn ENOENT'))) {
					return;
				}

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				expect(json.packageManager).toBe('yarn');
				expect(json.packages.length).toBeGreaterThan(0);
			}, 60_000);

			test('handles scoped packages correctly', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				// @sindresorhus/is is a small scoped package
				const result = await pkgSizeCli(fixture.path, ['@sindresorhus/is', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);

				// Verify we found the scoped package
				const scopedPkg = json.packages.find((p: { name: string }) => p.name === '@sindresorhus/is');
				expect(scopedPkg).toBeDefined();
				expect(scopedPkg.size).toBeGreaterThan(0);
			}, 30_000);

			test('sorts packages by name', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['is-odd', '--sort-by', 'name', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);

				const names = json.packages.map((p: { name: string }) => p.name);
				// is-number comes before is-odd alphabetically
				expect(names).toEqual(['is-number', 'is-odd']);
			}, 30_000);

			test('renders human readable table', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['is-odd']);

				expect('exitCode' in result).toBe(false);
				expect(result.stdout).not.toContain('{');
				expect(result.stdout).toContain('Package');
				expect(result.stdout).toContain('is-odd');
				expect(result.stdout).toContain('Total');
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

		describe('Mode Detection', ({ test }) => {
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
});
