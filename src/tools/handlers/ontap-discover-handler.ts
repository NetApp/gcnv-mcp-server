import { createRequire } from 'node:module';
import { ToolHandler } from '../../types/tool.js';
import { loadIndex, _resetIndexCache, IndexEndpoint } from '../../utils/ontap-index-loader.js';
import { discoverViaKg } from '../../utils/ontap-kg-client.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'ontap-discover-handler' });
const require = createRequire(import.meta.url);
const { version: packageVersion } = require('../../../package.json') as { version?: string };
const CLIENT_VERSION =
  typeof packageVersion === 'string' && packageVersion.trim() ? packageVersion : '0.0.0';
const DEFAULT_MAX_RESULTS = 10;

export { _resetIndexCache };

// ---------------------------------------------------------------------------
// Search scoring
// ---------------------------------------------------------------------------
const WEIGHT_RESOURCE = 10;
const WEIGHT_KEYWORD = 5;
const WEIGHT_DESCRIPTION = 2;
const WEIGHT_PATH = 1;
const SYNONYM_BOOST = 8;
const METHOD_INTENT_BOOST = 6;
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const PREFIX_MATCH_FACTOR = 0.6;
const PATH_PARAM_MATCH_BOOST = 6;
const LAST_SEGMENT_MATCH_BOOST = 4;
const LAST_QUERY_TOKEN_SEGMENT_BOOST = 20;
const COLLECTION_CREATE_BOOST = 3;
const DELETE_SPECIFICITY_BOOST = 4;
const RESOURCE_TOKEN_MATCH_BOOST = 10;

/** Discover response shape. `resource` is omitted in resource-mode (it lives on the parent). */
interface DiscoverEndpoint {
  resource?: string;
  keywords: string[];
  method: string;
  path: string;
  pathParams: string[];
  description: string;
  hint: string | null;
  body: unknown;
  requiredBody?: string[][];
}

interface Bm25Document {
  endpoint: IndexEndpoint;
  termFrequency: Map<string, number>;
  length: number;
}

interface Bm25Corpus {
  documents: Bm25Document[];
  documentFrequency: Map<string, number>;
  averageDocumentLength: number;
  documentCount: number;
}

const bm25CorpusCache = new WeakMap<IndexEndpoint[], Bm25Corpus>();

function tokenVariants(token: string): string[] {
  const variants = new Set([token]);

  if (token.endsWith('ies') && token.length > 4) {
    variants.add(`${token.slice(0, -3)}y`);
  } else if (/(ches|shes|xes|zes)$/.test(token)) {
    variants.add(token.slice(0, -2));
  } else if (token.endsWith('s') && token.length > 3) {
    variants.add(token.slice(0, -1));
  }

  return [...variants];
}

function tokenizeText(text: string): string[] {
  const rawTokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return rawTokens.flatMap(tokenVariants);
}

function collectObjectFieldPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [];

  if (Array.isArray(value)) {
    return value.length > 0 ? collectObjectFieldPaths(value[0], prefix) : [];
  }

  const paths: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    paths.push(...collectObjectFieldPaths(child, path));
  }
  return paths;
}

function addWeightedTerms(
  termFrequency: Map<string, number>,
  text: string | null | undefined,
  weight: number
): number {
  if (!text) return 0;

  let added = 0;
  for (const token of new Set(tokenizeText(text))) {
    termFrequency.set(token, (termFrequency.get(token) ?? 0) + weight);
    added += weight;
  }
  return added;
}

function buildBm25Document(endpoint: IndexEndpoint): Bm25Document {
  const termFrequency = new Map<string, number>();
  let length = 0;

  length += addWeightedTerms(termFrequency, endpoint.resource, WEIGHT_RESOURCE);
  for (const keyword of endpoint.keywords) {
    length += addWeightedTerms(termFrequency, keyword, WEIGHT_KEYWORD);
  }
  length += addWeightedTerms(termFrequency, endpoint.description, WEIGHT_DESCRIPTION);
  length += addWeightedTerms(termFrequency, endpoint.hint, WEIGHT_DESCRIPTION);
  length += addWeightedTerms(termFrequency, endpoint.path, WEIGHT_PATH);
  for (const pathParam of endpoint.pathParams) {
    length += addWeightedTerms(termFrequency, pathParam, WEIGHT_KEYWORD);
  }
  for (const bodyField of collectObjectFieldPaths(endpoint.body)) {
    length += addWeightedTerms(termFrequency, bodyField, WEIGHT_PATH);
  }
  for (const requiredGroup of endpoint.requiredBody ?? []) {
    for (const requiredField of requiredGroup) {
      length += addWeightedTerms(termFrequency, requiredField, WEIGHT_KEYWORD);
    }
  }

  return {
    endpoint,
    termFrequency,
    length,
  };
}

function getBm25Corpus(endpoints: IndexEndpoint[]): Bm25Corpus {
  const cached = bm25CorpusCache.get(endpoints);
  if (cached) return cached;

  const documents = endpoints.map(buildBm25Document);
  const documentFrequency = new Map<string, number>();
  let totalLength = 0;

  for (const document of documents) {
    totalLength += document.length;
    for (const term of document.termFrequency.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const corpus = {
    documents,
    documentFrequency,
    averageDocumentLength: documents.length > 0 ? totalLength / documents.length : 0,
    documentCount: documents.length,
  };
  bm25CorpusCache.set(endpoints, corpus);
  return corpus;
}

function scoreBm25Term(
  term: string,
  frequency: number,
  document: Bm25Document,
  corpus: Bm25Corpus
) {
  const documentFrequency = corpus.documentFrequency.get(term) ?? 0;
  if (documentFrequency === 0 || corpus.averageDocumentLength === 0) return 0;

  const idf = Math.log(
    1 + (corpus.documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5)
  );
  const lengthNorm = 1 - BM25_B + BM25_B * (document.length / corpus.averageDocumentLength);
  return idf * ((frequency * (BM25_K1 + 1)) / (frequency + BM25_K1 * lengthNorm));
}

function scoreBm25(queryTokens: string[], document: Bm25Document, corpus: Bm25Corpus): number {
  let score = 0;

  for (const queryToken of new Set(queryTokens)) {
    const exactFrequency = document.termFrequency.get(queryToken);
    if (exactFrequency) {
      score += scoreBm25Term(queryToken, exactFrequency, document, corpus);
    }

    if (queryToken.length < 3) continue;

    for (const [term, frequency] of document.termFrequency) {
      if (term !== queryToken && term.startsWith(queryToken)) {
        score += PREFIX_MATCH_FACTOR * scoreBm25Term(term, frequency, document, corpus);
      }
    }
  }

  return score;
}

function lastStaticPathSegment(path: string): string | undefined {
  return path
    .split('/')
    .filter(Boolean)
    .reverse()
    .find((segment) => !(segment.startsWith('{') && segment.endsWith('}')));
}

function scoreEndpointShape(queryTokens: string[], endpoint: IndexEndpoint): number {
  const tokenSet = new Set(queryTokens);
  let score = 0;

  const resourceTokens = new Set(tokenizeText(endpoint.resource));
  for (const token of resourceTokens) {
    if (tokenSet.has(token)) score += RESOURCE_TOKEN_MATCH_BOOST / resourceTokens.size;
  }

  for (const pathParam of endpoint.pathParams) {
    const pathParamTokens = new Set(tokenizeText(pathParam));
    if (tokenSet.has('uuid') && pathParamTokens.has('uuid')) score += PATH_PARAM_MATCH_BOOST;
  }

  if (queryTokens.length > 1) {
    const lastSegment = lastStaticPathSegment(endpoint.path);
    const lastSegmentTokens = new Set(tokenizeText(lastSegment ?? ''));
    for (const token of lastSegmentTokens) {
      if (tokenSet.has(token)) score += LAST_SEGMENT_MATCH_BOOST;
    }

    const lastQueryToken = queryTokens[queryTokens.length - 1];
    if (lastSegmentTokens.has(lastQueryToken)) score += LAST_QUERY_TOKEN_SEGMENT_BOOST;
  }

  if (tokenSet.has('create') && endpoint.method === 'POST' && endpoint.pathParams.length === 0) {
    score += COLLECTION_CREATE_BOOST;
  }

  if (tokenSet.has('delete') && endpoint.method === 'DELETE') {
    const lastSegTokens = new Set(tokenizeText(lastStaticPathSegment(endpoint.path) ?? ''));
    const targetMatches = queryTokens.some((t) => t !== 'delete' && lastSegTokens.has(t));
    if (targetMatches) {
      score += endpoint.pathParams.length * DELETE_SPECIFICITY_BOOST;
    }
  }

  return score;
}

function projectEndpointForDiscover(
  ep: IndexEndpoint,
  opts: { includeResource: boolean } = { includeResource: false }
): DiscoverEndpoint {
  const out: DiscoverEndpoint = {
    keywords: ep.keywords,
    method: ep.method,
    path: ep.path,
    pathParams: ep.pathParams,
    description: ep.description,
    hint: ep.hint,
    body: ep.body,
  };
  if (ep.requiredBody) out.requiredBody = ep.requiredBody;
  if (opts.includeResource) out.resource = ep.resource;
  return out;
}

function successResult(result: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    structuredContent: { result },
  };
}

/**
 * Puts the top-scoring endpoint from each resource at the head (sorted by
 * score), then the rest in score order. Keeps top-N breadth-first without
 * losing per-resource depth ranking.
 */
function diversifyByResource(
  scored: Array<{ endpoint: IndexEndpoint; score: number }>
): Array<{ endpoint: IndexEndpoint; score: number }> {
  const groups = new Map<string, Array<{ endpoint: IndexEndpoint; score: number }>>();
  for (const entry of scored) {
    const list = groups.get(entry.endpoint.resource);
    if (list) list.push(entry);
    else groups.set(entry.endpoint.resource, [entry]);
  }

  const head: Array<{ endpoint: IndexEndpoint; score: number }> = [];
  const tail: Array<{ endpoint: IndexEndpoint; score: number }> = [];
  for (const list of groups.values()) {
    head.push(list[0]);
    if (list.length > 1) tail.push(...list.slice(1));
  }

  head.sort(compareScoredEndpoints);
  tail.sort(compareScoredEndpoints);

  return [...head, ...tail];
}

function mutatingSpecificity(ep: IndexEndpoint): number {
  return ep.method === 'PATCH' || ep.method === 'DELETE' ? ep.pathParams.length : 0;
}

function compareScoredEndpoints(
  a: { endpoint: IndexEndpoint; score: number },
  b: { endpoint: IndexEndpoint; score: number }
): number {
  return (
    b.score - a.score ||
    mutatingSpecificity(b.endpoint) - mutatingSpecificity(a.endpoint) ||
    a.endpoint.path.localeCompare(b.endpoint.path)
  );
}

function inferMethodIntent(tokens: string[]): Set<IndexEndpoint['method']> {
  const methods = new Set<IndexEndpoint['method']>();
  const tokenSet = new Set(tokens);

  if (
    ['create', 'add', 'begin', 'start', 'establish', 'provision'].some((token) =>
      tokenSet.has(token)
    )
  ) {
    methods.add('POST');
  }
  if (['delete', 'remove', 'end', 'abort', 'destroy'].some((token) => tokenSet.has(token))) {
    methods.add('DELETE');
  }
  if (
    ['update', 'modify', 'resize', 'patch', 'accept', 'reject', 'change'].some((token) =>
      tokenSet.has(token)
    )
  ) {
    methods.add('PATCH');
  }
  if (
    ['get', 'list', 'show', 'find', 'check', 'status', 'retrieve', 'view'].some((token) =>
      tokenSet.has(token)
    )
  ) {
    methods.add('GET');
  }

  return methods;
}

/** Map resource -> accumulated synonym-boost score for the search tokens. */
function expandSynonyms(
  tokens: string[],
  synonyms: Record<string, string[]>,
  rawQuery: string
): Map<string, number> {
  const boosts = new Map<string, number>();
  const queryLower = rawQuery.toLowerCase();

  function addBoost(resource: string, points: number) {
    boosts.set(resource, (boosts.get(resource) ?? 0) + points);
  }

  for (const [phrase, resources] of Object.entries(synonyms)) {
    const phraseLower = phrase.toLowerCase();

    // Multi-word phrase match (e.g. "file share", "legal hold", "data protection")
    if (phraseLower.includes(' ') && queryLower.includes(phraseLower)) {
      for (const r of resources) addBoost(r, SYNONYM_BOOST);
      continue;
    }

    for (const token of tokens) {
      // Exact single-word match
      if (phraseLower === token) {
        for (const r of resources) addBoost(r, SYNONYM_BOOST);
      }
      // Prefix match on synonym key (e.g. "rep" matches "replicate", "replication")
      else if (phraseLower.startsWith(token) && token.length >= 3) {
        for (const r of resources) addBoost(r, Math.floor(SYNONYM_BOOST / 2));
      }
    }
  }

  return boosts;
}

export const ontapDiscoverHandler: ToolHandler = async (args) => {
  try {
    const { resource, search } = args;
    const kgKind = !resource && !search ? 'categories' : resource ? 'resource' : 'search';
    let searchLimit = DEFAULT_MAX_RESULTS;
    if (kgKind === 'search') {
      const maxResults = args.maxResults;
      if (maxResults !== undefined && maxResults !== null) {
        if (typeof maxResults !== 'number' || !Number.isInteger(maxResults) || maxResults < 1) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: 'maxResults must be a positive integer. retryable: false',
              },
            ],
          };
        }
        searchLimit = maxResults;
      }
    }
    const remote = await discoverViaKg({
      schemaVersion: 'ontap-kg/1',
      kind: kgKind,
      ...(resource ? { resource: String(resource).toLowerCase() } : {}),
      ...(search ? { search: String(search) } : {}),
      ...(kgKind === 'search' ? { max_results: searchLimit } : {}),
      ...(typeof args.userIntent === 'string'
        ? {
            context: {
              user_intent: args.userIntent,
              client: { name: 'gcnv-mcp', version: CLIENT_VERSION },
            },
          }
        : {}),
    });

    if (remote) {
      if (kgKind === 'categories') {
        return successResult({ categories: remote.categories ?? [] });
      }
      if (kgKind === 'resource') {
        return successResult({
          resource: String(resource).toLowerCase(),
          endpoints: (remote.endpoints ?? []).map((ep) => {
            const clone = { ...ep };
            delete (clone as Record<string, unknown>).resource;
            return clone;
          }),
          ...(typeof remote.suggestion === 'string' ? { suggestion: remote.suggestion } : {}),
        });
      }
      return successResult({
        search,
        endpoints: remote.endpoints ?? [],
        ...(typeof remote.note === 'string' ? { note: remote.note } : {}),
        ...(typeof remote.suggestion === 'string' ? { suggestion: remote.suggestion } : {}),
      });
    }

    const index = await loadIndex();

    // Mode 1: no params -> list all categories.
    if (!resource && !search) {
      const result = {
        categories: index.categories.map(({ resource, count }) => ({ resource, count })),
      };
      return successResult(result);
    }

    // Mode 2: exact resource match (takes precedence over search).
    if (resource) {
      const lowerResource = resource.toLowerCase();
      const endpoints = index.endpoints.filter((e) => e.resource === lowerResource);
      if (endpoints.length === 0) {
        const allResources = index.categories.map((c) => c.resource).join(', ');
        const result = {
          resource: lowerResource,
          endpoints: [],
          suggestion: `No resource category '${lowerResource}' found. Available categories: ${allResources}.`,
        };
        return successResult(result);
      }

      const projected = endpoints.map((ep) =>
        projectEndpointForDiscover(ep, { includeResource: false })
      );
      const result: Record<string, unknown> = {
        resource: lowerResource,
        endpoints: projected,
      };
      return successResult(result);
    }

    // Mode 3: BM25 keyword search with synonym expansion.
    const tokens = tokenizeText(search);
    const synonyms = index.synonyms ?? {};
    const synonymBoosts = expandSynonyms(tokens, synonyms, search);
    const methodIntent = inferMethodIntent(tokens);
    const corpus = getBm25Corpus(index.endpoints);

    const scored: Array<{ endpoint: IndexEndpoint; score: number }> = [];

    for (const document of corpus.documents) {
      let total = scoreBm25(tokens, document, corpus);
      total += scoreEndpointShape(tokens, document.endpoint);
      total += synonymBoosts.get(document.endpoint.resource) ?? 0;
      if (methodIntent.has(document.endpoint.method)) total += METHOD_INTENT_BOOST;

      if (total > 0) {
        scored.push({ endpoint: document.endpoint, score: total });
      }
    }

    scored.sort(compareScoredEndpoints);

    // Breadth-first top-N so a single resource with many endpoints cannot
    // monopolize the head of the list.
    const diversified = diversifyByResource(scored);

    if (scored.length === 0) {
      const result = {
        search,
        endpoints: [],
        suggestion: `No endpoints found for '${search}'. Try broader terms or run with no arguments to see all available resource categories.`,
      };
      return successResult(result);
    }

    const limit = searchLimit;
    const totalMatches = diversified.length;
    const capped = diversified.slice(0, limit);

    const endpoints = capped.map(({ endpoint }) =>
      projectEndpointForDiscover(endpoint, { includeResource: true })
    );

    const result: Record<string, unknown> = { search, endpoints };
    if (totalMatches > limit) {
      const allMatchedCategories = [...new Set(diversified.map((s) => s.endpoint.resource))];
      const shownCategories = new Set(capped.map((s) => s.endpoint.resource));
      const hiddenCategories = allMatchedCategories.filter((r) => !shownCategories.has(r));
      let note = `Showing top ${limit} of ${totalMatches} matches across categories: ${allMatchedCategories.join(', ')}.`;
      if (hiddenCategories.length > 0) {
        note += ` Categories with results beyond this limit: ${hiddenCategories.join(', ')}. Use resource= for complete results from a specific category.`;
      } else {
        note += ' Use resource= for complete results from a specific category.';
      }
      result.note = note;
    }

    return successResult(result);
  } catch (err: any) {
    log.error({ err }, 'Error in ontap_discover');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error in ontap_discover: ${err?.message ?? 'Unknown error'}`,
        },
      ],
    };
  }
};
