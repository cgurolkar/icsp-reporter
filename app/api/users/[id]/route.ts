import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database';
import { getSessionFromRequest } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 403 });
  }
  try {
    const userId = parseInt(params.id);
    const { role, siteId } = await request.json();
    const ALLOWED_ROLES = ['admin', 'manager', 'user', 'personel'];
    const roleVal = role !== undefined && ALLOWED_ROLES.includes(role) ? role : undefined;

    const client = await pool.connect();

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: (string | number | null)[] = [];
    let i = 1;
    if (roleVal !== undefined) {
      updates.push(`role = $${i++}`);
      values.push(roleVal);
    }
    if (siteId !== undefined) {
      updates.push(`site_id = $${i++}`);
      values.push(siteId != null && siteId !== '' ? (typeof siteId === 'number' ? siteId : parseInt(String(siteId), 10)) : null);
    }
    values.push(userId);
    const result = await client.query(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${i}
      RETURNING id, username, role, email, site_id
    `, values);
    
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