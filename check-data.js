const { Pool } = require('pg');

const pool = new Pool({
  user: 'Gurol',
  host: 'localhost',
  database: 'work_report_db',
  password: 'gurol',
  port: 5432,
});

async function checkData() {
  try {
    const client = await pool.connect();
    
    console.log('=== DATABASE DATA CHECK ===\n');
    
    // Users
    const users = await client.query('SELECT * FROM users');
    console.log('USERS:');
    users.rows.forEach(user => {
      console.log(`- ${user.username} (${user.role}) - ${user.email}`);
    });
    console.log(`Total: ${users.rows.length} users\n`);
    
    // Projects
    const projects = await client.query('SELECT * FROM projects');
    console.log('PROJECTS:');
    projects.rows.forEach(project => {
      console.log(`- ${project.name} (${project.total_piles} piles) - ${project.status}`);
    });
    console.log(`Total: ${projects.rows.length} projects\n`);
    
    // User-Project relationships
    const userProjects = await client.query(`
      SELECT u.username, p.name 
      FROM user_projects up
      JOIN users u ON up.user_id = u.id
      JOIN projects p ON up.project_id = p.id
      ORDER BY u.username, p.name
    `);
    console.log('USER-PROJECT RELATIONSHIPS:');
    userProjects.rows.forEach(rel => {
      console.log(`- ${rel.username} -> ${rel.name}`);
    });
    console.log(`Total: ${userProjects.rows.length} relationships\n`);
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Error checking data:', error);
  }
}

checkData(); 