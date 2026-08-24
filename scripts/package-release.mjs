import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const artifact = path.join(root, "artifacts", "project-genesis");
const output = path.join(artifact, "downloads");
const temp = await mkdtemp(path.join(os.tmpdir(), "project-genesis-release-"));
const epoch = new Date("2020-01-01T00:00:00Z");
const generatedPackages = [
  "Project-Genesis-source.zip",
  "Project-Genesis-web.zip",
  "SHA256SUMS",
  "RELEASE-MANIFEST.json",
];

const excludedNames = new Set([
  ".git", ".cache", ".local", "node_modules", "dist", "downloads", "tmp",
  "coverage", "test-results", ".pythonlibs", ".upm", "assets",
  "attached_assets", ".agents",
]);
const excludedFiles = new Set([
  "PROJECT-GENESIS-SOURCE_CODE.zip", "project-genesis-source.zip",
  "Project-Genesis-source.zip", "Project-Genesis-source.tar.gz",
  "Project-Genesis-source.txt",
]);

async function copyTree(source, destination, relative = "") {
  await mkdir(destination);
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name);
    if (excludedNames.has(entry.name) || excludedFiles.has(rel) ||
      excludedFiles.has(entry.name) || entry.name.endsWith(".tsbuildinfo")) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyTree(from, to, rel);
    else if (entry.isFile()) await cp(from, to);
  }
}

async function mkdir(directory) {
  await import("node:fs/promises").then(({ mkdir }) => mkdir(directory, { recursive: true }));
}

async function deterministicZip(sourceDir, archive) {
  const script = String.raw`
import os, sys, zipfile
source, target = sys.argv[1], sys.argv[2]
files = []
for base, dirs, names in os.walk(source):
    dirs.sort()
    for name in sorted(names):
        full = os.path.join(base, name)
        files.append(os.path.relpath(full, source).replace(os.sep, "/"))
with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as out:
    for rel in files:
        info = zipfile.ZipInfo(rel, (2020, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        with open(os.path.join(source, rel), "rb") as item:
            out.writestr(info, item.read())
`;
  execFileSync("python3", ["-c", script, sourceDir, archive], { stdio: "inherit" });
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

try {
  await mkdir(output);
  await Promise.all(generatedPackages.map((name) => rm(path.join(output, name), { force: true })));
  const sourceStage = path.join(temp, "source");
  const webStage = path.join(temp, "web");
  await copyTree(root, sourceStage);
  await cp(path.join(artifact, "dist", "public"), path.join(webStage, "public"), { recursive: true });
  await rm(path.join(webStage, "public", "assets"), { recursive: true, force: true });

  const sourceArchive = path.join(output, "Project-Genesis-source.zip");
  const webArchive = path.join(output, "Project-Genesis-web.zip");
  await deterministicZip(sourceStage, sourceArchive);
  await deterministicZip(webStage, webArchive);

  const files = [sourceArchive, webArchive];
  const checksums = (await Promise.all(files.map(async (file) => `${await sha256(file)}  ${path.basename(file)}`))).join("\n") + "\n";
  await writeFile(path.join(output, "SHA256SUMS"), checksums);
  const manifest = {
    format: 1,
    product: "Project Genesis",
    packages: await Promise.all(files.map(async (file) => ({
      name: path.basename(file),
      bytes: (await stat(file)).size,
      sha256: await sha256(file),
    }))),
    sourceExcludes: [...excludedNames, ...excludedFiles].sort(),
  };
  await writeFile(path.join(output, "RELEASE-MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${files.length} deterministic release packages in ${path.relative(root, output)}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}