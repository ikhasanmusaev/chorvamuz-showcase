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
 * "Who am I and which build is this" — the first request of any check.
 *
 * Over two days our testing checked a process running old code three times, a test
 * run went against a stale build, and a service nobody had rebuilt very nearly went
 * to production. There was no way to tell a live process from the right one: from
 * the outside both answer identically, and just as confidently.
 *
 * The data comes from `dist/build-info.json`, written AFTER the build. Reading git
 * at request time is not an option: `/health` would then report the working tree's
 * commit — that is, the new code — while the process runs an older build, lying in
 * precisely the situation this endpoint exists for.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  /** The moment the process started, not the moment of the first request */
  private readonly startedAt = new Date().toISOString();
  private readonly build: BuildInfo;

  constructor() {
    this.build = this.readBuildInfo();
  }

  @Get()
  // An availability check must not run into the rate limiter:
  // monitoring calls it often and on a schedule
  @SkipThrottle()
  @ApiOperation({ summary: 'Who is answering, and from which build' })
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
   * The file sits next to the compiled code. No file means this was not started
   * from a build (ts-node in development) or the build is stale: we honestly say
   * `unknown` rather than substituting the current git state, which has nothing
   * to do with this process.
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
