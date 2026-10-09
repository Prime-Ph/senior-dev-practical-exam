import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';

export const DEFAULT_DATABASE_URL = 'postgresql://exam:exam_local_only@127.0.0.1:55432/practical_exam';
export const FIXTURE_MARKER = 'senior-dev-practical-exam-three-items';

export class Database implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  readonly metrics = { queryCount: 0 };

  constructor(url = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL) {
    this.pool = new Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 5000 });
  }

  async onModuleInit(): Promise<void> {
    const rows = await this.query<{ value: string }>("SELECT value FROM exam_meta WHERE key = 'fixture'");
    if (rows[0]?.value !== FIXTURE_MARKER) throw new Error('Expected the seeded practical-exam database');
    this.resetMetrics();
  }

  async query<T extends QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
    this.metrics.queryCount += 1;
    return (await this.pool.query<T>(text, values)).rows;
  }

  resetMetrics(): void { this.metrics.queryCount = 0; }
  async onModuleDestroy(): Promise<void> { await this.pool.end(); }
}
