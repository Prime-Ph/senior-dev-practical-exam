import { INestApplication } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/create-app';
import { Clock } from '../src/common/clock';
import { Database, FIXTURE_MARKER } from '../src/database/database';

export class TestClock extends Clock {
  private current = 1000000;
  now(): number { return this.current; }
  advance(ms: number): void { this.current += ms; }
}

export async function testApp() {
  const db = new Database();
  const clock = new TestClock();
  const app = await createApp(db, clock);
  try {
    await app.init();
    const markers = await db.query<{ value: string; db: string }>("SELECT current_database() AS db, value FROM exam_meta WHERE key = 'fixture'");
    if (markers[0]?.db !== 'practical_exam' || markers[0]?.value !== FIXTURE_MARKER) {
      throw new Error('Tests require the dedicated exam database');
    }
    await db.query(await readFile(resolve(process.cwd(), 'db/02-seed.sql'), 'utf8'));
    db.resetMetrics();
    return { app, db, clock };
  } catch (error) {
    await app.close();
    throw error;
  }
}

export function get(app: INestApplication, path: string, token = 'demo-alpha') {
  return request(app.getHttpServer()).get(path).set('Authorization', 'Bearer ' + token);
}

export function inquire(app: INestApplication, token = 'demo-alpha') {
  return request(app.getHttpServer()).post('/inquiries')
    .set('Authorization', 'Bearer ' + token).send({ listingId: 1, message: 'Interested' });
}
