import { describe } from 'manten';
import getNode from 'get-node';
import apiTests from './specs/api.js';
import cliTests from './specs/cli.js';
import installSizeTests from './specs/install-size.js';
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
			runTestSuite(installSizeTests, cli);
		});
	}
})();
