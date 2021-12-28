import pkgSize from '../dist/pkg-size.js';

test('asdf', async () => {
	const a = await pkgSize(__dirname + '/package-a');
	console.log(a);
});
