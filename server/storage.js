const { Low } = require('lowdb')
const { JSONFile } = require('lowdb/node')
const { nanoid } = require('nanoid')
const path = require('path')
const fs = require('fs')

// Ensure DB folder exists and move DB into a data/ dir so nodemon can ignore it
const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const file = path.join(dataDir, 'db.json')
const adapter = new JSONFile(file)
const db = new Low(adapter)

async function init() {
  await db.read()
  db.data = db.data || { alerts: [], localities: [], vessels: [], users: [] }
  await db.write()
}

async function getRaw() {
  await db.read()
  return db.data
}

async function getAlerts() {
  await db.read()
  return db.data?.alerts || []
}

async function addAlert(alert) {
  const a = {
    id: nanoid(),
    title: alert.title || 'Varsel',
    message: alert.message || '',
    riskLevel: alert.riskLevel || 'varsel',
    createdAt: new Date().toISOString(),
    isRead: false
  }
  db.data.alerts.unshift(a)
  await db.write()
  return a
}

async function clearAlerts() {
  db.data.alerts = []
  return db.write()
}

init().catch(console.error)

module.exports = { getRaw, getAlerts, addAlert, clearAlerts }
