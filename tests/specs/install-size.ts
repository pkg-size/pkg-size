import path from 'path';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { detectPackageManager, isLocalPath } from '../../src/install-size.js';
import type { PkgSizeCli } from '../utils/pkg-size.js';

export default testSuite(({ describe }, pkgSizeCli: PkgSizeCli) => {
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
});
