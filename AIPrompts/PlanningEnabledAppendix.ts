// Appended to the system prompt when planning mode is enabled
export const PlanningEnabledAppendix = `
<planning_mode>
Planning mode is ENABLED. You MUST request a plan before executing any other tools.

Do not execute actions directly—first create a strategic plan that will be reviewed and approved. Once you receive an approved plan, execute it step by step.
</planning_mode>
`;