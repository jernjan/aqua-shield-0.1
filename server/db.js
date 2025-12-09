import jsonfile from 'jsonfile';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../db.json');

const defaultDB = {
  users: [],
  alerts: [],
  facilities: [],
  vessels: []
};

export async function readDB() {
  try {
    return await jsonfile.readFile(dbPath);
  } catch (err) {
    // DB doesn't exist yet, return default
    return defaultDB;
  }
}

export async function writeDB(data) {
  await jsonfile.writeFile(dbPath, data, { spaces: 2 });
}

export async function getUser(userId) {
  const db = await readDB();
  return db.users.find(u => u.id === userId);
}

export async function getUserByEmail(email) {
  const db = await readDB();
  return db.users.find(u => u.email === email);
}

export async function saveUser(user) {
  const db = await readDB();
  const idx = db.users.findIndex(u => u.id === user.id);
  if (idx === -1) {
    db.users.push(user);
  } else {
    db.users[idx] = user;
  }
  await writeDB(db);
}

export async function getAlerts(userId) {
  const db = await readDB();
  return db.alerts.filter(a => a.userId === userId);
}

export async function saveAlert(alert) {
  const db = await readDB();
  db.alerts.push(alert);
  await writeDB(db);
}

export async function updateAlert(alertId, updates) {
  const db = await readDB();
  const idx = db.alerts.findIndex(a => a.id === alertId);
  if (idx !== -1) {
    db.alerts[idx] = { ...db.alerts[idx], ...updates };
    await writeDB(db);
  }
}
