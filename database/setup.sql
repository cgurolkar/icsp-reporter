-- Veritabanını oluştur
CREATE DATABASE IF NOT EXISTS work_report_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE work_report_app;

-- Kullanıcılar tablosu
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL
);

-- Şantiyeler tablosu
CREATE TABLE IF NOT EXISTS sites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(200) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Kullanıcı şantiye yetkileri tablosu
CREATE TABLE IF NOT EXISTS user_site_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  site_id INT NOT NULL,
  role ENUM('admin', 'manager', 'operator', 'viewer') NOT NULL,
  permissions JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_site (user_id, site_id)
);

-- Şantiye ayarları tablosu
CREATE TABLE IF NOT EXISTS site_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_id INT NOT NULL,
  setting_key VARCHAR(50) NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  UNIQUE KEY unique_site_setting (site_id, setting_key)
);

-- Makine tipleri tablosu
CREATE TABLE IF NOT EXISTS machine_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Çalışma raporları tablosu
CREATE TABLE IF NOT EXISTS work_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_id INT NOT NULL,
  user_id INT NOT NULL,
  report_date DATE NOT NULL,
  machine_type VARCHAR(100) NOT NULL,
  operator_name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_hours DECIMAL(4,2) NOT NULL,
  completed_piles INT DEFAULT 0,
  total_piles INT DEFAULT 0,
  weather_condition VARCHAR(50),
  notes TEXT,
  custom_fields JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Admin kullanıcısı için şifre hash'i (admin123)
INSERT INTO users (username, email, password_hash, full_name) VALUES 
('admin', 'admin@company.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KqKqKq', 'Admin User')
ON DUPLICATE KEY UPDATE 
  password_hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KqKqKq',
  full_name = 'Admin User';

-- Test şantiyeleri
INSERT INTO sites (site_code, name, location) VALUES 
('SITE1', 'Test Şantiye 1', 'İstanbul, Türkiye'),
('SITE2', 'Test Şantiye 2', 'Ankara, Türkiye'),
('SITE3', 'Test Şantiye 3', 'İzmir, Türkiye')
ON DUPLICATE KEY UPDATE 
  name = VALUES(name),
  location = VALUES(location);

-- Admin kullanıcısını tüm şantiyelere yetki ver
INSERT INTO user_site_permissions (user_id, site_id, role, permissions) VALUES 
(1, 1, 'admin', '["admin", "manager", "operator", "viewer"]'),
(1, 2, 'admin', '["admin", "manager", "operator", "viewer"]'),
(1, 3, 'admin', '["admin", "manager", "operator", "viewer"]')
ON DUPLICATE KEY UPDATE 
  role = VALUES(role),
  permissions = VALUES(permissions); 