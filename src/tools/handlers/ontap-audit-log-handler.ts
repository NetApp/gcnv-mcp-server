import { ToolHandler } from '../../types/tool.js';
import {
  enableAuditLog,
  disableAuditLog,
  isAuditEnabled,
  getAuditLogPath,
  getAllAuditLogPaths,
} from '../../utils/ontap-audit-logger.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'ontap-audit-log-handler' });

function toolError(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

export const ontapAuditLogHandler: ToolHandler = (args, extra) => {
  const { action, outputDir } = args;
  const sessionId = extra?.sessionId;

  switch (action) {
    case 'enable': {
      if (isAuditEnabled(sessionId)) {
        const result = {
          enabled: true,
          logFilePath: getAuditLogPath(sessionId),
          message: 'Audit logging is already enabled for this session.',
        };
        return Promise.resolve({
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: { result },
        });
      }

      let logFilePath: string;
      try {
        logFilePath = enableAuditLog(outputDir as string | undefined, sessionId);
      } catch (err: any) {
        log.error({ err, outputDir }, 'Failed to enable audit logging');
        return Promise.resolve(
          toolError(
            `Failed to enable audit logging: ${err?.message ?? 'unknown error'}. ` +
              'Check that outputDir exists and is writable, then retry. retryable: false'
          )
        );
      }
      const result = {
        enabled: true,
        logFilePath,
        message: `Audit logging enabled. All ONTAP operations will be recorded to: ${logFilePath}`,
      };
      return Promise.resolve({
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      });
    }

    case 'disable': {
      let allPaths: string[];
      let logFilePath: string | null;
      try {
        allPaths = getAllAuditLogPaths(sessionId);
        logFilePath = disableAuditLog(sessionId);
      } catch (err: any) {
        log.error({ err }, 'Failed to disable audit logging');
        return Promise.resolve(
          toolError(
            `Failed to disable audit logging: ${err?.message ?? 'unknown error'}. ` +
              'The session summary may not have been written. retryable: false'
          )
        );
      }
      if (!logFilePath) {
        const result = {
          enabled: false,
          logFilePath: null,
          message: 'Audit logging was not active.',
        };
        return Promise.resolve({
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: { result },
        });
      }

      const result = {
        enabled: false,
        logFilePath,
        logFiles: allPaths,
        message:
          allPaths.length > 1
            ? `Audit logging disabled. Session summary written to: ${logFilePath}. Log spans ${allPaths.length} files.`
            : `Audit logging disabled. Session summary written to: ${logFilePath}`,
      };
      return Promise.resolve({
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      });
    }

    case 'status': {
      const result = {
        enabled: isAuditEnabled(sessionId),
        logFilePath: getAuditLogPath(sessionId),
        message: isAuditEnabled(sessionId)
          ? `Audit logging is active. Log file: ${getAuditLogPath(sessionId)}`
          : 'Audit logging is not active.',
      };
      return Promise.resolve({
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      });
    }

    default: {
      return Promise.resolve({
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Invalid action: "${String(action)}". Use "enable", "disable", or "status".`,
          },
        ],
      });
    }
  }
};
