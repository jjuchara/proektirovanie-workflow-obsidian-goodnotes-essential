#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const MARKETPLACE_ROOT = path.join(REPO_ROOT, '.projectAgents');
const MARKETPLACE_NAME = "obsidian-goodnotes-essential-workflow";
const PLUGIN_ID = "obsidian-goodnotes-essential-workflow-codex-plugin@obsidian-goodnotes-essential-workflow";
const checkOnly = process.argv.includes('--check');

const run = (args) => {
  const result = spawnSync('codex', args, { encoding: 'utf8', stdio: args.includes('--json') ? 'pipe' : 'inherit' });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || 'Codex command failed');
  return result.stdout?.trim() || '';
};

const normalize = (value) => path.normalize(existsSync(value) ? realpathSync.native(value) : path.resolve(value));
const marketplaces = JSON.parse(run(['plugin', 'marketplace', 'list', '--json']));
const existing = (marketplaces.marketplaces || []).find((entry) => entry.name === MARKETPLACE_NAME);
const existingRoot = existing?.root ?? existing?.path ?? existing?.marketplaceSource?.source;
if (existing && normalize(existingRoot) !== normalize(MARKETPLACE_ROOT)) {
  throw new Error(`Marketplace '${MARKETPLACE_NAME}' points to a different path: ${existingRoot}`);
}
if (!existing && !checkOnly) run(['plugin', 'marketplace', 'add', MARKETPLACE_ROOT]);
if (!checkOnly) {
  run(['plugin', 'add', PLUGIN_ID]);
  const plugins = JSON.parse(run(['plugin', 'list', '--json']));
  const installed = (plugins.installed || []).some((entry) => {
    const id = typeof entry === 'string' ? entry : entry.pluginId ?? entry.id ?? entry.plugin;
    return id === PLUGIN_ID && entry.enabled !== false && entry.status !== 'disabled';
  });
  if (!installed) throw new Error(`Codex did not confirm that ${PLUGIN_ID} is installed and enabled.`);
}
console.log(checkOnly ? `Ready to install ${PLUGIN_ID}` : `Installed ${PLUGIN_ID}; open a new chat and trust project hooks.`);
