/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');
const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

/**
 * A snapshot of the build, stored next to the build itself.
 *
 * Written AFTER compilation, into dist. That ordering is the point: if git were
 * read at request time, health would report the working tree's commit — the new
 * code — while the process runs an older build. Exactly the mistake this endpoint
 * exists to prevent.
 *
 * The file lives in dist and dies with it: rebuild and it updates, skip the
 * rebuild and it stays as it was, honestly reporting what is actually running.
 */
function git(command, fallback = 'unknown') {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    // In production there may be no sources and no .git — that is expected;
    // in that case CI supplies the values through environment variables
    return fallback;
  }
}

const info = {
  commit: process.env.GIT_COMMIT || git('git rev-parse --short HEAD'),
  branch: process.env.GIT_BRANCH || git('git rev-parse --abbrev-ref HEAD'),
  commitDate: process.env.GIT_COMMIT_DATE || git('git log -1 --format=%cI'),
  builtAt: new Date().toISOString(),
};

const distDir = join(__dirname, '..', 'dist');
mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, 'build-info.json'), JSON.stringify(info, null, 2));

console.log(`build-info: commit ${info.commit} (${info.branch}), built at ${info.builtAt}`);
