import { appendFileSync, writeFileSync, mkdirSync, statSync, chmodSync } from 'fs';
import { resolve } from 'path';
import { ToolHandler, ToolHandlerExtra } from '../types/tool.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'ontap-audit-logger' });

const MAX_RESPONSE_LENGTH = 20000;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per file
/** File mode for newly created log files: owner read/write only. */
const LOG_FILE_MODE = 0o600;
const DEFAULT_SESSION_ID = 'default';

interface AuditEntry {
  operationNumber: number;
  toolName: string;
  timestamp: string;
  durationMs: number;
  outcome: 'SUCCESS' | 'ERROR';
  userIntent: string | null;
  args: Record<string, unknown>;
  summary: string;
  responseText: string;
}

interface AuditState {
  enabled: boolean;
  logFilePath: string | null;
  logFileBaseName: string | null;
  logFileDir: string | null;
  logFileSeq: number;
  allLogFiles: string[];
  operationCount: number;
  queryCount: number;
  successCount: number;
  errorCount: number;
  sessionStartTime: string | null;
  entries: AuditEntry[];
  lastUserIntent: string | null;
}

function createAuditState(): AuditState {
  return {
    enabled: false,
    logFilePath: null,
    logFileBaseName: null,
    logFileDir: null,
    logFileSeq: 0,
    allLogFiles: [],
    operationCount: 0,
    queryCount: 0,
    successCount: 0,
    errorCount: 0,
    sessionStartTime: null,
    entries: [],
    lastUserIntent: null,
  };
}

const auditStates = new Map<string, AuditState>();
let logFileSerial = 0;

function normalizeSessionId(sessionId?: string): string {
  return sessionId || DEFAULT_SESSION_ID;
}

function getAuditState(sessionId?: string): AuditState {
  const key = normalizeSessionId(sessionId);
  let state = auditStates.get(key);
  if (!state) {
    state = createAuditState();
    auditStates.set(key, state);
  }
  return state;
}

let exitHookRegistered = false;

/** Top-level arg keys dropped entirely from the logged parameter table. */
const SANITIZED_KEYS = new Set(['projectId']);

/**
 * Keys (case-insensitive, matched anywhere in the key name) whose values are
 * masked before being written to disk. Applied recursively to nested objects
 * and to JSON-string payloads in `body` / `queryParams`.
 *
 * Examples of fields this catches in ONTAP request bodies:
 *   cifs_service.ad_domain.password, ldap.bind_password, kms.api_key,
 *   credential, service_account_key, passphrase, private_key.
 */
const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|api[_-]?key|private[_-]?key|credential|passphrase|bind_password|authorization|auth(?:_?key)?|access[_-]?token|refresh[_-]?token|session[_-]?id|client[_-]?secret|oauth|certificate|cert(?:ificate)?|ssh[_-]?key|encryption[_-]?key|kms[_-]?key/i;
const REDACTED = '[REDACTED]';

function toStr(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value.toString();
  return JSON.stringify(value);
}

function escapeMarkdownTableCell(value: unknown): string {
  return toStr(value)
    .replace(/\|/g, '\\|')
    .replace(/\r\n|\r|\n/g, '<br>');
}

/**
 * Recursively walk a value and replace any property whose key matches
 * SENSITIVE_KEY_PATTERN with REDACTED. Returns a new structure; the input
 * is not mutated. Non-objects pass through unchanged.
 */
function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out;
  }
  return value;
}

/**
 * If `value` is a JSON-encoded string carrying an object, parse → redact →
 * re-serialize. If it isn't valid JSON or doesn't parse to an object, fall
 * back to the original string (still capped). This handles `body` /
 * `queryParams` on `ontap_execute`, which are JSON strings, not objects.
 */
function redactJsonStringIfApplicable(value: string): string {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return JSON.stringify(redactSecrets(parsed));
    }
  } catch {
    // Not JSON — leave as-is; caller will still apply length cap.
  }
  return value;
}

function removeKeys(value: unknown, keysToRemove: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => removeKeys(item, keysToRemove));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (keysToRemove.has(k)) continue;
      out[k] = removeKeys(v, keysToRemove);
    }
    return out;
  }
  return value;
}

function compactResponseForAudit(toolName: string, value: unknown): unknown {
  if (toolName !== 'ontap_discover') return value;
  // Discover responses can contain repeated keyword arrays on every endpoint.
  // They are useful to the model at runtime but noisy in the audit artifact.
  return removeKeys(value, new Set(['keywords']));
}

function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (SANITIZED_KEYS.has(key)) continue;

    // Top-level key matches the secret pattern → mask the value outright.
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = REDACTED;
      continue;
    }

    let redacted: unknown;
    if (typeof value === 'string') {
      // body / queryParams arrive as JSON strings on ontap_execute.
      redacted = redactJsonStringIfApplicable(value);
      if (typeof redacted === 'string' && redacted.length > 200) {
        redacted = redacted.slice(0, 200) + '...';
      }
    } else {
      redacted = redactSecrets(value);
    }
    sanitized[key] = redacted;
  }
  return sanitized;
}

function tryParseJsonObject(text: string): unknown {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function findBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractNestedJson(text: string): unknown {
  const jsonObject = findBalancedJsonObject(text);
  return jsonObject ? tryParseJsonObject(jsonObject) : null;
}

function extractMessageFromParsedError(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, any>;

  if (obj.error === 'scope_denied') {
    return `scope_denied (${obj.source ?? 'unknown'}): ${obj.reason ?? ''}`.trim();
  }

  const direct =
    obj.error?.message ??
    obj.rawResponse?.error?.message ??
    obj.result?.error?.message ??
    obj.message ??
    null;
  if (typeof direct === 'string' && direct.trim()) {
    const nested = extractNestedJson(direct);
    const nestedMsg = extractMessageFromParsedError(nested);
    return nestedMsg ?? direct.trim();
  }

  return null;
}

/** Try to extract a clean one-line error message from an ONTAP/proxy error payload. */
function extractErrorSummary(text: string): string {
  const parsed = tryParseJsonObject(text) ?? extractNestedJson(text);
  const parsedMsg = extractMessageFromParsedError(parsed);
  if (parsedMsg) return parsedMsg.split('\n')[0].slice(0, 200);

  const nested = extractNestedJson(text);
  const nestedMsg = extractMessageFromParsedError(nested);
  if (nestedMsg) return nestedMsg.split('\n')[0].slice(0, 200);

  return (text.split('\n')[0] ?? '').slice(0, 200) || 'See full response below';
}

function summarizeResult(result: {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}): { outcome: 'SUCCESS' | 'ERROR'; summary: string } {
  if (result.isError) {
    const text = result.content?.[0]?.text ?? 'Unknown error';
    return { outcome: 'ERROR', summary: extractErrorSummary(text) };
  }

  const text = result.content?.[0]?.text ?? '';

  try {
    const parsed = JSON.parse(text);
    if (parsed?.result?.asyncJobDetected) {
      const jobUuid =
        parsed.result?.result?.job?.uuid ??
        parsed.result?.pollingGuidance?.match(/UUID: ([^\s.]+)/)?.[1] ??
        'unknown';
      return { outcome: 'SUCCESS', summary: `Async job started: ${jobUuid}` };
    }
    if (parsed?.result?.records) {
      return {
        outcome: 'SUCCESS',
        summary: `Returned ${parsed.result.records.length} record(s)`,
      };
    }
    if (parsed?.result?.svmName) {
      return {
        outcome: 'SUCCESS',
        summary: `SVM: ${parsed.result.svmName}, Aggregate: ${parsed.result.aggregateName}`,
      };
    }
    if (parsed?.result?.state) {
      return {
        outcome: 'SUCCESS',
        summary: `Job state: ${parsed.result.state} — ${parsed.result.message ?? ''}`,
      };
    }
    // ontap_discover responses — keep the visible line short; full payload lives in <details>.
    if (Array.isArray(parsed?.categories)) {
      return {
        outcome: 'SUCCESS',
        summary: `Discovered ${parsed.categories.length} resource categories`,
      };
    }
    if (Array.isArray(parsed?.endpoints)) {
      if (typeof parsed?.resource === 'string') {
        return {
          outcome: 'SUCCESS',
          summary: `Discovered ${parsed.endpoints.length} endpoint(s) in category "${parsed.resource}"`,
        };
      }
      if (typeof parsed?.search === 'string') {
        return {
          outcome: 'SUCCESS',
          summary: `Search "${parsed.search}" returned ${parsed.endpoints.length} endpoint(s)`,
        };
      }
      return { outcome: 'SUCCESS', summary: `Discovered ${parsed.endpoints.length} endpoint(s)` };
    }
  } catch {
    // Not JSON, fall through
  }

  // Fallback: do NOT leak raw payload to the visible line; full response is already
  // captured in the collapsible <details> block below.
  return { outcome: 'SUCCESS', summary: 'See full response below' };
}

function writeHeader(state: AuditState): void {
  if (!state.logFilePath) return;
  const partLabel = state.logFileSeq > 0 ? ` (part ${state.logFileSeq + 1})` : '';
  const header =
    `# ONTAP Operation Audit Log${partLabel}\n\n` +
    `**Session started**: ${state.sessionStartTime}\n` +
    `**Log file**: ${state.logFilePath}\n\n` +
    `> Sensitive fields (passwords, tokens, API keys, credentials) are masked in both request parameters and response payloads.\n\n` +
    `---\n\n`;
  writeFileSync(state.logFilePath, header, { encoding: 'utf-8', mode: LOG_FILE_MODE });
  // Restrict to owner-only. Best-effort: chmod may be a no-op on Windows.
  try {
    chmodSync(state.logFilePath, LOG_FILE_MODE);
  } catch (err) {
    log.warn(
      { err, logFilePath: state.logFilePath },
      'Could not set restrictive permissions on audit log file'
    );
  }
}

function rotateIfNeeded(state: AuditState): void {
  if (!state.logFilePath || !state.logFileBaseName || !state.logFileDir) return;
  try {
    const size = statSync(state.logFilePath).size;
    if (size < MAX_FILE_SIZE_BYTES) return;
  } catch {
    return;
  }

  appendFileSync(
    state.logFilePath,
    `\n*Continued in next file (part ${state.logFileSeq + 2})...*\n`,
    'utf-8'
  );

  state.logFileSeq++;
  state.logFilePath = resolve(state.logFileDir, `${state.logFileBaseName}-${state.logFileSeq}.md`);
  state.allLogFiles.push(state.logFilePath);
  writeHeader(state);
  log.info(
    { logFilePath: state.logFilePath, part: state.logFileSeq + 1 },
    'Audit log rotated to new file'
  );
}

function appendEntry(state: AuditState, entry: AuditEntry): void {
  if (!state.logFilePath) return;
  rotateIfNeeded(state);

  const lines: string[] = [];

  const intentChanged = entry.userIntent && entry.userIntent !== state.lastUserIntent;
  if (intentChanged) {
    state.queryCount++;
    state.lastUserIntent = entry.userIntent;
    lines.push(`## Query ${state.queryCount}: ${entry.userIntent}\n`);
  } else if (!state.lastUserIntent && !entry.userIntent && state.queryCount === 0) {
    state.queryCount++;
    state.lastUserIntent = null;
    lines.push(`## Query ${state.queryCount}\n`);
  }

  const outcomeTag = entry.outcome === 'ERROR' ? '**ERROR**' : 'SUCCESS';

  let toolLabel = entry.toolName;
  if (entry.args.method && entry.args.ontapApiPath) {
    toolLabel += ` ${toStr(entry.args.method)} ${toStr(entry.args.ontapApiPath)}`;
  }

  lines.push(`### ${entry.operationNumber}. ${toolLabel} — ${entry.timestamp} — ${outcomeTag}\n`);

  lines.push(`**Duration**: ${(entry.durationMs / 1000).toFixed(2)}s\n`);

  const sanitized = sanitizeArgs(entry.args);
  const paramKeys = Object.keys(sanitized);
  if (paramKeys.length > 0) {
    lines.push('| Parameter | Value |');
    lines.push('| --- | --- |');
    for (const key of paramKeys) {
      const val = escapeMarkdownTableCell(sanitized[key]);
      lines.push(`| ${escapeMarkdownTableCell(key)} | ${val} |`);
    }
    lines.push('');
  }

  if (entry.outcome === 'ERROR') {
    lines.push(`**Error**: ${entry.summary}\n`);
  } else {
    lines.push(`**Result**: ${entry.summary}\n`);
  }

  if (entry.responseText) {
    lines.push('<details>');
    lines.push('<summary>Full response</summary>\n');
    lines.push('```json');
    lines.push(entry.responseText);
    lines.push('```');
    lines.push('</details>\n');
  }

  lines.push('---\n\n');

  appendFileSync(state.logFilePath, lines.join('\n'), 'utf-8');
}

function writeSessionSummary(state: AuditState): void {
  if (!state.logFilePath || !state.enabled) return;

  const endTime = new Date().toISOString();
  const failedOps = state.entries.filter((e) => e.outcome === 'ERROR');
  const pools = new Set<string>();
  for (const e of state.entries) {
    const pool = e.args.storagePoolId;
    const loc = e.args.locationId;
    if (pool && loc) pools.add(`${toStr(loc)}/${toStr(pool)}`);
  }

  const lines: string[] = [
    `## Session Summary\n`,
    `**Session ended**: ${endTime}`,
    `**User queries**: ${state.queryCount}`,
    `**Total operations**: ${state.operationCount}`,
    `**Successful**: ${state.successCount}`,
    `**Failed**: ${state.errorCount}`,
  ];

  if (pools.size > 0) {
    lines.push(`**Pools used**: ${[...pools].join(', ')}`);
  }

  if (state.allLogFiles.length > 1) {
    lines.push(`**Log files** (${state.allLogFiles.length} parts):`);
    for (const f of state.allLogFiles) {
      lines.push(`- ${f}`);
    }
  }

  lines.push('');

  if (failedOps.length > 0) {
    lines.push('### Failed Operations\n');
    lines.push('| # | Tool | Time | Error |');
    lines.push('| --- | --- | --- | --- |');
    for (const op of failedOps) {
      const shortErr = op.summary.length > 100 ? op.summary.slice(0, 100) + '...' : op.summary;
      lines.push(
        `| ${op.operationNumber} | ${escapeMarkdownTableCell(op.toolName)} | ${escapeMarkdownTableCell(op.timestamp)} | ${escapeMarkdownTableCell(shortErr)} |`
      );
    }
    lines.push('');
  }

  appendFileSync(state.logFilePath, lines.join('\n'), 'utf-8');
  log.info({ logFilePath: state.logFilePath }, 'Session summary written to audit log');
}

function registerExitHook(): void {
  if (exitHookRegistered) return;
  exitHookRegistered = true;

  const finalize = () => {
    for (const state of auditStates.values()) {
      if (state.enabled && state.logFilePath) {
        writeSessionSummary(state);
        state.enabled = false;
      }
    }
  };

  process.on('beforeExit', finalize);
  process.on('exit', finalize);
}

export function enableAuditLog(outputDir?: string, sessionId?: string): string {
  const state = getAuditState(sessionId);
  const dir = outputDir || resolve(process.cwd(), 'logs');
  mkdirSync(dir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  logFileSerial++;
  state.logFileBaseName = `ontap-audit-${ts}-${logFileSerial}`;
  state.logFileDir = dir;
  state.logFileSeq = 0;
  state.logFilePath = resolve(dir, `${state.logFileBaseName}.md`);
  state.allLogFiles = [state.logFilePath];
  state.sessionStartTime = new Date().toISOString();
  state.operationCount = 0;
  state.queryCount = 0;
  state.successCount = 0;
  state.errorCount = 0;
  state.entries = [];
  state.lastUserIntent = null;
  state.enabled = true;

  writeHeader(state);
  registerExitHook();
  log.info(
    { logFilePath: state.logFilePath, sessionId: normalizeSessionId(sessionId) },
    'ONTAP audit logging enabled'
  );
  return state.logFilePath;
}

export function disableAuditLog(sessionId?: string): string | null {
  const state = getAuditState(sessionId);
  if (!state.enabled || !state.logFilePath) return null;
  writeSessionSummary(state);
  const path = state.logFilePath;
  state.enabled = false;
  log.info({ logFilePath: path }, 'ONTAP audit logging disabled');
  return path;
}

export function logOperation(
  toolName: string,
  args: Record<string, unknown>,
  result: {
    content: { type: string; text: string }[];
    structuredContent?: unknown;
    isError?: boolean;
  },
  durationMs: number,
  sessionId?: string
): void {
  const state = getAuditState(sessionId);
  if (!state.enabled) return;

  state.operationCount++;
  const { outcome, summary } = summarizeResult(result);
  if (outcome === 'ERROR') state.errorCount++;
  else if (outcome === 'SUCCESS') state.successCount++;

  let responseText = result.content?.[0]?.text ?? '';
  try {
    const parsed = JSON.parse(responseText);
    // Redact secrets in the response payload too -- some ONTAP responses
    // echo back the request body (which may contain credentials).
    responseText = JSON.stringify(
      redactSecrets(compactResponseForAudit(toolName, parsed)),
      null,
      2
    );
  } catch {
    // Keep as-is if not valid JSON
  }
  if (responseText.length > MAX_RESPONSE_LENGTH) {
    responseText =
      responseText.slice(0, MAX_RESPONSE_LENGTH) +
      `\n... (truncated, ${responseText.length} chars total)`;
  }

  const userIntent = typeof args.userIntent === 'string' ? args.userIntent : null;

  const entry: AuditEntry = {
    operationNumber: state.operationCount,
    toolName,
    timestamp: new Date().toISOString(),
    durationMs,
    outcome,
    userIntent,
    args,
    summary,
    responseText,
  };

  state.entries.push(entry);
  appendEntry(state, entry);
}

export function isAuditEnabled(sessionId?: string): boolean {
  return getAuditState(sessionId).enabled;
}

export function getAuditLogPath(sessionId?: string): string | null {
  return getAuditState(sessionId).logFilePath;
}

export function getAllAuditLogPaths(sessionId?: string): string[] {
  return [...getAuditState(sessionId).allLogFiles];
}

/**
 * Wraps an ONTAP tool handler with audit logging.
 * When logging is disabled, calls the handler directly with zero overhead.
 */
export function withAuditLog(handler: ToolHandler, toolName: string): ToolHandler {
  return async (args, extra?: ToolHandlerExtra) => {
    const sessionId = extra?.sessionId;
    if (!isAuditEnabled(sessionId)) return extra ? handler(args, extra) : handler(args);

    const startMs = Date.now();
    const result = extra ? await handler(args, extra) : await handler(args);
    const durationMs = Date.now() - startMs;

    try {
      logOperation(toolName, args, result, durationMs, sessionId);
    } catch (auditErr) {
      log.warn({ err: auditErr, toolName }, 'ONTAP audit log write failed; tool result preserved');
    }
    return result;
  };
}

/** Resets all state -- exported for testing only. */
export function _resetAuditState(): void {
  auditStates.clear();
  logFileSerial = 0;
}
