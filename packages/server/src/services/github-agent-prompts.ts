/**
 * Template builder for GitHub-related agent prompts.
 * Generates structured prompts for Claude to search GitHub,
 * analyze top repos, clone best match, and adapt to project.
 */

export interface GitHubSearchContext {
  query: string;
  framework?: string;
  targetDir: string;
  projectId: string;
  existingDeps?: string[];
  stylePreferences?: string[];
}

/**
 * Build a prompt for Claude to search GitHub API, analyze top repos,
 * clone the best match, and adapt it to the project.
 */
export function buildGitHubSearchPrompt(ctx: GitHubSearchContext): string {
  const frameworkHint = ctx.framework
    ? `The project uses ${ctx.framework}. Prioritize repos that use the same framework.`
    : '';

  const depsHint = ctx.existingDeps?.length
    ? `Existing project dependencies: ${ctx.existingDeps.join(', ')}. Prefer repos compatible with these.`
    : '';

  const styleHint = ctx.stylePreferences?.length
    ? `Style preferences from the operator: ${ctx.stylePreferences.join('; ')}.`
    : '';

  return `You are a senior developer tasked with finding and adapting a GitHub repository.

## Task
Search GitHub for: "${ctx.query}"

## Steps
1. **Search**: Use the GitHub API (via curl/gh CLI) to search for repositories matching the query. Sort by stars. Look at the top 5-10 results.

2. **Analyze**: For each candidate repo, check:
   - Star count and recent activity (last commit within 6 months)
   - README quality and documentation
   - Code structure and file organization
   - Dependencies and compatibility with the target project
   - License compatibility (prefer MIT, Apache-2.0, BSD)

3. **Select**: Choose the best repo based on:
   - Relevance to the query
   - Code quality and maintainability
   - Compatibility with existing project structure
   - Community adoption (stars, forks)

4. **Clone & Extract**: Clone the selected repo to a temporary location. Extract only the relevant components, pages, or modules needed.

5. **Adapt**: Copy the relevant code to the target directory and modify it to:
   - Match the project's existing code style and patterns
   - Use the project's existing dependencies where possible
   - Remove unnecessary dependencies or features
   - Update imports and file paths
   - Ensure TypeScript compatibility
   - Follow the project's naming conventions

## Target Directory
${ctx.targetDir}

${frameworkHint}
${depsHint}
${styleHint}

## Important Rules
- Do NOT blindly copy entire repos. Extract only what's needed.
- Adapt the code to fit the project, not the other way around.
- Remove any hardcoded API keys, secrets, or environment-specific values.
- Keep the code clean and well-structured.
- If no good match is found, explain why and suggest alternatives.
- After adapting, verify the code compiles without errors.

## Output
After completing the task, provide a summary of:
- Which repo was selected and why
- What files were created/modified
- What dependencies need to be installed (if any)
- Any manual steps the developer needs to take
`.trim();
}

/**
 * Build a prompt for Claude to adapt a specific GitHub repo URL.
 */
export function buildGitHubAdaptPrompt(repoUrl: string, targetDir: string, instructions?: string): string {
  return `You are a senior developer. Clone and adapt the following GitHub repository for this project.

## Repository
${repoUrl}

## Target Directory
${targetDir}

## Instructions
${instructions || 'Adapt the repo to fit this project\'s structure and coding patterns.'}

## Steps
1. Clone the repository to a temporary directory
2. Analyze the repo structure, dependencies, and code patterns
3. Identify the relevant components/modules to extract
4. Copy them to the target directory
5. Adapt imports, styles, and code patterns to match this project
6. Remove unnecessary files and dependencies
7. Verify the adapted code compiles

## Rules
- Maintain the original functionality while adapting the code
- Use the project's existing styling approach (check for Tailwind, CSS modules, etc.)
- Don't introduce conflicting dependencies
- Keep only what's necessary
- Clean up any test files or documentation from the source repo
`.trim();
}
