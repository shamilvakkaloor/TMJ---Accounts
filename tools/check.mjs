import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
const walk = (dir) =>
  readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
const files = [
  "app.js",
  "config.js",
  ...["lib", "domain", "pages", "tools", "tests", "vendor"].flatMap(walk),
].filter((p) => /\.m?js$/.test(p));
for (const file of files) {
  const source = readFileSync(resolve(root, file), "utf8");
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--check"],
    {
      input: source,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) throw new Error(`${file}: ${result.stderr}`);
  for (const match of source.matchAll(
    /(?:from\s+|import\s*\()['"](\.[^'"]+)['"]/g,
  ))
    if (!existsSync(resolve(dirname(resolve(root, file)), match[1])))
      throw new Error(`Missing import in ${file}: ${match[1]}`);
}
console.log(
  `${files.length} JavaScript files passed syntax and local-import checks.`,
);
const tests = files.filter((p) => p.endsWith(".test.js"));
const result = spawnSync(process.execPath, ["--test", ...tests], {
  cwd: root,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
