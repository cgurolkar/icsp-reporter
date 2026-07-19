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
    const { role, siteId, secondarySiteId, modulePermissions, personelId, password, email, username } = body;
    const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'user', 'personel', 'operator', 'engineer'];
    const requestedRole = role !== undefined && ALLOWED_ROLES.includes(role) ? role : undefined;
    const roleVal = requestedRole === 'super_admin' && session.role !== 'super_admin' ? 'admin' : requestedRole;
    const usernameVal =
      username !== undefined ? String(username).trim() : undefined;
    if (usernameVal !== undefined && (usernameVal.length < 2 || usernameVal.length > 100)) {
      return NextResponse.json(
        { success: false, error: 'Kullanıcı adı 2–100 karakter olmalıdır.' },
        { status: 400 }
      );
    }

    const siteIdNum =
      siteId !== undefined && siteId != null && siteId !== ''
        ? typeof siteId === 'number'
          ? siteId
          : parseInt(String(siteId), 10)
        : siteId === null || siteId === ''
          ? null
          : undefined;
    const secondarySiteIdNum =
      secondarySiteId !== undefined && secondarySiteId != null && secondarySiteId !== ''
        ? typeof secondarySiteId === 'number'
          ? secondarySiteId
          : parseInt(String(secondarySiteId), 10)
        : secondarySiteId === null || secondarySiteId === ''
          ? null
          : undefined;
    if (
      siteIdNum !== undefined &&
      secondarySiteIdNum !== undefined &&
      siteIdNum != null &&
      secondarySiteIdNum != null &&
      siteIdNum === secondarySiteIdNum
    ) {
      return NextResponse.json({ success: false, error: 'İkinci şantiye birinciden farklı olmalıdır.' }, { status: 400 });
    }

    const client = await pool.connect();

    if (usernameVal !== undefined) {
      const taken = await client.query(
        `SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2 LIMIT 1`,
        [usernameVal, userId]
      );
      if (taken.rows.length > 0) {
        client.release();
        return NextResponse.json(
          { success: false, error: 'Bu kullanıcı adı zaten kullanılıyor.' },
          { status: 400 }
        );
      }
    }

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: (string | number | null | boolean)[] = [];
    let i = 1;
    if (usernameVal !== undefined) {
      updates.push(`username = $${i++}`);
      values.push(usernameVal);
    }
    if (roleVal !== undefined) {
      updates.push(`role = $${i++}`);
      values.push(roleVal);
    }
    if (siteId !== undefined) {
      updates.push(`site_id = $${i++}`);
      values.push(siteId != null && siteId !== '' ? (typeof siteId === 'number' ? siteId : parseInt(String(siteId), 10)) : null);
    }
    if (secondarySiteId !== undefined) {
      updates.push(`secondary_site_id = $${i++}`);
      values.push(
        secondarySiteId != null && secondarySiteId !== ''
          ? typeof secondarySiteId === 'number'
            ? secondarySiteId
            : parseInt(String(secondarySiteId), 10)
          : null
      );
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
      RETURNING id, username, role, email, site_id, secondary_site_id, module_permissions
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
      await client.query('BEGIN');

      const target = await client.query(`SELECT id, role, username FROM users WHERE id = $1`, [userId]);
      if (target.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, error: 'Kullanıcı bulunamadı.' }, { status: 404 });
      }

      // Son super_admin silinmesin
      if (target.rows[0].role === 'super_admin') {
        const saCount = await client.query(
          `SELECT COUNT(*)::int AS c FROM users WHERE role = 'super_admin'`
        );
        if ((saCount.rows[0]?.c ?? 0) <= 1) {
          await client.query('ROLLBACK');
          return NextResponse.json(
            { success: false, error: 'Son super admin hesabı silinemez.' },
            { status: 400 }
          );
        }
      }

      // FK’ler ON DELETE SET NULL/CASCADE olmayan tablolar: önce bağlantıyı kopar
      // (aksi halde rapor/harcama/puantaj oluşturmuş kullanıcılar silinemez)
      await client.query(`UPDATE personeller SET user_id = NULL WHERE user_id = $1`, [userId]);
      await client.query(`UPDATE islemler SET olusturan_id = NULL WHERE olusturan_id = $1`, [userId]);
      await client.query(`UPDATE puantaj SET olusturan_id = NULL WHERE olusturan_id = $1`, [userId]);
      await client.query(`UPDATE puantaj SET onaylayan_id = NULL WHERE onaylayan_id = $1`, [userId]);
      await client.query(`UPDATE envanter_hareket SET olusturan_id = NULL WHERE olusturan_id = $1`, [userId]);
      await client.query(`UPDATE personel_izin SET olusturan_id = NULL WHERE olusturan_id = $1`, [userId]);
      await client.query(`UPDATE work_reports SET submitted_by_user_id = NULL WHERE submitted_by_user_id = $1`, [userId]);

      const del = await client.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [userId]);
      if (del.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, error: 'Kullanıcı bulunamadı.' }, { status: 404 });
      }

      await client.query('COMMIT');
    } catch (inner) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      throw inner;
    } finally {
      client.release();
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const e = error as { code?: string; constraint?: string; detail?: string; message?: string };
    console.error('Error deleting user:', error);
    // PostgreSQL foreign_key_violation
    if (e.code === '23503') {
      return NextResponse.json(
        {
          success: false,
          error: 'Bu kullanıcıya bağlı kayıtlar olduğu için silinemedi. Bağlı kayıtlar temizlendikten sonra tekrar deneyin.',
          detail: e.detail || e.constraint || e.message,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Kullanıcı silinemedi.',
        detail: e.message || String(error),
      },
      { status: 500 }
    );
  }
} 