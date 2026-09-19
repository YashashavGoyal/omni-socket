import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const newVersion = process.argv[2];

if (!newVersion) {
  console.error('❌ Error: Please specify target version. Example: npm run bump-version 1.4.0');
  process.exit(1);
}

// Clean semantic version tag (e.g. 1.4.0 or v1.4.0 -> 1.4.0)
const semVer = newVersion.replace(/^v/, '');
const vTag = `v${semVer}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log(`🚀 Bumping OmniSocket version across codebase to ${semVer} (${vTag})...\n`);

// 1. package.json
const pkgPath = path.join(rootDir, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const oldVer = pkgJson.version;
  pkgJson.version = semVer;
  fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + '\n');
  console.log(`  ✅ Updated package.json: ${oldVer} -> ${semVer}`);
}

// 2. package-lock.json
const pkgLockPath = path.join(rootDir, 'package-lock.json');
if (fs.existsSync(pkgLockPath)) {
  const pkgLockJson = JSON.parse(fs.readFileSync(pkgLockPath, 'utf-8'));
  const oldVer = pkgLockJson.version;
  pkgLockJson.version = semVer;
  if (pkgLockJson.packages && pkgLockJson.packages['']) {
    pkgLockJson.packages[''].version = semVer;
  }
  fs.writeFileSync(pkgLockPath, JSON.stringify(pkgLockJson, null, 2) + '\n');
  console.log(`  ✅ Updated package-lock.json: ${oldVer} -> ${semVer}`);
}

// 3. src/config/version.ts (Static TypeScript Export)
const versionTsPath = path.join(rootDir, 'src', 'config', 'version.ts');
const versionTsContent = `// Auto-generated during version bump. Do not edit manually.\nexport const APP_VERSION = '${semVer}';\n`;
fs.writeFileSync(versionTsPath, versionTsContent);
console.log(`  ✅ Updated src/config/version.ts -> export const APP_VERSION = '${semVer}'`);

// 4. README.md
const readmePath = path.join(rootDir, 'README.md');
if (fs.existsSync(readmePath)) {
  let content = fs.readFileSync(readmePath, 'utf-8');
  content = content.replace(/# 🚀 OmniSocket Realtime Engine \(v\d+\.\d+\.\d+\)/g, `# 🚀 OmniSocket Realtime Engine (${vTag})`);
  fs.writeFileSync(readmePath, content);
  console.log(`  ✅ Updated README.md header tag to ${vTag}`);
}

// 5. ROADMAP.md
const roadmapPath = path.join(rootDir, 'ROADMAP.md');
if (fs.existsSync(roadmapPath)) {
  let content = fs.readFileSync(roadmapPath, 'utf-8');
  content = content.replace(/## 📌 Current Capabilities \(v\d+\.\d+\.\d+ Release\)/g, `## 📌 Current Capabilities (${vTag} Release)`);
  fs.writeFileSync(roadmapPath, content);
  console.log(`  ✅ Updated ROADMAP.md release tag to ${vTag}`);
}

console.log(`\n🎉 Version update complete! Single source of truth is package.json (${semVer}).`);
