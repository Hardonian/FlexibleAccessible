const { execSync } = require('child_process');

/**
 * Define strictly monitored dependencies where falling behind 
 * could result in critical security vulnerabilities.
 */
const SECURITY_CRITICAL_PACKAGES = [
  'sanitize-html',
  'stripe',
  'bullmq',
  'next',
  'react',
  '@prisma/client',
  'prisma',
  'playwright'
];

console.log('🛡️ Checking for updates to security-critical dependencies across workspaces...');

let jsonOutput = '{}';

try {
  // npm outdated exits with code 1 if ANY updates are found, so we must catch the error
  execSync('npm outdated --json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
} catch (error) {
  jsonOutput = error.stdout || '{}';
}

let outdated;
try {
  outdated = JSON.parse(jsonOutput);
} catch (e) {
  console.error('❌ Failed to parse npm outdated output. Ensure your package.json is valid.');
  process.exit(1);
}

let foundUpdates = false;

for (const pkg of SECURITY_CRITICAL_PACKAGES) {
  if (outdated[pkg] && outdated[pkg].current !== outdated[pkg].wanted) {
    console.warn(`\n🚨 [WARNING] Security-critical package '${pkg}' is out of date!`);
    console.warn(`   Current: ${outdated[pkg].current} -> Wanted: ${outdated[pkg].wanted} (Latest: ${outdated[pkg].latest})`);
    foundUpdates = true;
  }
}

if (foundUpdates) {
  console.error('\n❌ Please update the above dependencies to maintain optimal security.');
  process.exit(1);
} else {
  console.log('✅ All monitored security packages are up to date!');
  process.exit(0);
}