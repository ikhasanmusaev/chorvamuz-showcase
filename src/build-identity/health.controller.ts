import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { join } from 'path';

interface BuildInfo {
  commit: string;
  branch: string;
  commitDate: string;
  builtAt: string;
}

/**
 * «Кто я и какой билд» — первым запросом любой проверки.
 *
 * За два дня тестирование трижды проверяло процесс со старым кодом, прогон
 * шёл против старой сборки, а на прод чуть не уехал сервис, который никто
 * не пересобрал. Отличить живой процесс от нужного было нечем: снаружи оба
 * отвечают одинаково и одинаково бодро.
 *
 * Данные берутся из `dist/build-info.json`, который пишется ПОСЛЕ сборки.
 * Читать git в момент запроса нельзя: тогда health показывал бы коммит
 * рабочего дерева, пока процесс крутит старую сборку, — и врал бы ровно
 * в том случае, ради которого заведён.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  /** Момент старта процесса, а не первого запроса */
  private readonly startedAt = new Date().toISOString();
  private readonly build: BuildInfo;

  constructor() {
    this.build = this.readBuildInfo();
  }

  @Get()
  // Проверка доступности не должна упираться в лимит запросов:
  // мониторинг дёргает её часто и по расписанию
  @SkipThrottle()
  @ApiOperation({ summary: 'Кто отвечает и какой сборкой' })
  check() {
    return {
      service: 'api',
      status: 'ok',
      commit: this.build.commit,
      branch: this.build.branch,
      commitDate: this.build.commitDate,
      builtAt: this.build.builtAt,
      startedAt: this.startedAt,
      uptimeSec: Math.round(process.uptime()),
      env: process.env.NODE_ENV ?? 'unknown',
    };
  }

  /**
   * Файл лежит рядом со скомпилированным кодом. Нет файла — значит запущено
   * не из сборки (ts-node в разработке) или сборка старая: говорим `unknown`
   * честно, а не подставляем текущий git, который к этому процессу
   * отношения не имеет.
   */
  private readBuildInfo(): BuildInfo {
    const unknown: BuildInfo = {
      commit: 'unknown',
      branch: 'unknown',
      commitDate: 'unknown',
      builtAt: 'unknown',
    };
    try {
      const raw = readFileSync(join(__dirname, '..', 'build-info.json'), 'utf-8');
      return { ...unknown, ...(JSON.parse(raw) as Partial<BuildInfo>) };
    } catch {
      return unknown;
    }
  }
}
