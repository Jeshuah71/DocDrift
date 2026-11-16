import type { Finding } from '../types.js';
export type ScriptCommand = {
  manager: string;
  script: string;
  command: string;
};
const builtins = new Set(['install', 'i', 'add', 'remove', 'uninstall', 'update', 'upgrade', 'dlx', 'exec', 'create', 'init', 'publish', 'pack', 'link', 'unlink', 'config', 'cache', 'list', 'why', 'info', 'audit', 'outdated', 'dedupe', 'rebuild', 'import', 'fetch', 'store', 'setup', 'env', 'help', 'version', 'set', 'workspace', 'workspaces', 'global', 'node', 'dlx', 'patch', 'patch-commit', 'deploy', 'approve-builds', 'self-update']);
export function detectScriptCommands(readme: string): ScriptCommand[] {
  const commands = new Map<string, ScriptCommand>();
  for (const match of readme.matchAll(/\b(npm|yarn|pnpm)\s+(?:(run(?:-script)?)\s+)?([\w][\w:.-]*)/g)) {
    const [, manager, explicit, script] = match;
    const tail = readme.slice(match.index + match[0].length).split(/[\n`]/)[0];
    // A prior cd in the current shell block makes root-package comparison unsafe.
    const prefix = readme.slice(0, match.index);
    const linePrefix = prefix.slice(prefix.lastIndexOf('\n') + 1);
    const inFence = (prefix.match(/```/g)?.length ?? 0) % 2 === 1;
    const inlineCode = (linePrefix.match(/`/g)?.length ?? 0) % 2 === 1;
    if (!explicit && !inFence && !inlineCode && !/^\s*(?:[$>]\s*)?$/.test(linePrefix)) continue;
    const block = prefix.slice(prefix.lastIndexOf('```') + 3);
    if (/(?:^|[\n;&])\s*cd\s+(?!\.\s*(?:$|[;&\n]))[^\n;&]+/.test(block))
      continue;
    if (/(?:^|\s)(?:--prefix|--cwd|--dir|-C|--workspace|-w|--if-present)(?:\s|=|$)/.test(tail))
      continue;
    if (!explicit && (manager === 'npm' ? !['start', 'test', 'stop', 'restart'].includes(script) : builtins.has(script)))
      continue;
    const command = `${manager} ${explicit ? `${explicit} ` : ''}${script}`;
    commands.set(`${manager}:${script}`, { manager, script, command });
  }
  return [...commands.values()];
}
export function missingScriptFindings(readme: string, scripts: Record<string, string>, url: string): Finding[] {
  return detectScriptCommands(readme).filter(({ script, manager }) => !Object.hasOwn(scripts, script) && !(manager === 'npm' && ['start', 'stop', 'restart'].includes(script))).map(({ command, script }) => ({
    id: `script:${command}`, severity: 'mismatch', problem: `README references ${command}.`,
    cause: `The root package.json does not define a ${script} script.`,
    recommendation: `Review the command and use an intended script${Object.keys(scripts).length ? ` from: ${Object.keys(scripts).join(', ')}` : ', or define the documented script'}.`, url,
  }));
}
export function sectionFindings(readme: string, url: string, archived = false): Finding[] {
  const prose = readme.replace(/```[\s\S]*?```/g, '').split('\n').filter(line => line.trim() && !/^\s*(#|!|\[|<|\||[-*])/g.test(line)).join(' ').trim();
  const rules: [
    string,
    boolean,
    string,
    string
  ][] = [
      ['description', prose.length >= 60, 'A clear project description was not detected.', 'Add a sentence explaining what the project does and who it helps.'],
      ['installation', /(?:install|getting started|setup|quick\s?start)/i.test(readme), 'Installation guidance was not detected.', 'If setup is needed, document prerequisites and installation steps.'],
      ['usage', /(?:usage|examples?|how to use|quick\s?start)/i.test(readme), 'Usage examples were not detected.', 'Consider adding a minimal command or code example and its expected result.'],
      ['requirements', /(?:requirements?|prerequisites?|technolog|built with|node\s*(?:\.js|>=|version)|python\s*\d)/i.test(readme), 'Technology or requirements information was not detected.', 'Mention relevant tools, supported versions, or requirements when applicable.'],
      ['contributing', archived || /(?:contribut|pull request)/i.test(readme), 'Contribution guidance was not detected.', 'If contributions are welcome, link CONTRIBUTING.md or explain how to propose changes.'],
      ['resources', /\[[^\]]*(?:demo|docs?|documentation|screenshot)[^\]]*\]\(|!\[/i.test(readme), 'Optional demo, documentation, or screenshot links were not detected.', 'Consider adding a demo, documentation link, or screenshot if useful for this project.'],
    ];
  return rules.filter(([, present]) => !present).map(([id, , problem, recommendation]) => ({ id, severity: id === 'description' ? 'warning' : 'info', problem, cause: 'A text-based heuristic did not find this information; sections may use different wording or may not apply.', recommendation, url }));
}
export function localReferences(readme: string, readmePath: string): string[] {
  const refs = [...readme.matchAll(/!?\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+[^)]*)?\)/g)]
    .map(match => ({ value: match[1], base: readmePath.split('/').slice(0, -1) }));
  // Installation commands conventionally run from the checkout root, unlike Markdown links.
  for (const match of readme.matchAll(/\b(?:python\s+-m\s+)?pip(?:3)?\s+install\s+[^\n`]*?(?:-r\s+([^\s`]+)|(-e\s+)?(\.{1,2}(?:\/[^\s`]+)?))/g)) {
    refs.push({ value: (match[1] ?? match[3]).replace(/^['"]|['"]$/g, ''), base: [] });
  }
  for (const match of readme.replace(/!?\[[^\]]*\]\([^)]*\)/g, '').matchAll(/`(requirements(?:[-\w]*)\.txt|pyproject\.toml|setup\.py)`/g)) {
    refs.push({ value: match[1], base: [] });
  }
  const paths = new Set<string>();
  for (const reference of refs) {
    let ref = reference.value;
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(ref))
      continue;
    try {
      ref = decodeURIComponent(ref.split(/[?#]/)[0]);
    }
    catch {
      continue;
    }
    const segments = ref.startsWith('/') ? [] : [...reference.base];
    let valid = true;
    for (const part of ref.split('/')) {
      if (!part || part === '.')
        continue;
      if (part === '..') {
        if (!segments.length) {
          valid = false;
          break;
        }
        segments.pop();
      }
      else
        segments.push(part);
    }
    if (valid && segments.length && !/[<>*{}$\\]/.test(ref))
      paths.add(segments.join('/'));
  }
  return [...paths];
}
export function fileFinding(path: string, exists: boolean | null, url: string): Finding | null {
  if (exists === true)
    return null;
  return { id: `file:${path}`, severity: exists === false ? 'mismatch' : 'info', problem: exists === false ? `Referenced local path ${path} was not found.` : `Local path ${path} was not verified.`, cause: exists === false ? 'GitHub returned 404 for this path on the default branch.' : 'The file check failed or exceeded the request budget.', recommendation: exists === false ? 'Check spelling, case, and the path relative to the README, or add the intended file.' : 'Verify this path manually or retry later.', url };
}
