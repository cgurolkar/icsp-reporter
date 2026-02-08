const { Pool } = require('pg');

const pool = new Pool({
  user: 'Gurol',
  host: 'localhost',
  database: 'work_report_db',
  password: 'gurol',
  port: 5432,
});

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Seeding database...');
    
    // Örnek kullanıcılar ekle
    await client.query(`
      INSERT INTO users (username, password_hash, role, email) VALUES
      ('admin', 'YWRtaW4=', 'admin', 'admin@company.com'),
      ('user1', 'dXNlcjE=', 'user', 'user1@company.com'),
      ('user2', 'dXNlcjI=', 'user', 'user2@company.com'),
      ('manager', 'bWFuYWdlcg==', 'admin', 'manager@company.com')
    `);
    
    // Örnek projeler ekle
    await client.query(`
      INSERT INTO projects (name, description, total_piles, status) VALUES
      ('SHAQLAWA / PROJECT', 'Ana proje', 201, 'active'),
      ('Proje A', 'Test projesi A', 150, 'active'),
      ('Proje B', 'Test projesi B', 100, 'active'),
      ('Proje C', 'Test projesi C', 75, 'inactive')
    `);
    
    // Kullanıcı-proje ilişkileri ekle
    await client.query(`
      INSERT INTO user_projects (user_id, project_id) VALUES
      (1, 1), (1, 2), (1, 3), (1, 4), -- admin tüm projelerde
      (2, 1), (2, 2), -- user1 sadece 2 projede
      (3, 1), (3, 3), -- user2 sadece 2 projede
      (4, 1), (4, 2), (4, 3) -- manager 3 projede
    `);
    
    console.log('Database seeded successfully!');
    
    // Verileri kontrol et
    const users = await client.query('SELECT * FROM users');
    const projects = await client.query('SELECT * FROM projects');
    const userProjects = await client.query('SELECT * FROM user_projects');
    
    console.log('\nUsers:', users.rows.length);
    console.log('Projects:', projects.rows.length);
    console.log('User-Project relationships:', userProjects.rows.length);
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase(); 