import fsp from 'node:fs/promises';
import path from 'node:path';
import type { PackageJson } from 'type-fest';
import { fsExists } from '../../utils/fs-exists.js';

export type PackageMetadata = {
	version: string;
	license?: string;
	author?: string;
	repository?: string;
	homepage?: string;
	funding?: string;
};

const normalizeAuthor = (
	author: PackageJson.Person | undefined,
): string | undefined => {
	if (!author) {
		return undefined;
	}
	if (typeof author === 'string') {
		return author;
	}
	return author.email
		? `${author.name} <${author.email}>`
		: author.name;
};

// Handle legacy license formats: object { type, url } or array of objects
const normalizeLicense = (
	license: unknown,
	licenses: PackageJson['licenses'],
): string | undefined => {
	if (typeof license === 'string') {
		return license;
	}
	// Handle legacy object format: { type: "MIT", url: "..." }
	if (license && typeof license === 'object' && 'type' in license) {
		const licenseObject = license as { type?: string };
		if (typeof licenseObject.type === 'string') {
			return licenseObject.type;
		}
	}
	// Fall back to deprecated licenses array
	if (licenses && licenses.length > 0) {
		return licenses
			.map(l => l.type)
			.filter(Boolean)
			.join(', ') || undefined;
	}
	return undefined;
};

// Repository can be string or object { type, url }
const normalizeRepository = (
	repository: PackageJson['repository'],
): string | undefined => {
	if (!repository) {
		return undefined;
	}
	if (typeof repository === 'string') {
		// Handle shorthand like "github:user/repo"
		if (repository.startsWith('github:')) {
			return `https://github.com/${repository.slice(7)}`;
		}
		if (repository.startsWith('gitlab:')) {
			return `https://gitlab.com/${repository.slice(7)}`;
		}
		if (repository.startsWith('bitbucket:')) {
			return `https://bitbucket.org/${repository.slice(10)}`;
		}
		// Plain "user/repo" format typically means GitHub
		if (/^[\w-]+\/[\w-]+$/.test(repository)) {
			return `https://github.com/${repository}`;
		}
		return repository;
	}
	if (typeof repository.url === 'string') {
		let { url } = repository;
		// Convert git:// and git+https:// to https://
		url = url.replace(/^git\+/, '').replace(/^git:\/\//, 'https://');
		// Remove .git suffix
		url = url.replace(/\.git$/, '');
		return url;
	}
	return undefined;
};

// Funding can be string, object { url }, or array
const normalizeFunding = (
	funding: PackageJson['funding'],
): string | undefined => {
	if (!funding) {
		return undefined;
	}
	if (typeof funding === 'string') {
		return funding;
	}
	if (Array.isArray(funding)) {
		// Take first funding URL
		const first = funding[0];
		if (typeof first === 'string') {
			return first;
		}
		if (first && typeof first.url === 'string') {
			return first.url;
		}
		return undefined;
	}
	if (typeof funding.url === 'string') {
		return funding.url;
	}
	return undefined;
};

export const getPackageMetadata = async (
	packageDirectory: string,
): Promise<PackageMetadata> => {
	const packageJsonPath = path.join(packageDirectory, 'package.json');
	const exists = await fsExists(packageJsonPath);
	if (!exists) {
		return { version: '' };
	}

	try {
		const content = await fsp.readFile(packageJsonPath, 'utf8');
		const packageJson = JSON.parse(content) as PackageJson;
		return {
			version: packageJson.version ?? '',
			license: normalizeLicense(packageJson.license, packageJson.licenses),
			author: normalizeAuthor(packageJson.author),
			repository: normalizeRepository(packageJson.repository),
			homepage: packageJson.homepage,
			funding: normalizeFunding(packageJson.funding),
		};
	} catch {
		return { version: '' };
	}
};
