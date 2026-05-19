import { NextRequest, NextResponse } from 'next/server';
import pool, { initializeDatabase } from '@/lib/database';
import { getSessionFromRequest } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';

const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'user', 'personel', 'operator', 'engineer'];

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 403 });
  }
  try {
    await initializeDatabase();
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT u.id, u.username, u.role, u.email, u.created_at, u.site_id, u.secondary_site_id, u.module_permissions,
        s.name AS site_name, s.code AS site_code,
        s2.name AS secondary_site_name, s2.code AS secondary_site_code
      FROM users u
      LEFT JOIN sites s ON u.site_id = s.id
      LEFT JOIN sites s2 ON u.secondary_site_id = s2.id
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
    const { username, password, role, email, siteId, secondarySiteId, modulePermissions, personelId } = body;
    const requestedRole = role && ALLOWED_ROLES.includes(role) ? role : 'user';
    const roleVal = (requestedRole === "super_admin" && session.role !== "super_admin") ? "admin" : requestedRole;
    const passwordHash = await hashPassword(password);
    const siteIdVal = siteId != null && siteId !== '' ? (typeof siteId === 'number' ? siteId : parseInt(String(siteId), 10)) : null;
    const secondarySiteIdVal =
      secondarySiteId != null && secondarySiteId !== ''
        ? typeof secondarySiteId === 'number'
          ? secondarySiteId
          : parseInt(String(secondarySiteId), 10)
        : null;
    if (
      Number.isInteger(siteIdVal) &&
      Number.isInteger(secondarySiteIdVal) &&
      siteIdVal === secondarySiteIdVal
    ) {
      return NextResponse.json({ success: false, error: 'İkinci şantiye birinciden farklı olmalıdır.' }, { status: 400 });
    }
    const permsJson = modulePermissions && typeof modulePermissions === 'object'
      ? JSON.stringify(modulePermissions)
      : '{}';
    const personelIdVal = personelId != null && personelId !== '' ? parseInt(String(personelId), 10) : null;
    const client = await pool.connect();
    // Operatör: sahada hızlı giriş; admin zaten şifreyi belirliyor — ilk girişte zorunlu şifre değişimini kapat
    const mustChangePassword = roleVal !== "operator"
    const result = await client.query(`
      INSERT INTO users (username, password_hash, role, email, site_id, secondary_site_id, module_permissions, must_change_password)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      RETURNING id, username, role, email, site_id, secondary_site_id, module_permissions, must_change_password
    `, [
      username,
      passwordHash,
      roleVal,
      email || null,
      Number.isInteger(siteIdVal) ? siteIdVal : null,
      Number.isInteger(secondarySiteIdVal) ? secondarySiteIdVal : null,
      permsJson,
      mustChangePassword,
    ]);

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