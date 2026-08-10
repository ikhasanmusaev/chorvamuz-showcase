/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');
const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

/**
 * Снимок сборки рядом с самой сборкой.
 *
 * Пишется ПОСЛЕ компиляции, в dist. Это принципиально: если читать git
 * в момент запроса, health покажет коммит рабочего дерева — то есть новый
 * код, — пока процесс крутит старую сборку. Ровно та ошибка, ради которой
 * эндпоинт и делается.
 *
 * Файл лежит в dist и умирает вместе с ним: пересобрал — обновился,
 * не пересобрал — остался прежним, честно показывая, что крутится.
 */
function git(command, fallback = 'unknown') {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    // На проде исходников и .git может не быть — это нормально,
    // тогда значение подставит CI через переменные окружения
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

console.log(`build-info: commit ${info.commit} (${info.branch}), собрано ${info.builtAt}`);
