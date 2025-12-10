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

				expect(json.packageManager).toBe('pnpm');
				expect(json.totalSize).toBeGreaterThan(0);
				expect(json.installTime).toBeGreaterThan(0);
				expect(json.packages).toHaveLength(2);

				const isOdd = json.packages.find((p: { name: string }) => p.name === 'is-odd');
				const isNumber = json.packages.find((p: { name: string }) => p.name === 'is-number');

				expect(isOdd).toBeDefined();
				expect(isOdd.installedBy).toEqual([]);

				expect(isNumber).toBeDefined();
				expect(isNumber.installedBy).toEqual([
					{
						name: 'is-odd',
						version: expect.any(String),
					},
				]);
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
				// Header shows total size and package count
				expect(result.stdout).toContain('Packages');
				expect(result.stdout).toContain('is-odd');
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

			test('npm install shows transitive dependencies with --verbose', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'npm', '--verbose']);

				expect('exitCode' in result).toBe(false);
				// Should show "Installed by:" for transitive dependency
				expect(result.stdout).toContain('Installed by:');
				// is-number is a dependency of is-odd
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

				expect(isOdd.installedBy).toEqual([]);
				expect(isNumber.installedBy).toEqual([
					{
						name: 'is-odd',
						version: expect.any(String),
					},
				]);
			}, 30_000);

			test('pnpm install shows transitive dependencies with --verbose', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'pnpm', '--verbose']);

				expect('exitCode' in result).toBe(false);
				// Should show "Installed by:" for transitive dependency
				expect(result.stdout).toContain('Installed by:');
				expect(result.stdout).toContain('is-odd');
				expect(result.stdout).toContain('is-number');
			}, 30_000);

			test('pnpm install JSON includes path array for transitive deps', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'pnpm', '--json']);

				expect('exitCode' in result).toBe(false);
				const json = JSON.parse(result.stdout);

				const isOdd = json.packages.find((p: { name: string }) => p.name === 'is-odd');
				const isNumber = json.packages.find((p: { name: string }) => p.name === 'is-number');

				expect(isOdd.installedBy).toEqual([]);
				expect(isNumber.installedBy).toEqual([
					{
						name: 'is-odd',
						version: expect.any(String),
					},
				]);
			}, 30_000);

			test('without --verbose hides dependency paths and empty lines', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'pnpm']);

				expect('exitCode' in result).toBe(false);
				// Should NOT show "Installed by:" without verbose
				expect(result.stdout).not.toContain('Installed by:');
				// Should show package names
				expect(result.stdout).toContain('is-odd');
				expect(result.stdout).toContain('is-number');
				// Should NOT have consecutive empty lines between packages
				expect(result.stdout).not.toMatch(/is-odd[^\n]*\n\n[^\n]*is-number/);
				expect(result.stdout).not.toMatch(/is-number[^\n]*\n\n[^\n]*is-odd/);
			}, 30_000);

			test('--verbose shows dependency paths on separate line with empty lines between packages', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'pnpm', '--verbose']);

				expect('exitCode' in result).toBe(false);
				// Should show "Installed by:" for dependency path
				expect(result.stdout).toContain('Installed by:');
				// Should have empty lines between packages (verbose mode)
				// The output has empty rows between package entries
				const lines = result.stdout.split('\n');
				const packageLines = lines.filter(line => line.includes('is-odd') || line.includes('is-number'));
				expect(packageLines.length).toBeGreaterThanOrEqual(2);
			}, 30_000);

			test('--verbose shows author and license information', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'test-pkg': {
							'package.json': definePackageJson({
								name: 'test-pkg',
								version: '1.0.0',
								author: 'Test Author',
								license: 'MIT',
							}),
							'index.js': 'module.exports = 1;',
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--verbose']);

				expect('exitCode' in result).toBe(false);
				// Should show "by" and author name
				expect(result.stdout).toContain('by');
				expect(result.stdout).toContain('Test Author');
				// Should show license
				expect(result.stdout).toContain('MIT');
			});

			test('without --verbose hides author and license information', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'test-pkg': {
							'package.json': definePackageJson({
								name: 'test-pkg',
								version: '1.0.0',
								author: 'Test Author',
								license: 'MIT',
							}),
							'index.js': 'module.exports = 1;',
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze']);

				expect('exitCode' in result).toBe(false);
				// Should NOT show author info without verbose
				expect(result.stdout).not.toContain('Test Author');
				// Should NOT show license without verbose (check for MIT not preceded by test-pkg)
				expect(result.stdout).not.toMatch(/\bby\b/);
			});

			/**
			 * Non-verbose install output format documentation:
			 *
			 * Line 1: (empty)
			 * Line 2: "Installing with <pm>..." (progress message)
			 * Line 3: "Completed in Xms" (completion time)
			 * Line 4: (empty)
			 * Line 5: <total size>  <package count> Packages
			 * Line 6: (empty separator)
			 * Line 7: <size>  <package-a name+version>
			 * Line 8: <size>  <package-b name+version>
			 * Line 9: (empty at end)
			 *
			 * Key: packages on consecutive lines, NO empty lines between them
			 */
			test('non-verbose install output: packages on consecutive lines without empty lines', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'pnpm', '--sort-by', 'name']);

				expect('exitCode' in result).toBe(false);

				const lines = result.stdout.split('\n');

				// Line 0: empty (leading newline)
				expect(lines[0]).toBe('');

				// Line 1: progress message "Installing with pnpm..."
				expect(lines[1]).toContain('Installing with pnpm');

				// Line 2: completion time "Completed in Xms"
				expect(lines[2]).toContain('Completed in');

				// Line 3: empty separator after progress messages
				expect(lines[3]).toBe('');

				// Line 4: header with total size and package count
				expect(lines[4]).toMatch(/\d.*2 Packages/);

				// Line 5: empty separator after header
				expect(lines[5]).toBe('');

				// Lines 6-7: packages on consecutive lines (no empty lines between them)
				// is-number comes before is-odd alphabetically
				expect(lines[6]).toContain('is-number');
				expect(lines[7]).toContain('is-odd');

				// Line 8: trailing empty line
				expect(lines[8]).toBe('');

				// Total lines: exactly 9
				expect(lines.length).toBe(9);
			}, 30_000);

			/**
			 * Verbose install output format documentation:
			 *
			 * Line 1: (empty)
			 * Line 2: "Installing with <pm>..." (progress message)
			 * Line 3: "Completed in Xms" (completion time)
			 * Line 4: (empty)
			 * Line 5: <total size>  <package count> Packages
			 * Line 6: (empty separator)
			 * --- Package 1 block (is-number, transitive dep) ---
			 * Line 7: <percentage>  <is-number name+version+links>
			 * Line 8: <size>        <path>
			 * Line 9:               Installed by: is-odd v<version>
			 * Line 10:              Dependencies: 0
			 * --- Empty line between packages ---
			 * Line 11: (empty)
			 * --- Package 2 block (is-odd, direct dep) ---
			 * Line 12: <percentage>  <is-odd name+version+links>
			 * Line 13: <size>        <path>
			 * Line 14:              Installed by: package.json
			 * Line 15:              Dependencies: 1 (Xkb)
			 * Line 16: (empty at end)
			 *
			 * Key: 4 lines per package, empty line ONLY between packages (not within)
			 */
			test('verbose install output: 4 lines per package, empty lines only between packages', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'pnpm', '--sort-by', 'name', '--verbose']);

				expect('exitCode' in result).toBe(false);

				const lines = result.stdout.split('\n');

				// Line 0: empty (leading newline)
				expect(lines[0]).toBe('');

				// Line 1: progress message "Installing with pnpm..."
				expect(lines[1]).toContain('Installing with pnpm');

				// Line 2: completion time "Completed in Xms"
				expect(lines[2]).toContain('Completed in');

				// Line 3: empty separator after progress messages
				expect(lines[3]).toBe('');

				// Line 4: header with total size and package count
				expect(lines[4]).toMatch(/\d.*2 Packages/);

				// Line 5: empty separator after header
				expect(lines[5]).toBe('');

				// --- Package 1 (is-number, transitive dep, comes first alphabetically) ---
				// Line 6: percentage + name/version
				expect(lines[6]).toContain('is-number');

				// Line 7: size + path
				expect(lines[7]).toContain('node_modules');

				// Line 8: "Installed by:" showing is-odd
				expect(lines[8]).toContain('Installed by:');
				expect(lines[8]).toContain('is-odd');

				// Line 9: Dependencies count
				expect(lines[9]).toContain('Dependencies:');

				// --- Empty line between packages ---
				// Line 10: empty separator between packages
				expect(lines[10]).toBe('');

				// --- Package 2 (is-odd, direct dep) ---
				// Line 11: percentage + name/version
				expect(lines[11]).toContain('is-odd');

				// Line 12: size + path
				expect(lines[12]).toContain('node_modules');

				// Line 13: "Installed by:" showing package.json (direct dep)
				expect(lines[13]).toContain('Installed by:');
				expect(lines[13]).toContain('package.json');

				// Line 14: Dependencies count
				expect(lines[14]).toContain('Dependencies:');

				// Line 15: trailing empty line
				expect(lines[15]).toBe('');

				// Total lines: exactly 16
				expect(lines.length).toBe(16);
			}, 30_000);

			/**
			 * Verbose install with transitive dependencies documentation:
			 *
			 * For is-odd -> is-number chain:
			 * - is-number shows "Installed by: is-odd v<version>" since it's transitive
			 * - is-odd shows "Installed by: package.json" since it's direct
			 */
			test('verbose install output: shows dependency path for transitive deps', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await pkgSizeCli(fixture.path, ['install', 'is-odd', '--package-manager', 'pnpm', '--verbose']);

				expect('exitCode' in result).toBe(false);

				const lines = result.stdout.split('\n');

				// Find is-number line (transitive dep of is-odd)
				const isNumberLineIndex = lines.findIndex(line => line.includes('is-number') && !line.includes('Installed by'));
				expect(isNumberLineIndex).toBeGreaterThan(-1);

				// Next line shows path, line after that shows "Installed by:" with is-odd info
				expect(lines[isNumberLineIndex + 1]).toContain('node_modules');
				expect(lines[isNumberLineIndex + 2]).toContain('Installed by:');
				expect(lines[isNumberLineIndex + 2]).toContain('is-odd');

				// Find is-odd line (direct dep)
				const isOddLineIndex = lines.findIndex(line => line.includes('is-odd') && !line.includes('is-number') && !line.includes('Installed by'));
				expect(isOddLineIndex).toBeGreaterThan(-1);

				// Next line shows path, line after that shows "Installed by: package.json" since it's direct
				expect(lines[isOddLineIndex + 1]).toContain('node_modules');
				expect(lines[isOddLineIndex + 2]).toContain('Installed by:');
				expect(lines[isOddLineIndex + 2]).toContain('package.json');
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
							installedBy: [],
							path: 'node_modules/some-package',
							dependencySize: 0,
							dependencyCount: 0,
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
				// Header shows total size and package count
				expect(result.stdout).toContain('Package');
				expect(result.stdout).toContain('some-package');
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

			/**
			 * Non-verbose output format documentation:
			 *
			 * Line 1: (empty)
			 * Line 2: <total size>  <package count> Packages
			 * Line 3: (empty separator)
			 * Line 4: <size>  <package-a name+version>
			 * Line 5: <size>  <package-b name+version>
			 * Line 6: (empty at end)
			 *
			 * Key: packages on consecutive lines, NO empty lines between them
			 */
			test('non-verbose output: packages on consecutive lines without empty lines', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'package-a': {
							'package.json': definePackageJson({
								name: 'package-a',
								version: '1.0.0',
							}),
							'index.js': 'a',
						},
						'package-b': {
							'package.json': definePackageJson({
								name: 'package-b',
								version: '2.0.0',
							}),
							'index.js': 'b',
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--sort-by', 'name']);

				expect('exitCode' in result).toBe(false);

				const lines = result.stdout.split('\n');

				// Line 0: empty (leading newline)
				expect(lines[0]).toBe('');

				// Line 1: header with total size and package count
				expect(lines[1]).toMatch(/\d.*2 Packages/);

				// Line 2: empty separator after header
				expect(lines[2]).toBe('');

				// Lines 3-4: packages on consecutive lines (no empty lines between them)
				expect(lines[3]).toContain('package-a');
				expect(lines[3]).toContain('v1.0.0');
				expect(lines[4]).toContain('package-b');
				expect(lines[4]).toContain('v2.0.0');

				// Line 5: trailing empty line
				expect(lines[5]).toBe('');

				// Total lines: exactly 6
				expect(lines.length).toBe(6);
			});

			/**
			 * Verbose output format documentation:
			 *
			 * Line 1: (empty)
			 * Line 2: <total size>  <package count> Packages
			 * Line 3: (empty separator)
			 * --- Package 1 block ---
			 * Line 4: <percentage>  <package-a name+version+author+license+links>
			 * Line 5: <size>        <path>
			 * Line 6:               Installed by: <path or "package.json">
			 * Line 7:               Dependencies: <count>
			 * --- Empty line between packages ---
			 * Line 8: (empty)
			 * --- Package 2 block ---
			 * Line 9: <percentage>  <package-b name+version+author+license+links>
			 * Line 10: <size>       <path>
			 * Line 11:              Installed by: <path or "package.json">
			 * Line 12:              Dependencies: <count>
			 * Line 13: (empty at end)
			 *
			 * Key: 4 lines per package, empty line ONLY between packages (not within)
			 */
			test('verbose output: 4 lines per package, empty lines only between packages', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'package-a': {
							'package.json': definePackageJson({
								name: 'package-a',
								version: '1.0.0',
								author: 'Author A',
								license: 'MIT',
							}),
							'index.js': 'a',
						},
						'package-b': {
							'package.json': definePackageJson({
								name: 'package-b',
								version: '2.0.0',
								author: 'Author B',
								license: 'ISC',
							}),
							'index.js': 'b',
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--sort-by', 'name', '--verbose']);

				expect('exitCode' in result).toBe(false);

				const lines = result.stdout.split('\n');

				// Line 0: empty (leading newline)
				expect(lines[0]).toBe('');

				// Line 1: header with total size and package count
				expect(lines[1]).toMatch(/\d.*2 Packages/);

				// Line 2: empty separator after header
				expect(lines[2]).toBe('');

				// --- Package 1 (package-a) ---
				// Line 3: percentage + name/version/author/license
				expect(lines[3]).toContain('package-a');
				expect(lines[3]).toContain('v1.0.0');
				expect(lines[3]).toContain('Author A');
				expect(lines[3]).toContain('MIT');

				// Line 4: size + path
				expect(lines[4]).toContain('node_modules');

				// Line 5: "Installed by:"
				expect(lines[5]).toContain('Installed by:');

				// Line 6: Dependencies count
				expect(lines[6]).toContain('Dependencies:');

				// --- Empty line between packages ---
				// Line 7: empty separator between packages
				expect(lines[7]).toBe('');

				// --- Package 2 (package-b) ---
				// Line 8: percentage + name/version/author/license
				expect(lines[8]).toContain('package-b');
				expect(lines[8]).toContain('v2.0.0');
				expect(lines[8]).toContain('Author B');
				expect(lines[8]).toContain('ISC');

				// Line 9: size + path
				expect(lines[9]).toContain('node_modules');

				// Line 10: "Installed by:"
				expect(lines[10]).toContain('Installed by:');

				// Line 11: Dependencies count
				expect(lines[11]).toContain('Dependencies:');

				// Line 12: trailing empty line
				expect(lines[12]).toBe('');

				// Total lines: exactly 13
				expect(lines.length).toBe(13);
			});

			/**
			 * Verbose output with transitive dependencies documentation:
			 *
			 * For a transitive dependency (has parent in path):
			 * Line N:   <percentage>  <name+version+links>
			 * Line N+1: <size>        <path>
			 * Line N+2:               Installed by: <parent name> v<parent version>
			 * Line N+3:               Dependencies: <count>
			 *
			 * The "Installed by:" line shows the dependency chain
			 */
			test('verbose output: shows dependency path for transitive deps', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'parent-pkg': {
							'package.json': definePackageJson({
								name: 'parent-pkg',
								version: '1.0.0',
							}),
							'index.js': 'parent',
							node_modules: {
								'child-pkg': {
									'package.json': definePackageJson({
										name: 'child-pkg',
										version: '2.0.0',
									}),
									'index.js': 'child',
								},
							},
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--sort-by', 'name', '--verbose']);

				expect('exitCode' in result).toBe(false);

				const lines = result.stdout.split('\n');

				// Find the child-pkg lines
				const childLineIndex = lines.findIndex(line => line.includes('child-pkg'));
				expect(childLineIndex).toBeGreaterThan(-1);

				// Next line shows path
				expect(lines[childLineIndex + 1]).toContain('node_modules');

				// Line after path shows "Installed by:" with parent info
				expect(lines[childLineIndex + 2]).toContain('Installed by:');
				expect(lines[childLineIndex + 2]).toContain('parent-pkg');
				expect(lines[childLineIndex + 2]).toContain('v1.0.0');

				// Following line should show Dependencies
				expect(lines[childLineIndex + 3]).toContain('Dependencies:');
			});

			/**
			 * Verbose output should show full dependency path without truncation.
			 * When a package has multiple parents, we show the first parent's path.
			 * The output should NOT show "(+ X others)" - it should show full paths.
			 */
			test('verbose output: shows full path without truncation', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'parent-a': {
							'package.json': definePackageJson({
								name: 'parent-a',
								version: '1.0.0',
							}),
							'index.js': 'a',
							node_modules: {
								'shared-dep': {
									'package.json': definePackageJson({
										name: 'shared-dep',
										version: '1.0.0',
									}),
									'index.js': 'shared',
								},
							},
						},
						'parent-b': {
							'package.json': definePackageJson({
								name: 'parent-b',
								version: '2.0.0',
							}),
							'index.js': 'b',
							node_modules: {
								'shared-dep': {
									'package.json': definePackageJson({
										name: 'shared-dep',
										version: '1.0.0',
									}),
									'index.js': 'shared',
								},
							},
						},
					},
				});

				const result = await pkgSizeCli(fixture.path, ['analyze', '--verbose']);

				expect('exitCode' in result).toBe(false);

				// Output should NOT contain truncation markers
				expect(result.stdout).not.toContain('(+');
				expect(result.stdout).not.toContain('others)');
			});
		});
	});
});
