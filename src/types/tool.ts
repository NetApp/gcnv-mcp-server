import z from 'zod';

/** Suffix appended to GCNV managed tool descriptions to distinguish them from ONTAP expert mode tools. */
export const NOT_FOR_ONTAP =
  ' Not for ONTAP expert mode — use ontap_discover + ontap_execute for ONTAP operations.';

export interface ToolConfig {
  name: string;
  title: string;
  description: string;
  inputSchema: { [key: string]: z.ZodType };
  outputSchema: { [key: string]: z.ZodType };
}

export interface ToolHandlerExtra {
  sessionId?: string;
}

export type ToolHandler = (
  args: { [key: string]: any },
  extra?: ToolHandlerExtra
) => Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent?: any;
  isError?: boolean;
}>;
