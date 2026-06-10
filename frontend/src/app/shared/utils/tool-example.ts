import { Tool } from '../types';

export interface ToolExample {
  request: string;
  response: string;
}

export function buildToolExample(tool: Tool): ToolExample {
  const args: Record<string, unknown> = {};
  tool.params.slice(0, 3).forEach((p) => {
    args[p.name] = p.type.includes('int')
      ? 482
      : p.type.includes('[]')
        ? ['…']
        : p.name === 'repo'
          ? 'acme/app'
          : p.name === 'query' || p.name === 'sql'
            ? 'createSession'
            : p.name === 'channel'
              ? '#general'
              : p.name === 'path'
                ? 'src/index.ts'
                : `<${p.name}>`;
  });

  const canned: Record<string, string> = {
    'create-issue': `{\n  "number": 482,\n  "url": "https://github.com/acme/app/issues/482",\n  "state": "open"\n}`,
    'search-code': `[\n  { "path": "src/auth/session.ts", "line": 44, "match": "createSession" }\n]`,
    'run-query': `[\n  { "id": 1, "email": "ada@acme.com", "plan": "pro" }\n]`,
    'get-file': `"export function createSession(user) {\\n  return signJWT(user, SECRET);\\n}"`,
  };

  const slugKey = tool.slug.replace(/-/g, '_');
  return {
    request: `${tool.name}(${JSON.stringify(args, null, 2)})`,
    response:
      canned[tool.slug] ??
      canned[slugKey] ??
      `{\n  "ok": true,\n  "returns": "${tool.returns}"\n}`,
  };
}
