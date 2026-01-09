const { Low } = require('lowdb')
const { JSONFile } = require('lowdb/node')
const { nanoid } = require('nanoid')
const path = require('path')

const file = path.join(__dirname, 'db.json')
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

function getAlerts() {
  // sync read is fine for small prototype
  return db.data?.alerts || []
}

function addAlert(alert) {
  const a = {
    id: nanoid(),
    title: alert.title || 'Varsel',
    message: alert.message || '',
    riskLevel: alert.riskLevel || 'varsel',
    createdAt: new Date().toISOString(),
    isRead: false
  }
  db.data.alerts.unshift(a)
  db.write()
  return a
}

function clearAlerts() {
  db.data.alerts = []
  return db.write()
}

init().catch(console.error)

module.exports = { getRaw, getAlerts, addAlert, clearAlerts }
