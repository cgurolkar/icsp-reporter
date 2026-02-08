import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT u.id, u.username, u.role, u.email, u.created_at, u.site_id,
        s.name AS site_name, s.code AS site_code
      FROM users u
      LEFT JOIN sites s ON u.site_id = s.id
      ORDER BY u.created_at DESC
    `);
    
    client.release();
    
    return NextResponse.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password, role, email, siteId } = await request.json();
    
    const client = await pool.connect();
    
    // Basit şifre hash'i (production'da bcrypt kullan)
    const passwordHash = Buffer.from(password).toString('base64');
    
    const siteIdVal = siteId != null && siteId !== '' ? (typeof siteId === 'number' ? siteId : parseInt(String(siteId), 10)) : null;
    const result = await client.query(`
      INSERT INTO users (username, password_hash, role, email, site_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, role, email, site_id
    `, [username, passwordHash, role || 'user', email || null, Number.isInteger(siteIdVal) ? siteIdVal : null]);
    
    client.release();
    
    return NextResponse.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    );
  }
} 