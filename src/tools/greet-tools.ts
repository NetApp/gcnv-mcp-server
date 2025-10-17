import { z } from 'zod';
import { ToolConfig } from "../types/tool.js";

export const greetUserTool : ToolConfig = {
    name: "gcnv_user_greet",
    title: "Greet User",
    description: "Greet User",
    inputSchema: {
        name: z.string().describe("The name of the user to greet")
    },
    outputSchema: {
        greeting: z.string().describe("The greeting to the user")
    }
};
