import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

export const ontapAuditLogTool: ToolConfig = {
  name: 'ontap_audit_log',
  title: 'ONTAP Operation Audit Log',
  description:
    'Controls ONTAP operation audit logging for the current session. ' +
    'When enabled, all ONTAP tool calls (inputs, outcomes, timestamps) are recorded ' +
    'to a local markdown file for troubleshooting. ' +
    'Set action to enable to start, disable to stop and write a summary, or status to check.',
  inputSchema: {
    action: z
      .enum(['enable', 'disable', 'status'])
      .describe('enable = start logging, disable = stop and write summary, status = check state'),
    outputDir: z
      .string()
      .optional()
      .describe(
        'Directory to write the log file. Defaults to logs/ inside the project directory. ' +
          'Only used with action="enable". Omit to use the default.'
      ),
    userIntent: z
      .string()
      .optional()
      .describe('Ignored. Accepted silently so callers do not need to strip it.'),
  },
  outputSchema: {
    result: z.any().describe('Audit log status with enabled flag and log file path'),
  },
};
