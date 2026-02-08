const { Pool } = require('pg');

const pool = new Pool({
  user: 'Gurol',
  host: 'localhost',
  database: 'work_report_db',
  password: 'gurol',
  port: 5432,
});

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Initializing database...');
    
    // Work reports tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_reports (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        project VARCHAR(255) NOT NULL,
        selected_machine_id VARCHAR(100),
        selected_machine_name VARCHAR(255),
        machine_hours VARCHAR(50),
        total_production VARCHAR(100),
        pile_count VARCHAR(50),
        drilled_pile VARCHAR(50),
        concrete_pile VARCHAR(50),
        total_production_summary VARCHAR(100),
        total_pile_count VARCHAR(50),
        daily_pile_count VARCHAR(50),
        total_completed_piles VARCHAR(50),
        remaining_piles VARCHAR(50),
        steel_lowered_piles VARCHAR(50),
        concrete_poured VARCHAR(100),
        engineer_count INTEGER DEFAULT 0,
        foreman_count INTEGER DEFAULT 0,
        operator_count INTEGER DEFAULT 0,
        oiler_count INTEGER DEFAULT 0,
        welder_count INTEGER DEFAULT 0,
        other_count INTEGER DEFAULT 0,
        personnel_total INTEGER DEFAULT 0,
        crane_count INTEGER DEFAULT 0,
        loader_count INTEGER DEFAULT 0,
        truck_count INTEGER DEFAULT 0,
        pickup_count INTEGER DEFAULT 0,
        car_count INTEGER DEFAULT 0,
        service_count INTEGER DEFAULT 0,
        vehicles_total INTEGER DEFAULT 0,
        daily_fuel_usage VARCHAR(100),
        expenses JSONB,
        pile_details JSONB,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Makine seçimleri tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS machine_selections (
        id SERIAL PRIMARY KEY,
        report_id INTEGER REFERENCES work_reports(id) ON DELETE CASCADE,
        machine_id VARCHAR(100) NOT NULL,
        machine_name VARCHAR(255) NOT NULL,
        machine_type VARCHAR(100) NOT NULL,
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Yakıt kayıtları tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS fuel_records (
        id SERIAL PRIMARY KEY,
        report_id INTEGER REFERENCES work_reports(id) ON DELETE CASCADE,
        machine_name VARCHAR(255) NOT NULL,
        shift VARCHAR(50),
        incoming VARCHAR(50),
        remaining VARCHAR(50),
        used VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Kullanıcılar tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Projeler tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        total_piles INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Kullanıcı-proje ilişki tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, project_id)
      )
    `);

    console.log('Database tables created successfully!');
    
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

initializeDatabase(); 