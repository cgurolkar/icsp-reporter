import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database';
import { getSessionFromRequest } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';

const ALLOWED_ROLES = ['admin', 'manager', 'user', 'personel', 'operator'];

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 403 });
  }
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
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 403 });
  }
  try {
    const { username, password, role, email, siteId } = await request.json();
    const roleVal = role && ALLOWED_ROLES.includes(role) ? role : 'user';
    const passwordHash = await hashPassword(password);
    const siteIdVal = siteId != null && siteId !== '' ? (typeof siteId === 'number' ? siteId : parseInt(String(siteId), 10)) : null;
    const client = await pool.connect();
    const result = await client.query(`
      INSERT INTO users (username, password_hash, role, email, site_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, role, email, site_id
    `, [username, passwordHash, roleVal, email || null, Number.isInteger(siteIdVal) ? siteIdVal : null]);
    
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