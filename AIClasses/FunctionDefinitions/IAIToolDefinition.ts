import type { AITool } from "Enums/AITool";
import type { JSONSchemaProperty } from "../Schemas/AIToolTypes";

// platform agnostic function definition used to present function calls in an API call
export interface IAIToolDefinition {
    name: AITool;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, JSONSchemaProperty>;
      required?: string[];
    };
  }