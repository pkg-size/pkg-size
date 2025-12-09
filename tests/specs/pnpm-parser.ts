import { testSuite, expect } from 'manten';
import { parsePnpmDirName } from '../../src/install/strategies/pnpm.js';

export default testSuite(({ describe }) => {
	describe('pnpm-parser', ({ describe }) => {
		describe('parsePnpmDirName', ({ test }) => {
			// Standard packages
			test('parses standard package: lodash@4.17.21', () => {
				const result = parsePnpmDirName('lodash@4.17.21');

				expect(result).toEqual({
					name: 'lodash',
					version: '4.17.21',
				});
			});

			test('parses package with prerelease version: react@18.0.0-rc.0', () => {
				const result = parsePnpmDirName('react@18.0.0-rc.0');

				expect(result).toEqual({
					name: 'react',
					version: '18.0.0-rc.0',
				});
			});

			// Scoped packages (@ → + in filesystem)
			test('parses scoped package: @scope+pkg@1.0.0', () => {
				const result = parsePnpmDirName('@scope+pkg@1.0.0');

				expect(result).toEqual({
					name: '@scope/pkg',
					version: '1.0.0',
				});
			});

			test('parses @types scoped package: @types+node@20.0.0', () => {
				const result = parsePnpmDirName('@types+node@20.0.0');

				expect(result).toEqual({
					name: '@types/node',
					version: '20.0.0',
				});
			});

			test('parses @babel scoped package: @babel+core@7.24.0', () => {
				const result = parsePnpmDirName('@babel+core@7.24.0');

				expect(result).toEqual({
					name: '@babel/core',
					version: '7.24.0',
				});
			});

			// Peer dependency suffixes (stripped)
			test('strips peer dep suffix: is-odd@3.0.1_is-number@6.0.0', () => {
				const result = parsePnpmDirName('is-odd@3.0.1_is-number@6.0.0');

				// Peer dep suffix after _ is stripped
				expect(result).toEqual({
					name: 'is-odd',
					version: '3.0.1',
				});
			});

			test('strips complex peer dep suffix: foo@1.0.0_bar@2.0.0+@scope+qar@3.0.0', () => {
				const result = parsePnpmDirName('foo@1.0.0_bar@2.0.0+@scope+qar@3.0.0');

				// Everything after first _ is stripped
				expect(result).toEqual({
					name: 'foo',
					version: '1.0.0',
				});
			});

			test('handles scoped package with peer deps: @scope+pkg@1.0.0_peer@2.0.0', () => {
				const result = parsePnpmDirName('@scope+pkg@1.0.0_peer@2.0.0');

				expect(result).toEqual({
					name: '@scope/pkg',
					version: '1.0.0',
				});
			});

			// Edge cases
			test('returns undefined for no @ symbol', () => {
				const result = parsePnpmDirName('invalid-no-at');

				expect(result).toBeUndefined();
			});

			test('returns undefined for @ only at start (no version)', () => {
				// @scope+pkg with no version
				const result = parsePnpmDirName('@scope+pkg');

				expect(result).toBeUndefined();
			});

			test('returns undefined for empty version', () => {
				const result = parsePnpmDirName('pkg@');

				expect(result).toBeUndefined();
			});

			test('returns undefined for MD5 hashed directory names', () => {
				// pnpm hashes long paths with MD5
				const result = parsePnpmDirName('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');

				expect(result).toBeUndefined();
			});

			// Git references (user+repo format)
			test('parses git ref format: github+user+repo@commit', () => {
				const result = parsePnpmDirName('github+user+repo@abc1234');

				// + in name part becomes /, version is the commit
				expect(result).toEqual({
					name: 'github/user+repo', // Only first + converted
					version: 'abc1234',
				});
			});

			// npm aliases
			test('parses npm alias: npm+package-alias@1.0.0', () => {
				const result = parsePnpmDirName('npm+package-alias@1.0.0');

				expect(result).toEqual({
					name: 'npm/package-alias',
					version: '1.0.0',
				});
			});

			// Version edge cases
			test('parses version with build metadata: pkg@1.0.0+build123', () => {
				const result = parsePnpmDirName('pkg@1.0.0+build123');

				expect(result).toEqual({
					name: 'pkg',
					version: '1.0.0+build123',
				});
			});

			test('parses version with multiple dots: pkg@1.2.3.4.5', () => {
				const result = parsePnpmDirName('pkg@1.2.3.4.5');

				expect(result).toEqual({
					name: 'pkg',
					version: '1.2.3.4.5',
				});
			});
		});
	});
});
