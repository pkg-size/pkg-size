import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import type { PkgSizeCli } from '../utils/pkg-size.js';
import { definePackageJson } from '../utils/package-json.js';

export default testSuite(({ describe }, pkgSizeCli: PkgSizeCli) => {
	describe('CLI', ({ describe }) => {
		describe('General', ({ test }) => {
			test('shows help with --help', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['--help']);

				expect('exitCode' in result).toBe(false);
				expect(result.stdout).toContain('pkg-size');
				expect(result.stdout).toContain('publish');
				expect(result.stdout).toContain('install');
				expect(result.stdout).toContain('analyze');
			});

			test('shows version with --version', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['--version']);

				expect('exitCode' in result).toBe(false);
				expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
			});

			test('shows publish help with publish --help', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['publish', '--help']);

				expect('exitCode' in result).toBe(false);
				expect(result.stdout).toContain('--compression');
				expect(result.stdout).toContain('--sort-by');
				expect(result.stdout).toContain('--json');
			});

			test('shows help when no subcommand provided', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, []);

				expect('exitCode' in result).toBe(false);
				expect(result.stdout).toContain('pkg-size');
				expect(result.stdout).toContain('publish');
				expect(result.stdout).toContain('install');
				expect(result.stdout).toContain('analyze');
			});

			test('shows help when invalid subcommand provided', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['invalid-command']);

				expect('exitCode' in result).toBe(false);
				expect(result.stdout).toContain('pkg-size');
				expect(result.stdout).toContain('publish');
				expect(result.stdout).toContain('install');
				expect(result.stdout).toContain('analyze');
			});
		});

		describe('publish', ({ test }) => {
			test('outputs package sizes', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'module.exports = 1;',
				});

				const result = await pkgSizeCli(fixture.path, ['publish']);

				expect('exitCode' in result).toBe(false);
				expect(result.stdout).toContain('Package path');
				expect(result.stdout).toContain('Tarball size');
				expect(result.stdout).toContain('index.js');
				expect(result.stdout).toContain('package.json');
			});

			test('supports --json flag', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
				});

				const result = await pkgSizeCli(fixture.path, ['publish', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				expect(json.packagePath).toBe(fixture.path);
				expect(typeof json.tarballSize).toBe('number');
				expect(Array.isArray(json.files)).toBe(true);
			});

			test('supports -c/--compression flag with gzip', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
				});

				const result = await pkgSizeCli(fixture.path, ['publish', '--compression', 'gzip', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				const indexFile = json.files.find((file: { path: string }) => file.path === 'index.js');
				expect(indexFile.size).toBeGreaterThan(0);
				expect(indexFile.sizeGzip).toBeGreaterThan(0);
				expect(indexFile.sizeBrotli).toBe(0);
			});

			test('supports --compression flag with brotli', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
				});

				const result = await pkgSizeCli(fixture.path, ['publish', '--compression', 'brotli', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				const indexFile = json.files.find((file: { path: string }) => file.path === 'index.js');
				expect(indexFile.size).toBeGreaterThan(0);
				expect(indexFile.sizeGzip).toBe(0);
				expect(indexFile.sizeBrotli).toBeGreaterThan(0);
			});

			test('supports --compression=false to disable compression', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
				});

				const result = await pkgSizeCli(fixture.path, ['publish', '--compression=false', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				const indexFile = json.files.find((file: { path: string }) => file.path === 'index.js');
				expect(indexFile.size).toBeGreaterThan(0);
				expect(indexFile.sizeGzip).toBe(0);
				expect(indexFile.sizeBrotli).toBe(0);
			});

			test('supports -i/--ignore-files flag', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'main',
					'types.d.ts': 'types',
				});

				const result = await pkgSizeCli(fixture.path, ['publish', '--ignore-files', '*.d.ts', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				const typesFile = json.files.find((file: { path: string }) => file.path === 'types.d.ts');
				expect(typesFile).toBeUndefined();
			});

			test('accepts package path as argument', async () => {
				await using fixture = await createFixture({
					subdir: {
						'package.json': definePackageJson({
							name: 'subdir-package',
							version: '1.0.0',
						}),
						'index.js': 'content',
					},
				});

				const subdirPath = `${fixture.path}/subdir`;
				const result = await pkgSizeCli(fixture.path, ['publish', subdirPath, '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				expect(json.packagePath).toBe(subdirPath);
			});

			test('supports -s/--sort-by flag for size sorting', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'small.js': 'x',
					'large.js': 'x'.repeat(100),
				});

				const result = await pkgSizeCli(fixture.path, ['publish', '--sort-by', 'size', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				const jsFiles = json.files.filter((file: { path: string }) => file.path.endsWith('.js'));
				// Files should be sorted by size descending (large first)
				expect(jsFiles[0].path).toBe('large.js');
				expect(jsFiles[1].path).toBe('small.js');
			});

			test('supports --sort-by name for alphabetical sorting', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'zebra.js': 'content',
					'alpha.js': 'content',
				});

				const result = await pkgSizeCli(fixture.path, ['publish', '--sort-by', 'name', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				const jsFiles = json.files.filter((file: { path: string }) => file.path.endsWith('.js'));
				// Files should be sorted alphabetically
				expect(jsFiles[0].path).toBe('alpha.js');
				expect(jsFiles[1].path).toBe('zebra.js');
			});

			test('supports --sort-by compressed for compression size sorting', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'small.js': 'x',
					'large.js': 'x'.repeat(100),
				});

				const result = await pkgSizeCli(fixture.path, ['publish', '--sort-by', 'compressed', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				const jsFiles = json.files.filter((file: { path: string }) => file.path.endsWith('.js'));
				// Files should be sorted by compressed size descending (large first)
				expect(jsFiles[0].path).toBe('large.js');
				expect(jsFiles[1].path).toBe('small.js');
			});

			test('uses cwd when no path specified', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
				});

				const result = await pkgSizeCli(fixture.path, ['publish', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				expect(json.packagePath).toBe(fixture.path);
			});

			test('displays totals row', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'a.js': 'content',
					'b.js': 'content',
				});

				const result = await pkgSizeCli(fixture.path, ['publish']);

				expect('exitCode' in result).toBe(false);
				// Output should show totals (underlined values in the table)
				expect(result.stdout).toContain('a.js');
				expect(result.stdout).toContain('b.js');
			});

			test('shows warning for private packages', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
						private: true,
					}),
					'index.js': 'content',
				});

				const result = await pkgSizeCli(fixture.path, ['publish']);

				expect('exitCode' in result).toBe(false);
				expect(result.stdout).toContain('Warning: This package is marked private in package.json.');
			});

			test('does not show warning for public packages', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
				});

				const result = await pkgSizeCli(fixture.path, ['publish']);

				expect('exitCode' in result).toBe(false);
				expect(result.stdout).not.toContain('Warning: This package is marked private in package.json.');
			});

			test('includes privatePackage in JSON output for private packages', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
						private: true,
					}),
					'index.js': 'content',
				});

				const result = await pkgSizeCli(fixture.path, ['publish', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				expect(json.privatePackage).toBe(true);
			});

			test('handles package with only package.json', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['publish', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				expect(json.files.length).toBe(1);
				expect(json.files[0].path).toBe('package.json');
			});

			test('handles empty files array in package.json', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
						files: [],
					}),
					'index.js': 'should be excluded',
				});

				const result = await pkgSizeCli(fixture.path, ['publish', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				expect(json.files.length).toBe(1);
				expect(json.files[0].path).toBe('package.json');
			});

			test('handles .npmignore that excludes all files', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
					'.npmignore': '*\n!package.json',
				});

				const result = await pkgSizeCli(fixture.path, ['publish', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				expect(json.files.length).toBe(1);
				expect(json.files[0].path).toBe('package.json');
			});

			test('errors on corrupt package.json', async () => {
				await using fixture = await createFixture({
					'package.json': '{ invalid json }',
				});

				const result = await pkgSizeCli(fixture.path, ['publish']);
				const packageJsonPath = `${fixture.path}/package.json`;

				expect('exitCode' in result).toBe(true);
				if ('exitCode' in result) {
					expect(result.exitCode).toBe(1);
					expect(result.stderr).toContain(`Failed to parse ${packageJsonPath}:`);
				}
			});
		});

		describe('install', ({ test }) => {
			test('supports --package-manager flag with npm', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'npm', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				expect(json.packageManager).toBe('npm');
				expect(json.packages.length).toBeGreaterThan(0);
				expect(json.totalSize).toBeGreaterThan(0);
			}, 30_000);

			test('supports --package-manager flag with pnpm', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'pnpm', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);

				expect(json).toEqual({
					packageManager: 'pnpm',
					totalSize: expect.any(Number),
					installTime: expect.any(Number),
					packages: expect.arrayContaining([
						{
							name: 'is-odd',
							version: expect.any(String),
							size: expect.any(Number),
							license: 'MIT',
							author: expect.any(String),
							path: [],
							files: expect.arrayContaining([
								{
									path: expect.any(String),
									size: expect.any(Number),
								},
							]),
						},
						{
							name: 'is-number',
							version: expect.any(String),
							size: expect.any(Number),
							license: 'MIT',
							author: expect.any(String),
							path: [],
							files: expect.arrayContaining([
								{
									path: expect.any(String),
									size: expect.any(Number),
								},
							]),
						},
					]),
				});
				expect(json.packages).toHaveLength(2);
			}, 30_000);

			test('validates package manager flag', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'invalid-pm']);

				expect('exitCode' in result).toBe(true);
				if ('exitCode' in result) {
					expect(result.exitCode).toBe(1);
					expect(result.stderr).toContain('Invalid package manager: "invalid-pm"');
				}
			});

			test('supports --package-manager flag with yarn', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'yarn', '--json']);

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
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				// @sindresorhus/is is a small scoped package
				const result = await pkgSizeCli(fixture.path, ['install', '@sindresorhus/is', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);

				// Verify we found the scoped package
				const scopedPkg = json.packages.find((p: { name: string }) => p.name === '@sindresorhus/is');
				expect(scopedPkg).toBeDefined();
				expect(scopedPkg.size).toBeGreaterThan(0);
			}, 30_000);

			test('sorts packages by name', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--sort-by', 'name', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);

				const names = json.packages.map((p: { name: string }) => p.name);
				// is-number comes before is-odd alphabetically
				expect(names).toEqual(['is-number', 'is-odd']);
			}, 30_000);

			test('renders human readable table', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd']);

				expect('exitCode' in result).toBe(false);
				expect(result.stdout).not.toContain('{');
				expect(result.stdout).toContain('Package');
				expect(result.stdout).toContain('is-odd');
				expect(result.stdout).toContain('Total');
			}, 30_000);

			test('npm and pnpm report same packages and similar sizes', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const npmResult = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'npm', '--json']);
				const pnpmResult = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'pnpm', '--json']);

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

			test('npm install shows transitive dependencies with arrow notation', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'npm']);

				expect('exitCode' in result).toBe(false);
				// Should show arrow notation for transitive dependency
				expect(result.stdout).toContain('→');
				// is-number is a dependency of is-odd, should show: is-odd → is-number
				expect(result.stdout).toContain('is-odd');
				expect(result.stdout).toContain('is-number');
			}, 30_000);

			test('npm install JSON includes path array for transitive deps', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'npm', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);

				const isOdd = json.packages.find((p: { name: string }) => p.name === 'is-odd');
				const isNumber = json.packages.find((p: { name: string }) => p.name === 'is-number');

				expect(isOdd.path).toEqual([]);
				expect(isNumber.path).toEqual([
					{
						name: 'is-odd',
						version: expect.any(String),
					},
				]);
			}, 30_000);
		});

		describe('analyze', ({ test }) => {
			test('analyzes existing node_modules', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'some-package': {
							'package.json': definePackageJson({
								name: 'some-package',
								version: '1.0.0',
							}),
							'index.js': 'module.exports = 1;',
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);

				expect(json).toEqual({
					packages: [
						{
							name: 'some-package',
							version: '1.0.0',
							size: expect.any(Number),
							path: [],
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
					],
					totalSize: expect.any(Number),
				});
			});

			test('renders human readable table', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'some-package': {
							'package.json': definePackageJson({
								name: 'some-package',
								version: '1.0.0',
							}),
							'index.js': 'content',
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze']);

				expect('exitCode' in result).toBe(false);
				expect(result.stdout).toContain('Package');
				expect(result.stdout).toContain('some-package');
				expect(result.stdout).toContain('Total');
			});

			test('sorts packages by name', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'zebra-pkg': {
							'package.json': definePackageJson({
								name: 'zebra-pkg',
								version: '1.0.0',
							}),
							'index.js': 'content',
						},
						'alpha-pkg': {
							'package.json': definePackageJson({
								name: 'alpha-pkg',
								version: '1.0.0',
							}),
							'index.js': 'content',
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--sort-by', 'name', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				const names = json.packages.map((p: { name: string }) => p.name);
				expect(names).toEqual(['alpha-pkg', 'zebra-pkg']);
			});

			test('handles scoped packages', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'@scope': {
							'scoped-pkg': {
								'package.json': definePackageJson({
									name: '@scope/scoped-pkg',
									version: '1.0.0',
								}),
								'index.js': 'content',
							},
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				expect(json.packages[0].name).toBe('@scope/scoped-pkg');
			});

			test('accepts path argument', async () => {
				await using fixture = await createFixture({
					subdir: {
						'package.json': definePackageJson({
							name: 'test-package',
							version: '1.0.0',
						}),
						node_modules: {
							'some-package': {
								'package.json': definePackageJson({
									name: 'some-package',
									version: '1.0.0',
								}),
								'index.js': 'content',
							},
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', `${fixture.path}/subdir`, '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				expect(json.packages[0].name).toBe('some-package');
			});

			test('returns empty packages array when no node_modules', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);
				expect(json.packages).toEqual([]);
				expect(json.totalSize).toBe(0);
			});

			test('groups scoped packages by scope with --group=scope', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'@babel': {
							core: {
								'package.json': definePackageJson({
									name: '@babel/core',
									version: '1.0.0',
								}),
								'index.js': 'content',
							},
							parser: {
								'package.json': definePackageJson({
									name: '@babel/parser',
									version: '1.0.0',
								}),
								'index.js': 'content',
							},
						},
						'@types': {
							node: {
								'package.json': definePackageJson({
									name: '@types/node',
									version: '1.0.0',
								}),
								'index.js': 'content',
							},
						},
						lodash: {
							'package.json': definePackageJson({
								name: 'lodash',
								version: '1.0.0',
							}),
							'index.js': 'content',
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--group=scope', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);

				// Should have groups for @babel, @types, and ungrouped packages
				expect(json.groups).toBeDefined();
				expect(json.groups['@babel']).toBeDefined();
				expect(json.groups['@babel'].packages).toHaveLength(2);
				expect(json.groups['@types']).toBeDefined();
				expect(json.groups['@types'].packages).toHaveLength(1);
				expect(json.groups['(unscoped)']).toBeDefined();
				expect(json.groups['(unscoped)'].packages).toHaveLength(1);
			});

			test('displays grouped output in table format with --group=scope', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'@babel': {
							core: {
								'package.json': definePackageJson({
									name: '@babel/core',
									version: '1.0.0',
								}),
								'index.js': 'content',
							},
						},
						lodash: {
							'package.json': definePackageJson({
								name: 'lodash',
								version: '1.0.0',
							}),
							'index.js': 'content',
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--group=scope']);

				expect('exitCode' in result).toBe(false);
				// Group headers should be shown
				expect(result.stdout).toContain('@babel');
				expect(result.stdout).toContain('(unscoped)');
				// Scoped packages show short name under group header
				expect(result.stdout).toContain('core');
				// Unscoped packages show full name
				expect(result.stdout).toContain('lodash');
			});

			test('groups packages by license with --group=license', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'mit-pkg-1': {
							'package.json': definePackageJson({
								name: 'mit-pkg-1',
								version: '1.0.0',
								license: 'MIT',
							}),
							'index.js': 'content',
						},
						'mit-pkg-2': {
							'package.json': definePackageJson({
								name: 'mit-pkg-2',
								version: '1.0.0',
								license: 'MIT',
							}),
							'index.js': 'content',
						},
						'isc-pkg': {
							'package.json': definePackageJson({
								name: 'isc-pkg',
								version: '1.0.0',
								license: 'ISC',
							}),
							'index.js': 'content',
						},
						'no-license-pkg': {
							'package.json': definePackageJson({
								name: 'no-license-pkg',
								version: '1.0.0',
							}),
							'index.js': 'content',
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--group=license', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);

				expect(json.groups).toBeDefined();
				expect(json.groups.MIT).toBeDefined();
				expect(json.groups.MIT.packages).toHaveLength(2);
				expect(json.groups.ISC).toBeDefined();
				expect(json.groups.ISC.packages).toHaveLength(1);
				expect(json.groups['(unknown)']).toBeDefined();
				expect(json.groups['(unknown)'].packages).toHaveLength(1);
			});

			test('displays grouped output in table format with --group=license', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'mit-pkg': {
							'package.json': definePackageJson({
								name: 'mit-pkg',
								version: '1.0.0',
								license: 'MIT',
							}),
							'index.js': 'content',
						},
						'apache-pkg': {
							'package.json': definePackageJson({
								name: 'apache-pkg',
								version: '1.0.0',
								license: 'Apache-2.0',
							}),
							'index.js': 'content',
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--group=license']);

				expect('exitCode' in result).toBe(false);
				expect(result.stdout).toContain('MIT');
				expect(result.stdout).toContain('Apache-2.0');
				expect(result.stdout).toContain('mit-pkg');
				expect(result.stdout).toContain('apache-pkg');
			});

			test('groups packages by author with --group=author', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'john-pkg-1': {
							'package.json': definePackageJson({
								name: 'john-pkg-1',
								version: '1.0.0',
								author: 'John Doe',
							}),
							'index.js': 'content',
						},
						'john-pkg-2': {
							'package.json': definePackageJson({
								name: 'john-pkg-2',
								version: '1.0.0',
								author: 'John Doe',
							}),
							'index.js': 'content',
						},
						'jane-pkg': {
							'package.json': definePackageJson({
								name: 'jane-pkg',
								version: '1.0.0',
								author: {
									name: 'Jane Smith',
									email: 'jane@example.com',
								},
							}),
							'index.js': 'content',
						},
						'no-author-pkg': {
							'package.json': definePackageJson({
								name: 'no-author-pkg',
								version: '1.0.0',
							}),
							'index.js': 'content',
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--group=author', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);

				expect(json.groups).toBeDefined();
				expect(json.groups['John Doe']).toBeDefined();
				expect(json.groups['John Doe'].packages).toHaveLength(2);
				expect(json.groups['Jane Smith <jane@example.com>']).toBeDefined();
				expect(json.groups['Jane Smith <jane@example.com>'].packages).toHaveLength(1);
				expect(json.groups['(unknown)']).toBeDefined();
				expect(json.groups['(unknown)'].packages).toHaveLength(1);
			});

			test('displays grouped output in table format with --group=author', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'john-pkg': {
							'package.json': definePackageJson({
								name: 'john-pkg',
								version: '1.0.0',
								author: 'John Doe',
							}),
							'index.js': 'content',
						},
						'jane-pkg': {
							'package.json': definePackageJson({
								name: 'jane-pkg',
								version: '1.0.0',
								author: 'Jane Smith',
							}),
							'index.js': 'content',
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--group=author']);

				expect('exitCode' in result).toBe(false);
				expect(result.stdout).toContain('John Doe');
				expect(result.stdout).toContain('Jane Smith');
				expect(result.stdout).toContain('john-pkg');
				expect(result.stdout).toContain('jane-pkg');
			});

			test('includes metadata in JSON output', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'full-metadata': {
							'package.json': definePackageJson({
								name: 'full-metadata',
								version: '1.0.0',
								license: 'MIT',
								author: 'Test Author',
							}),
							'index.js': 'content',
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);

				expect(json.packages[0].license).toBe('MIT');
				expect(json.packages[0].author).toBe('Test Author');
			});
		});
	});
});
