import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const eligibleExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.jsx',
  '.md',
  '.mdx',
  '.mjs',
  '.json',
  '.rules',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const excludedDirectoryNames = new Set([
  '.agents',
  '.git',
  '.local',
  '.next',
  '.turbo',
  'attached_assets',
  'build',
  'coverage',
  'dist',
  'generated',
  'node_modules',
  'target',
  'vendor',
]);

const excludedFileNames = new Set([
  'bun.lockb',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);

const eligibleRootFiles = /^(?:README[^/]*\.md|replit\.md|package\.json|pnpm-workspace\.yaml|tsconfig[^/]*\.json|\.gitignore|artifact\.toml)$/i;

export type CharacterModuleCount = {
  baseline: number;
  current: number;
  net: number;
};

export type MeaningfulCharacterReport = {
  baselineRef: 'HEAD';
  baselineEligibleFiles: number;
  currentEligibleFiles: number;
  newEligibleFiles: number;
  removedEligibleFiles: number;
  baselineCharacters: number;
  currentCharacters: number;
  netMeaningfulCharacterChange: number;
  byModule: Record<string, CharacterModuleCount>;
};

export function isEligibleProjectPath(filePath: string): boolean {
  const normalized = filePath.replaceAll('\\', '/').replace(/^\.\/+/, '');
  const pathParts = normalized.split('/');
  const fileName = pathParts.at(-1) ?? '';
  const extension = fileName.includes('.')
    ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
    : '';

  if (
    pathParts.some(part => excludedDirectoryNames.has(part)) ||
    excludedFileNames.has(fileName.toLowerCase()) ||
    fileName.endsWith('.tsbuildinfo')
  ) {
    return false;
  }

  const inProjectDirectory =
    normalized.startsWith('artifacts/') ||
    normalized.startsWith('lib/') ||
    normalized.startsWith('scripts/');
  if (!inProjectDirectory && !eligibleRootFiles.test(normalized)) return false;
  return eligibleExtensions.has(extension);
}

export function countUtf8DecodedCharacters(text: string): number | null {
  return text.includes('\0') ? null : Array.from(text).length;
}

export function characterModuleForPath(filePath: string): string {
  const parts = filePath.replaceAll('\\', '/').split('/');
  if ((parts[0] === 'artifacts' || parts[0] === 'lib') && parts[1]) {
    return `${parts[0]}/${parts[1]}`;
  }
  if (parts[0] === 'scripts') return 'scripts';
  return 'root';
}

function runGit(root: string, args: string[]): Buffer {
  return execFileSync('git', args, {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function parseNulDelimitedPaths(value: Buffer): string[] {
  return value.toString('utf8').split('\0').filter(Boolean);
}

function addCount(
  counts: Map<string, number>,
  moduleName: string,
  amount: number,
): void {
  counts.set(moduleName, (counts.get(moduleName) ?? 0) + amount);
}

export function measureMeaningfulCharacters(root: string): MeaningfulCharacterReport {
  const baselinePaths = parseNulDelimitedPaths(
    runGit(root, ['ls-tree', '-r', '-z', '--name-only', 'HEAD']),
  ).filter(isEligibleProjectPath);
  const trackedPaths = parseNulDelimitedPaths(
    runGit(root, ['ls-files', '-z', '--cached']),
  );
  const untrackedPaths = parseNulDelimitedPaths(
    runGit(root, ['ls-files', '--others', '--exclude-standard', '-z']),
  );
  const currentPaths = [...new Set([...trackedPaths, ...untrackedPaths])]
    .filter(path => isEligibleProjectPath(path) && existsSync(resolve(root, path)));

  const baselineCounts = new Map<string, number>();
  const currentCounts = new Map<string, number>();
  const validBaselinePaths: string[] = [];
  const validCurrentPaths: string[] = [];

  for (const path of baselinePaths) {
    const content = runGit(root, ['show', `HEAD:${path}`]).toString('utf8');
    const characters = countUtf8DecodedCharacters(content);
    if (characters === null) continue;
    validBaselinePaths.push(path);
    addCount(baselineCounts, characterModuleForPath(path), characters);
  }

  for (const path of currentPaths) {
    if (!lstatSync(resolve(root, path)).isFile()) continue;
    const content = readFileSync(resolve(root, path), 'utf8');
    const characters = countUtf8DecodedCharacters(content);
    if (characters === null) continue;
    validCurrentPaths.push(path);
    addCount(currentCounts, characterModuleForPath(path), characters);
  }

  const baselinePathSet = new Set(validBaselinePaths);
  const currentPathSet = new Set(validCurrentPaths);
  const moduleNames = [...new Set([
    ...baselineCounts.keys(),
    ...currentCounts.keys(),
  ])].sort();
  const byModule = Object.fromEntries(moduleNames.map(moduleName => {
    const baseline = baselineCounts.get(moduleName) ?? 0;
    const current = currentCounts.get(moduleName) ?? 0;
    return [moduleName, { baseline, current, net: current - baseline }];
  }));
  const sum = (counts: Map<string, number>) =>
    [...counts.values()].reduce((total, amount) => total + amount, 0);
  const baselineCharacters = sum(baselineCounts);
  const currentCharacters = sum(currentCounts);

  return {
    baselineRef: 'HEAD',
    baselineEligibleFiles: validBaselinePaths.length,
    currentEligibleFiles: validCurrentPaths.length,
    newEligibleFiles: validCurrentPaths.filter(path => !baselinePathSet.has(path)).length,
    removedEligibleFiles: validBaselinePaths.filter(path => !currentPathSet.has(path)).length,
    baselineCharacters,
    currentCharacters,
    netMeaningfulCharacterChange: currentCharacters - baselineCharacters,
    byModule,
  };
}
