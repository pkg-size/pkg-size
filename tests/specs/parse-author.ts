import { testSuite, expect } from 'manten';
import { parseAuthor, getAuthorDisplayName } from '../../src/utils/parse-author.js';

export default testSuite(({ describe }) => {
	describe('parseAuthor', ({ describe }) => {
		describe('name only', ({ test }) => {
			test('plain name', () => {
				expect(parseAuthor('Acme Inc.')).toEqual({ name: 'Acme Inc.' });
			});

			test('single word', () => {
				expect(parseAuthor('TestCorp')).toEqual({ name: 'TestCorp' });
			});

			test('two words', () => {
				expect(parseAuthor('John Smith')).toEqual({ name: 'John Smith' });
			});

			// parse-author uses /\w/ which doesn't match Korean characters,
			// but fallback logic preserves the name
			test('Korean characters (fallback)', () => {
				expect(parseAuthor('김철수')).toEqual({ name: '김철수' });
			});
		});

		describe('name with email', ({ test }) => {
			test('standard format', () => {
				expect(parseAuthor('John Smith <john@example.com>')).toEqual({
					name: 'John Smith',
					email: 'john@example.com',
				});
			});

			test('multiple words in name', () => {
				expect(parseAuthor('Jane Marie Smith <jane@example.com>')).toEqual({
					name: 'Jane Marie Smith',
					email: 'jane@example.com',
				});
			});

			test('Korean name with email', () => {
				expect(parseAuthor('김철수 <test@example.com>')).toEqual({
					name: '김철수',
					email: 'test@example.com',
				});
			});
		});

		describe('name with URL', ({ test }) => {
			test('https URL', () => {
				expect(parseAuthor('John Smith (https://github.com/johnsmith)')).toEqual({
					name: 'John Smith',
					url: 'https://github.com/johnsmith',
				});
			});

			test('http URL', () => {
				expect(parseAuthor('Jane Doe (http://example.io/)')).toEqual({
					name: 'Jane Doe',
					url: 'http://example.io/',
				});
			});

			test('team name with URL', () => {
				expect(parseAuthor('The Test Team (https://test.dev/team)')).toEqual({
					name: 'The Test Team',
					url: 'https://test.dev/team',
				});
			});

			// parse-author extracts any parenthesized content as URL
			test('non-URL in parentheses is extracted as URL', () => {
				expect(parseAuthor('Some Name (not-a-url)')).toEqual({
					name: 'Some Name',
					url: 'not-a-url',
				});
			});
		});

		describe('name with email and URL', ({ test }) => {
			test('all three parts', () => {
				expect(parseAuthor('Tom Brown <tom@example.com> (https://tombrown.com)'))
					.toEqual({
						name: 'Tom Brown',
						email: 'tom@example.com',
						url: 'https://tombrown.com',
					});
			});

			test('http URL', () => {
				expect(parseAuthor('Sam W. Wilson <s@test.me> (http://blog.test.me/)')).toEqual({
					name: 'Sam W. Wilson',
					email: 's@test.me',
					url: 'http://blog.test.me/',
				});
			});

			test('trailing slash in URL', () => {
				expect(parseAuthor('Dan Miller <d@test.me> (https://test.me/)')).toEqual({
					name: 'Dan Miller',
					email: 'd@test.me',
					url: 'https://test.me/',
				});
			});
		});

		describe('email only', ({ test }) => {
			// parse-author treats bare email as name (no angle brackets)
			test('bare email is treated as name', () => {
				expect(parseAuthor('user@example.com')).toEqual({ name: 'user@example.com' });
			});

			test('email in angle brackets only', () => {
				expect(parseAuthor('<someone@example.com>')).toEqual({
					email: 'someone@example.com',
				});
			});
		});

		describe('URL only', ({ test }) => {
			// parse-author treats bare URL as name (no parentheses)
			test('bare https URL is treated as name', () => {
				expect(parseAuthor('https://example.com')).toEqual({ name: 'https://example.com' });
			});

			test('bare http URL is treated as name', () => {
				expect(parseAuthor('http://example.com')).toEqual({ name: 'http://example.com' });
			});

			test('URL in parentheses only', () => {
				expect(parseAuthor('(https://example.com)')).toEqual({ url: 'https://example.com' });
			});
		});

		describe('quoted names', ({ test }) => {
			test('single quotes with email', () => {
				expect(parseAuthor("'Jane Doe' <jane@example.com>")).toEqual({
					name: 'Jane Doe',
					email: 'jane@example.com',
				});
			});

			test('double quotes with email', () => {
				expect(parseAuthor('"John Doe" <john@example.com>')).toEqual({
					name: 'John Doe',
					email: 'john@example.com',
				});
			});

			test('single quotes only', () => {
				expect(parseAuthor("'Quoted Name'")).toEqual({ name: 'Quoted Name' });
			});

			test('double quotes only', () => {
				expect(parseAuthor('"Quoted Name"')).toEqual({ name: 'Quoted Name' });
			});
		});

		// parse-author does NOT strip social handles - they become part of the name
		// This is actually better behavior than our previous implementation
		describe('social handles (preserved by parse-author)', ({ test }) => {
			test('name with handle keeps full string', () => {
				expect(parseAuthor('Test Author @testhandle')).toEqual({
					name: 'Test Author @testhandle',
				});
			});

			test('handle only returns name', () => {
				expect(parseAuthor('@testhandle')).toEqual({ name: '@testhandle' });
			});

			test('handle with spaces keeps full string', () => {
				expect(parseAuthor('Some Person @ handle')).toEqual({
					name: 'Some Person @ handle',
				});
			});
		});

		describe('empty and invalid', ({ test }) => {
			test('empty string', () => {
				expect(parseAuthor('')).toBeNull();
			});

			test('whitespace only', () => {
				expect(parseAuthor('   ')).toBeNull();
			});
		});

		// parse-author handles many edge cases better than our previous implementation
		describe('edge cases and malformed input', ({ test }) => {
			// parse-author preserves @ in names (no aggressive handle stripping)
			test('organization with @ in name (preserved)', () => {
				expect(parseAuthor('My Org @ Scope')).toEqual({ name: 'My Org @ Scope' });
			});

			test('company with @ department (preserved)', () => {
				expect(parseAuthor('Company @ Department')).toEqual({ name: 'Company @ Department' });
			});

			// parse-author can't parse these, fallback preserves as name
			test('URL not at end (fallback)', () => {
				expect(parseAuthor('Name (http://site.com) [maintainer]')).toEqual({
					name: 'Name (http://site.com) [maintainer]',
				});
			});

			test('URL followed by extra text (fallback)', () => {
				expect(parseAuthor('Name (https://example.com) extra')).toEqual({
					name: 'Name (https://example.com) extra',
				});
			});

			// Malformed input - fallback preserves the raw string as name
			test('malformed: unclosed angle bracket (fallback)', () => {
				expect(parseAuthor('Name <broken-email')).toEqual({
					name: 'Name <broken-email',
				});
			});

			test('malformed: unclosed parenthesis (fallback)', () => {
				expect(parseAuthor('Name (http://url')).toEqual({
					name: 'Name (http://url',
				});
			});

			test('malformed: mixed broken delimiters extracts what it can', () => {
				expect(parseAuthor('Name <broken-email (http://url)')).toEqual({
					name: 'Name',
					email: 'broken-email (http://url',
				});
			});

			// Reversed order (URL before email) works
			test('reversed order: URL then email extracts all parts', () => {
				expect(parseAuthor('Name (https://site.com) <email@example.com>')).toEqual({
					name: 'Name',
					email: 'email@example.com',
					url: 'https://site.com',
				});
			});

			// parse-author correctly handles scoped packages (no longer a bug!)
			test('scoped package as author is preserved as name', () => {
				expect(parseAuthor('@scope/package')).toEqual({ name: '@scope/package' });
			});
		});

		// Real-world patterns (with anonymized data)
		describe('real-world patterns', ({ test }) => {
			test('quoted name with email', () => {
				expect(parseAuthor("'James Wilson' <james@example.com>")).toEqual({
					name: 'James Wilson',
					email: 'james@example.com',
				});
			});

			test('CJK name with email', () => {
				expect(parseAuthor('测试用户 <test@example.com>')).toEqual({
					name: '测试用户',
					email: 'test@example.com',
				});
			});

			test('multiple authors (graceful degradation)', () => {
				const result = parseAuthor('First Author (https://example.com), Second Author');
				expect(result?.name).toContain('First Author');
				expect(result?.name).toContain('Second Author');
			});

			test('missing closing angle bracket (fallback)', () => {
				expect(parseAuthor('Test User <test@example.com')).toEqual({
					name: 'Test User <test@example.com',
				});
			});
		});
	});

	describe('getAuthorDisplayName', ({ test }) => {
		test('returns name when present', () => {
			expect(getAuthorDisplayName({
				name: 'John',
				email: 'j@e.com',
				url: 'https://x.com',
			}))
				.toBe('John');
		});

		test('falls back to email when no name', () => {
			expect(getAuthorDisplayName({
				email: 'j@e.com',
				url: 'https://x.com',
			})).toBe('j@e.com');
		});

		test('falls back to url when no name or email', () => {
			expect(getAuthorDisplayName({ url: 'https://x.com' })).toBe('https://x.com');
		});

		test('returns null for empty object', () => {
			expect(getAuthorDisplayName({})).toBeNull();
		});

		test('returns null for null input', () => {
			expect(getAuthorDisplayName(null)).toBeNull();
		});

		test('returns null for undefined input', () => {
			expect(getAuthorDisplayName(undefined)).toBeNull();
		});
	});
});
