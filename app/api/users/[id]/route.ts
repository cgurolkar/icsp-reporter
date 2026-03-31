import { NextRequest, NextResponse } from 'next/server';
import pool, { initializeDatabase } from '@/lib/database';
import { getSessionFromRequest, hashPassword } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromRequest(request);
  if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 403 });
  }
  try {
    await initializeDatabase();
    const userId = parseInt(params.id);
    const body = await request.json();
    const { role, siteId, modulePermissions, personelId, password, email } = body;
    const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'user', 'personel', 'operator'];
    const requestedRole = role !== undefined && ALLOWED_ROLES.includes(role) ? role : undefined;
    const roleVal = requestedRole === 'super_admin' && session.role !== 'super_admin' ? 'admin' : requestedRole;

    const client = await pool.connect();

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: (string | number | null | boolean)[] = [];
    let i = 1;
    if (roleVal !== undefined) {
      updates.push(`role = $${i++}`);
      values.push(roleVal);
    }
    if (siteId !== undefined) {
      updates.push(`site_id = $${i++}`);
      values.push(siteId != null && siteId !== '' ? (typeof siteId === 'number' ? siteId : parseInt(String(siteId), 10)) : null);
    }
    if (modulePermissions !== undefined && typeof modulePermissions === 'object') {
      updates.push(`module_permissions = $${i++}::jsonb`);
      values.push(JSON.stringify(modulePermissions));
    }
    if (email !== undefined) {
      updates.push(`email = $${i++}`);
      values.push(email != null && String(email).trim() ? String(email).trim() : null);
    }
    if (password !== undefined && typeof password === 'string' && password.length >= 6) {
      updates.push(`password_hash = $${i++}`);
      values.push(await hashPassword(password));
      updates.push(`must_change_password = true`);
    }
    values.push(userId);
    const result = await client.query(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${i}
      RETURNING id, username, role, email, site_id, module_permissions
    `, values);

    if (Object.prototype.hasOwnProperty.call(body, 'personelId')) {
      const pid = personelId != null && personelId !== '' ? parseInt(String(personelId), 10) : NaN;
      await client.query(`UPDATE personeller SET user_id = NULL WHERE user_id = $1`, [userId]);
      if (!Number.isNaN(pid) && pid > 0) {
        await client.query(`UPDATE personeller SET user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [userId, pid]);
      }
    }

    client.release();
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromRequest(request);
  if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 403 });
  }
  const userId = parseInt(params.id, 10);
  if (Number.isNaN(userId) || userId === session.id) {
    return NextResponse.json({ success: false, error: 'Geçersiz veya kendi hesabınız silinemez' }, { status: 400 });
  }
  try {
    await initializeDatabase();
    const client = await pool.connect();
    try {
      await client.query(`UPDATE personeller SET user_id = NULL WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    } finally {
      client.release();
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 });
  }
} 