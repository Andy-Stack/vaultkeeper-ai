// platform agnostic function definition used to present function calls in an API call
export interface IAIFunctionDefinition {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  }