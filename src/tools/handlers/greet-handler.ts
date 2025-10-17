import { ToolHandler } from "../../types/tool.js";


export const greetHandler : ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        const { name } = args;
        const greeting = `Hello, ${args.name}! Welcome to the MCP server.`;
        return {
            content: [{
                type: "text" as const,
                text: greeting
            }],
            structuredContent: {
                greeting
            }
        };
    }