const jsonfile = require('jsonfile');
const path = require('path');

const dbPath = path.join(__dirname, '../db.json');

const defaultDB = {
  users: [],
  alerts: [],
  facilities: [],
  vessels: []
};

async function readDB() {
  try {
    return await jsonfile.readFile(dbPath);
  } catch (err) {
    // DB doesn't exist yet, return default
    return defaultDB;
  }
}

async function writeDB(data) {
  await jsonfile.writeFile(dbPath, data, { spaces: 2 });
}

async function getUser(userId) {
  const db = await readDB();
  return db.users.find(u => u.id === userId);
}

async function getUserByEmail(email) {
  const db = await readDB();
  return db.users.find(u => u.email === email);
}

async function saveUser(user) {
  const db = await readDB();
  const idx = db.users.findIndex(u => u.id === user.id);
  if (idx === -1) {
    db.users.push(user);
  } else {
    db.users[idx] = user;
  }
  await writeDB(db);
}

async function getAlerts(userId) {
  const db = await readDB();
  return db.alerts.filter(a => a.userId === userId);
}

async function saveAlert(alert) {
  const db = await readDB();
  db.alerts.push(alert);
  await writeDB(db);
}

async function updateAlert(alertId, updates) {
  const db = await readDB();
  const idx = db.alerts.findIndex(a => a.id === alertId);
  if (idx !== -1) {
    db.alerts[idx] = { ...db.alerts[idx], ...updates };
    await writeDB(db);
  }
}

module.exports = {
  readDB,
  writeDB,
  getUser,
  getUserByEmail,
  saveUser,
  getAlerts,
  saveAlert,
  updateAlert
};
