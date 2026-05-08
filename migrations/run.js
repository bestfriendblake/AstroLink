require('dotenv').config();
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

async function runMigrations() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  console.log('[Migration] Connected to MySQL');

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
      filename   VARCHAR(255)  NOT NULL,
      run_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_filename (filename)
    )
  `);

  const [ran] = await conn.execute('SELECT filename FROM _migrations');
  const ranSet = new Set(ran.map(r => r.filename));

  const files = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (ranSet.has(file)) {
      console.log(`[Migration] Skipping (already ran): ${file}`);
      continue;
    }
    console.log(`[Migration] Running: ${file}`);
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    await conn.query(sql);
    await conn.execute('INSERT INTO _migrations (filename) VALUES (?)', [file]);
    console.log(`[Migration] ✓ Done: ${file}`);
  }

  await conn.end();
  console.log('[Migration] All migrations complete.');
}

runMigrations().catch(err => {
  console.error('[Migration] FAILED:', err.message);
  process.exit(1);
});