const { Pool } = require('pg');

const pool = new Pool({
  user: 'Gurol',
  host: 'localhost',
  database: 'work_report_db',
  password: 'gurol',
  port: 5432,
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('Database connection successful!');
    
    // Test users table
    const users = await client.query('SELECT COUNT(*) FROM users');
    console.log('Users count:', users.rows[0].count);
    
    // Test projects table
    const projects = await client.query('SELECT COUNT(*) FROM projects');
    console.log('Projects count:', projects.rows[0].count);
    
    // Test user_projects table
    const userProjects = await client.query('SELECT COUNT(*) FROM user_projects');
    console.log('User-Project relationships count:', userProjects.rows[0].count);
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Database connection failed:', error);
  }
}

testConnection(); 