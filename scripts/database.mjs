import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://exam:exam_local_only@127.0.0.1:55432/practical_exam',
  connectionTimeoutMillis: 5000,
});
try {
  const marker = await pool.query("SELECT current_database() AS db, value FROM exam_meta WHERE key = 'fixture'");
  if (marker.rows[0]?.db !== 'practical_exam' || marker.rows[0]?.value !== 'senior-dev-practical-exam-three-items') {
    throw new Error('Expected the dedicated seeded practical-exam database');
  }
  if (process.argv[2] === 'reset') {
    await pool.query(await readFile(new URL('../db/02-seed.sql', import.meta.url), 'utf8'));
  }
  const result = await pool.query('SELECT tenant_id, COUNT(*)::integer AS listings FROM listings GROUP BY tenant_id ORDER BY tenant_id');
  console.log(process.argv[2] === 'reset' ? 'Exam fixtures reset.' : 'Exam database ready.');
  console.table(result.rows);
} catch (error) {
  console.error(error.message);
  console.error('Run docker compose up -d --wait first.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
