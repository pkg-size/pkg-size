import { describe, expect } from 'manten';
import { parseAuthor } from '../../src/utils/parse-author.js';

await describe('parseAuthor', ({ test }) => {
	// Plain names
	test('plain name', () => {
		expect(parseAuthor('GitHub Inc.')).toEqual({ name: 'GitHub Inc.' });
	});

	test('plain name - single word', () => {
		expect(parseAuthor('Sentry')).toEqual({ name: 'Sentry' });
	});

	test('plain name - Rich Harris', () => {
		expect(parseAuthor('Rich Harris')).toEqual({ name: 'Rich Harris' });
	});

	// Name with email
	test('name with email in angle brackets', () => {
		expect(parseAuthor('Jordan Harband <ljharb@gmail.com>')).toEqual({ name: 'Jordan Harband' });
	});

	test('name with email - Simon Boudrias', () => {
		expect(parseAuthor('Simon Boudrias <admin@simonboudrias.com>')).toEqual({ name: 'Simon Boudrias' });
	});

	// Name with URL
	test('name with URL in parentheses', () => {
		expect(parseAuthor('Jon Schlinkert (https://github.com/jonschlinkert)')).toEqual({
			name: 'Jon Schlinkert',
			url: 'https://github.com/jonschlinkert',
		});
	});

	test('name with URL - The Babel Team', () => {
		expect(parseAuthor('The Babel Team (https://babel.dev/team)')).toEqual({
			name: 'The Babel Team',
			url: 'https://babel.dev/team',
		});
	});

	test('name with URL - Gregor Martynus', () => {
		expect(parseAuthor('Gregor Martynus (https://github.com/gr2m)')).toEqual({
			name: 'Gregor Martynus',
			url: 'https://github.com/gr2m',
		});
	});

	// Name with email AND URL
	test('name with email and URL', () => {
		expect(parseAuthor('Titus Wormer <tituswormer@gmail.com> (https://wooorm.com)')).toEqual({
			name: 'Titus Wormer',
			url: 'https://wooorm.com',
		});
	});

	test('name with email and URL - Isaac Z. Schlueter', () => {
		expect(parseAuthor('Isaac Z. Schlueter <i@izs.me> (http://blog.izs.me/)')).toEqual({
			name: 'Isaac Z. Schlueter',
			url: 'http://blog.izs.me/',
		});
	});

	test('name with email and URL - Domenic Denicola', () => {
		expect(parseAuthor('Domenic Denicola <d@domenic.me> (https://domenic.me/)')).toEqual({
			name: 'Domenic Denicola',
			url: 'https://domenic.me/',
		});
	});

	// Non-URL parentheses (should strip but not link)
	test('name with non-URL in parentheses', () => {
		expect(parseAuthor('Some Name (not-a-url)')).toEqual({ name: 'Some Name' });
	});

	// Empty or invalid
	test('empty string', () => {
		expect(parseAuthor('')).toBeNull();
	});

	test('just an email', () => {
		expect(parseAuthor('bdehamer@github.com')).toBeNull();
	});

	test('just a handle with @', () => {
		expect(parseAuthor('@hshoff')).toBeNull();
	});

	// Special cases
	test('name with Twitter-style handle', () => {
		// "Tobias Koppers @sokra" - has @ but also has a name before it
		// Current implementation will return null because name includes @
		expect(parseAuthor('Tobias Koppers @sokra')).toBeNull();
	});

	test('Korean name with email', () => {
		expect(parseAuthor('강동윤 <kdy1997.dev@gmail.com>')).toEqual({ name: '강동윤' });
	});

	test('name with URL using http (not https)', () => {
		expect(parseAuthor('Nathan Rajlich <nathan@tootallnate.net> (http://n8.io/)')).toEqual({
			name: 'Nathan Rajlich',
			url: 'http://n8.io/',
		});
	});
});
