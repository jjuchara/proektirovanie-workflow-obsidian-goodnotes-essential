import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
  { ignores: ["main.js", "node_modules/", "coverage/", ".projectAgents/", ".codex/"] },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs", "esbuild.config.mjs", "scripts/*.mjs"]
        }
      }
    }
  },
  {
    files: ["src/settings.ts"],
    rules: {
      // Declarative setting definitions require Obsidian 1.13; the plugin supports 1.8.7.
      "obsidianmd/settings-tab/prefer-setting-definitions": "off"
    }
  },
  {
    files: ["esbuild.config.mjs", "scripts/*.mjs"],
    languageOptions: { globals: globals.node },
    rules: { "obsidianmd/no-nodejs-modules": "off" }
  }
]);
