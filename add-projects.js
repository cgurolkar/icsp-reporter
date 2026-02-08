const { Pool } = require('pg');

const pool = new Pool({
  user: 'Gurol',
  host: 'localhost',
  database: 'work_report_db',
  password: 'gurol',
  port: 5432,
});

async function addProjects() {
  try {
    const client = await pool.connect();
    
    console.log('Adding projects...');
    
    // Projeleri ekle
    await client.query(`
      INSERT INTO projects (name, description, total_piles, status) VALUES
      ('SHAQLAWA / PROJECT', 'Ana proje', 201, 'active'),
      ('Proje A', 'Test projesi A', 150, 'active'),
      ('Proje B', 'Test projesi B', 100, 'active'),
      ('Proje C', 'Test projesi C', 75, 'inactive')
    `);
    
    console.log('Projects added successfully!');
    
    // Kontrol et
    const projects = await client.query('SELECT * FROM projects');
    console.log('\nProjects in database:');
    projects.rows.forEach(project => {
      console.log(`- ${project.name} (${project.total_piles} piles) - ${project.status}`);
    });
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Error adding projects:', error);
  }
}

addProjects(); 