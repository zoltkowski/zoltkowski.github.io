import { promises as fs } from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const contentDir = path.join(projectRoot, 'public', 'content');
const manifestName = 'index.json';
const outputFile = path.join(contentDir, manifestName);

async function ensureContentDir() {
  try {
    await fs.access(contentDir);
  } catch (err) {
    if (err && /** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') {
      await fs.mkdir(contentDir, { recursive: true });
      console.warn(`[content-index] Created missing directory: ${path.relative(projectRoot, contentDir)}`);
    } else {
      throw err;
    }
  }
}

async function collectJsonFiles() {
  const entries = await fs.readdir(contentDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .filter((entry) => entry.name.toLowerCase() !== manifestName)
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'pl'));
}

async function writeManifest(files) {
  const data = `${JSON.stringify(files, null, 2)}\n`;
  await fs.writeFile(outputFile, data, 'utf8');
  console.log(`[content-index] Wrote ${files.length} file${files.length === 1 ? '' : 's'} to ${path.relative(projectRoot, outputFile)}`);
}

async function main() {
  try {
    await ensureContentDir();
    const files = await collectJsonFiles();
    await writeManifest(files);
  } catch (err) {
    console.error('[content-index] Failed to generate manifest:', err);
    process.exitCode = 1;
  }
}

main();
