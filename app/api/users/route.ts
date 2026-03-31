import { NextRequest, NextResponse } from 'next/server';
import pool, { initializeDatabase } from '@/lib/database';
import { getSessionFromRequest } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';

const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'user', 'personel', 'operator'];

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 403 });
  }
  try {
    await initializeDatabase();
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT u.id, u.username, u.role, u.email, u.created_at, u.site_id, u.module_permissions,
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
  if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 403 });
  }
  try {
    await initializeDatabase();
    const body = await request.json();
    const { username, password, role, email, siteId, modulePermissions, personelId } = body;
    const requestedRole = role && ALLOWED_ROLES.includes(role) ? role : 'user';
    const roleVal = (requestedRole === "super_admin" && session.role !== "super_admin") ? "admin" : requestedRole;
    const passwordHash = await hashPassword(password);
    const siteIdVal = siteId != null && siteId !== '' ? (typeof siteId === 'number' ? siteId : parseInt(String(siteId), 10)) : null;
    const permsJson = modulePermissions && typeof modulePermissions === 'object'
      ? JSON.stringify(modulePermissions)
      : '{}';
    const personelIdVal = personelId != null && personelId !== '' ? parseInt(String(personelId), 10) : null;
    const client = await pool.connect();
    const result = await client.query(`
      INSERT INTO users (username, password_hash, role, email, site_id, module_permissions)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING id, username, role, email, site_id, module_permissions
    `, [username, passwordHash, roleVal, email || null, Number.isInteger(siteIdVal) ? siteIdVal : null, permsJson]);

    const newUserId = result.rows[0]?.id as number;
    if (newUserId && personelIdVal != null && !Number.isNaN(personelIdVal) && personelIdVal > 0) {
      await client.query(`UPDATE personeller SET user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [newUserId, personelIdVal]);
    }

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