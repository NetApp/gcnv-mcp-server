import { createRequire } from 'module';
import { logger } from '../logger.js';

const log = logger.child({ module: 'ontap-index-loader' });

// Subpath import "#resources/*" is anchored to the package root, so the
// same specifier resolves in dev, build output, and installed packages.
const requireFromHere = createRequire(import.meta.url);

export interface IndexEndpoint {
  resource: string;
  keywords: string[];
  method: string;
  path: string;
  pathParams: string[];
  description: string;
  hint: string | null;
  body: unknown;
  requiredBody?: string[][];
}

export interface IndexCategory {
  resource: string;
  count: number;
}

export interface IndexProvenance {
  swaggerSha?: string;
  rbacSha?: string;
  proxyOverlaySha?: string;
  generatedAt?: string;
  generator?: string;
}

export interface ApiIndex {
  synonyms: Record<string, string[]>;
  categories: IndexCategory[];
  endpoints: IndexEndpoint[];
  provenance?: IndexProvenance;
}

/** Raw on-disk shape. Unknown keys (legacy version / decision fields) are ignored. */
interface RawIndexEndpoint {
  resource: string;
  keywords: string[];
  method: string;
  path: string;
  pathParams: string[];
  description: string;
  hint: string | null;
  body: unknown;
  requiredBody?: string[][];
}

interface RawApiIndex {
  synonyms?: Record<string, string[]>;
  categories: IndexCategory[];
  endpoints: RawIndexEndpoint[];
  provenance?: IndexProvenance;
}

let cachedIndex: ApiIndex | null = null;

function normalizeIndex(raw: RawApiIndex): ApiIndex {
  return {
    synonyms: raw.synonyms ?? {},
    categories: raw.categories,
    endpoints: raw.endpoints.map((ep) => ({
      resource: ep.resource,
      keywords: ep.keywords,
      method: ep.method,
      path: ep.path,
      pathParams: ep.pathParams,
      description: ep.description,
      hint: ep.hint,
      body: ep.body,
      ...(ep.requiredBody ? { requiredBody: ep.requiredBody } : {}),
    })),
    provenance: raw.provenance,
  };
}

export function loadIndex(): Promise<ApiIndex> {
  if (cachedIndex) return Promise.resolve(cachedIndex);

  log.info('Loading ONTAP API index');

  const raw = requireFromHere('#resources/ontap-api-index.json') as RawApiIndex;
  cachedIndex = normalizeIndex(raw);

  log.info(
    {
      categories: cachedIndex.categories.length,
      endpoints: cachedIndex.endpoints.length,
    },
    'ONTAP API index loaded'
  );
  return Promise.resolve(cachedIndex);
}

/** Test-only: reset the cached index. */
export function _resetIndexCache(): void {
  cachedIndex = null;
}
