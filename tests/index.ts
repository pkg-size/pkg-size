import { describe } from 'manten';
import getNode from 'get-node';
import apiTests from './specs/api.js';
import cliTests from './specs/cli.js';
import lockfileParserTests from './specs/lockfile-parser.js';
import pnpmParserTests from './specs/pnpm-parser.js';
import packageUtilsTests from './specs/package-utils.js';
import sortingTests from './specs/sorting.js';
import parseAuthorTests from './specs/parse-author.js';
import { createPkgSizeCli } from './utils/pkg-size.js';

const nodeVersions = [
	process.version,
	...(
		process.env.CI
			? ['20.19.0']
			: []
	),
];

(async () => {
	for (const nodeVersion of nodeVersions) {
		const node = (
			nodeVersion === process.version
				? {
					path: process.execPath,
					version: process.version,
				}
				: await getNode(nodeVersion)
		);

		await describe(`Node ${node.version}`, ({ runTestSuite }) => {
			const cli = createPkgSizeCli(node.path);

			runTestSuite(apiTests);
			runTestSuite(cliTests, cli);
			runTestSuite(lockfileParserTests);
			runTestSuite(pnpmParserTests);
			runTestSuite(packageUtilsTests);
			runTestSuite(sortingTests);
			runTestSuite(parseAuthorTests);
		});
	}
})();
