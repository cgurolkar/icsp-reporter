import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'

let db: Database | null = null

export async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await open({
      filename: './database/work_report_app.db',
      driver: sqlite3.Database
    })

    // Tabloları oluştur
    await createTables(db)
  }
  return db
}

async function createTables(db: Database) {
  // Kullanıcılar tablosu
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `)

  // Şantiyeler tablosu
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Kullanıcı şantiye yetkileri tablosu
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_site_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      site_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'operator', 'viewer')),
      permissions TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      UNIQUE(user_id, site_id)
    )
  `)

  // Şantiye ayarları tablosu
  await db.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      setting_key TEXT NOT NULL,
      setting_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      UNIQUE(site_id, setting_key)
    )
  `)

  // Makine tipleri tablosu
  await db.exec(`
    CREATE TABLE IF NOT EXISTS machine_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    )
  `)

  // Çalışma raporları tablosu
  await db.exec(`
    CREATE TABLE IF NOT EXISTS work_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      report_date DATE NOT NULL,
      machine_type TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      total_hours REAL NOT NULL,
      completed_piles INTEGER DEFAULT 0,
      total_piles INTEGER DEFAULT 0,
      weather_condition TEXT,
      notes TEXT,
      custom_fields TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Admin kullanıcısını kontrol et ve yoksa ekle
  const adminUser = await db.get("SELECT id FROM users WHERE username = 'admin'")
  if (!adminUser) {
    const bcrypt = require('bcryptjs')
    const passwordHash = await bcrypt.hash('admin123', 12)
    
    await db.run(`
      INSERT INTO users (username, email, password_hash, full_name) 
      VALUES (?, ?, ?, ?)
    `, ['admin', 'admin@company.com', passwordHash, 'Admin User'])
  }

  // Test şantiyelerini kontrol et ve yoksa ekle
  const sites = await db.all("SELECT id FROM sites LIMIT 1")
  if (sites.length === 0) {
    await db.run(`
      INSERT INTO sites (site_code, name, location) VALUES 
      (?, ?, ?), (?, ?, ?), (?, ?, ?)
    `, [
      'SITE1', 'Test Şantiye 1', 'İstanbul, Türkiye',
      'SITE2', 'Test Şantiye 2', 'Ankara, Türkiye',
      'SITE3', 'Test Şantiye 3', 'İzmir, Türkiye'
    ])
  }

  // Admin kullanıcısını tüm şantiyelere yetki ver
  const adminId = await db.get("SELECT id FROM users WHERE username = 'admin'")
  const allSites = await db.all("SELECT id FROM sites")
  
  for (const site of allSites) {
    const permission = await db.get(
      "SELECT id FROM user_site_permissions WHERE user_id = ? AND site_id = ?",
      [adminId.id, site.id]
    )
    
    if (!permission) {
      await db.run(`
        INSERT INTO user_site_permissions (user_id, site_id, role, permissions) 
        VALUES (?, ?, ?, ?)
      `, [adminId.id, site.id, 'admin', '["admin", "manager", "operator", "viewer"]'])
    }
  }
}

export async function closeDatabase() {
  if (db) {
    await db.close()
    db = null
  }
} 