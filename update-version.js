#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the new version from command line argument
const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Usage: node update-version.js <new-version>');
  console.error('Example: node update-version.js 0.3.1');
  process.exit(1);
}

// Validate version format (basic semver check)
if (!/^\d+\.\d+\.\d+(-.*)?$/.test(newVersion)) {
  console.error('Invalid version format. Use semantic versioning (e.g., 1.0.0)');
  process.exit(1);
}

console.log(`Updating version to ${newVersion}...`);

// Update package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('✅ Updated package.json');

// Update Cargo.toml
const cargoTomlPath = path.join(__dirname, 'src-tauri', 'Cargo.toml');
let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
cargoToml = cargoToml.replace(/^version = ".*"$/m, `version = "${newVersion}"`);
fs.writeFileSync(cargoTomlPath, cargoToml);
console.log('✅ Updated src-tauri/Cargo.toml');

// Update tauri.conf.json
const tauriConfPath = path.join(__dirname, 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = newVersion;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log('✅ Updated src-tauri/tauri.conf.json');

// Update package-lock.json
try {
  execSync('npm install --package-lock-only', { stdio: 'inherit' });
  console.log('✅ Updated package-lock.json');
} catch (error) {
  console.warn('⚠️  Failed to update package-lock.json, please run npm install manually');
}

// Update Cargo.lock
try {
  process.chdir(path.join(__dirname, 'src-tauri'));
  execSync('cargo update', { stdio: 'inherit' });
  console.log('✅ Updated Cargo.lock');
} catch (error) {
  console.warn('⚠️  Failed to update Cargo.lock, please run cargo update manually');
}

console.log(`\n🎉 Version updated to ${newVersion} successfully!`);
console.log('\nNext steps:');
console.log('1. Review the changes');
console.log('2. Commit the version update');
console.log('3. Push to trigger the release workflow');
console.log('\nCommands to run:');
console.log(`git add .`);
console.log(`git commit -m "bump version to ${newVersion}"`);
console.log(`git push`);
