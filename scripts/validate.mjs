import { readFile, stat } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const versions = JSON.parse(await readFile("versions.json", "utf8"));

const failures = [];
if (manifest.version !== packageJson.version) failures.push("manifest and package versions differ");
if (versions[manifest.version] !== manifest.minAppVersion) failures.push("versions.json does not match manifest");
if (!/^[a-z0-9-]+$/.test(manifest.id)) failures.push("manifest id is invalid");
if (manifest.isDesktopOnly !== false) failures.push("plugin must remain mobile-compatible");

for (const releaseFile of ["main.js", "manifest.json", "styles.css"]) {
  try {
    const details = await stat(releaseFile);
    if (!details.isFile() || details.size === 0) failures.push(`${releaseFile} is empty`);
  } catch {
    failures.push(`${releaseFile} is missing`);
  }
}

const sourceFiles = [
  "src/main.ts",
  "src/settings.ts",
  "src/transaction.ts",
  "src/types.ts",
  "src/ui/modals.ts",
  "src/core/edit.ts",
  "src/core/paths.ts",
  "src/core/shortcut.ts",
  "src/core/sidecar.ts",
  "src/core/text.ts"
];
const forbidden = /(?:from|require\()\s*["'](?:node:)?(?:fs|path|electron|child_process|os)["']/;
for (const sourceFile of sourceFiles) {
  const source = await readFile(sourceFile, "utf8");
  if (forbidden.test(source)) failures.push(`${sourceFile} imports a desktop-only API`);
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Plugin metadata, release assets, and mobile API boundary are valid.\n");
}
