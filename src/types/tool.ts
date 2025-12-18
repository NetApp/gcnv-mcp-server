import z from 'zod';

export interface ToolConfig {
  name: string;
  title: string;
  description: string;
  inputSchema: { [key: string]: z.ZodType };
  outputSchema: { [key: string]: z.ZodType };
}

export type ToolHandler = (args: { [key: string]: any }) => Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent?: any;
}>;
