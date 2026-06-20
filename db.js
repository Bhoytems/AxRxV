const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('[db] schema ready');
}

// Ensures a user row exists, updating username/first_name if it has changed.
async function upsertUser(telegramId, username, firstName) {
  const result = await pool.query(
    `INSERT INTO users (telegram_id, username, first_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id)
     DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name
     RETURNING *`,
    [telegramId, username || null, firstName || null]
  );
  return result.rows[0];
}

async function getUser(telegramId) {
  const result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return result.rows[0] || null;
}

async function getUserByUsername(username) {
  const clean = username.replace(/^@/, '').toLowerCase();
  const result = await pool.query('SELECT * FROM users WHERE LOWER(username) = $1', [clean]);
  return result.rows[0] || null;
}

async function addBalance(telegramId, amount) {
  const result = await pool.query(
    'UPDATE users SET balance = balance + $2 WHERE telegram_id = $1 RETURNING *',
    [telegramId, amount]
  );
  return result.rows[0];
}

async function setAwaitingWallet(telegramId, awaiting) {
  await pool.query('UPDATE users SET awaiting_wallet = $2 WHERE telegram_id = $1', [telegramId, awaiting]);
}

async function setPendingWallet(telegramId, wallet) {
  await pool.query('UPDATE users SET pending_wallet = $2 WHERE telegram_id = $1', [telegramId, wallet]);
}

async function finalizeVerification(telegramId) {
  const result = await pool.query(
    `UPDATE users
     SET wallet_address = pending_wallet, verified = TRUE,
         awaiting_wallet = FALSE, pending_wallet = NULL
     WHERE telegram_id = $1
     RETURNING *`,
    [telegramId]
  );
  return result.rows[0];
}

async function markJoinedTaskDone(telegramId) {
  const result = await pool.query(
    `UPDATE users SET joined_task_done = TRUE
     WHERE telegram_id = $1 AND joined_task_done = FALSE
     RETURNING *`,
    [telegramId]
  );
  return result.rows[0] || null; // null means it was already done (no-op)
}

async function markStartedBotTaskDone(telegramId) {
  const result = await pool.query(
    `UPDATE users SET started_bot_task_done = TRUE
     WHERE telegram_id = $1 AND started_bot_task_done = FALSE
     RETURNING *`,
    [telegramId]
  );
  return result.rows[0] || null;
}

async function setReferredBy(telegramId, referrerId) {
  // Only set if not already set, and not a self-referral
  await pool.query(
    `UPDATE users SET referred_by = $2
     WHERE telegram_id = $1 AND referred_by IS NULL AND $1 != $2`,
    [telegramId, referrerId]
  );
}

async function awardReferralIfDue(referredUserId) {
  // Called once the referred user verifies. Pays the referrer once.
  const user = await getUser(referredUserId);
  if (!user || !user.referred_by || user.referral_awarded) return null;

  const referrer = await getUser(user.referred_by);
  if (!referrer) return null;

  await pool.query(
    `UPDATE users SET referral_awarded = TRUE WHERE telegram_id = $1`,
    [referredUserId]
  );
  await pool.query(
    `UPDATE users SET referral_count = referral_count + 1 WHERE telegram_id = $1`,
    [referrer.telegram_id]
  );

  return referrer;
}

async function getTopUsers(limit = 50) {
  const result = await pool.query(
    'SELECT telegram_id, username, first_name, balance FROM users ORDER BY balance DESC, telegram_id ASC LIMIT $1',
    [limit]
  );
  return result.rows;
}

// --- Admin-configured "start bot" tasks ---

async function createTask(title, botLink, reward, createdBy) {
  const result = await pool.query(
    `INSERT INTO tasks (title, bot_link, reward, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
    [title, botLink, reward, createdBy]
  );
  return result.rows[0];
}

async function getTask(taskId) {
  const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  return result.rows[0] || null;
}

async function getActiveTasks() {
  const result = await pool.query('SELECT * FROM tasks WHERE active = TRUE ORDER BY id DESC');
  return result.rows;
}

async function deactivateTask(taskId) {
  const result = await pool.query(
    'UPDATE tasks SET active = FALSE WHERE id = $1 RETURNING *',
    [taskId]
  );
  return result.rows[0] || null;
}

// Attempts to claim a task for a user. Returns true if this was a new claim,
// false if they'd already claimed it (relies on the PK to prevent races).
async function claimTask(taskId, telegramId) {
  try {
    await pool.query(
      'INSERT INTO task_completions (task_id, telegram_id) VALUES ($1, $2)',
      [taskId, telegramId]
    );
    return true;
  } catch (err) {
    if (err.code === '23505') return false; // unique violation = already claimed
    throw err;
  }
}

module.exports = {
  pool,
  initDb,
  upsertUser,
  getUser,
  getUserByUsername,
  addBalance,
  setAwaitingWallet,
  setPendingWallet,
  finalizeVerification,
  markJoinedTaskDone,
  markStartedBotTaskDone,
  setReferredBy,
  awardReferralIfDue,
  getTopUsers,
  createTask,
  getTask,
  getActiveTasks,
  deactivateTask,
  claimTask,
};
