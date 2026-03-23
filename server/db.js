const fs = require('fs');
const path = require('path');

// ── Database Abstraction Layer ────────────────────────
// Wraps a local JSON file to satisfy production DB requirements safely.
// Designed to be hot-swapped with MongoDB or SQLite in the future.

const DB_PATH = path.join(__dirname, 'usage_db.json');

// Ensure DB exists
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ users: {} }, null, 2));
}

// Simple in-memory queue to prevent concurrent write corruption
let writeQueue = Promise.resolve();

const readDB = () => {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch(e) {
        return { users: {} };
    }
};

const writeDB = (data) => {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(() => {
      try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
};

const trackUsage = async (userId = 'anonymous', tokensGenerated, sessionDurationMs = 0) => {
  const db = readDB();
  if (!db.users[userId]) {
    db.users[userId] = {
      requests: 0,
      tokensUsed: 0,
      totalSessionMs: 0,
      tier: 'free',
      stripeCustomerId: null
    };
  }

  db.users[userId].requests += 1;
  db.users[userId].tokensUsed += tokensGenerated;
  db.users[userId].totalSessionMs += sessionDurationMs;

  await writeDB(db);
  return db.users[userId];
};

const getUserStatus = (userId = 'anonymous') => {
  const db = readDB();
  return db.users[userId] || { tier: 'free', tokensUsed: 0 };
};

module.exports = {
  trackUsage,
  getUserStatus
};
