import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name: string; version: string };

/** MCP server package version from package.json. */
export const PACKAGE_VERSION = pkg.version;

/** Published npm package name. */
export const PACKAGE_NAME = pkg.name;
