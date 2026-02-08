import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT id, username, role, email, created_at 
      FROM users 
      ORDER BY created_at DESC
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
    const { username, password, role, email } = await request.json();
    
    const client = await pool.connect();
    
    // Basit şifre hash'i (production'da bcrypt kullan)
    const passwordHash = Buffer.from(password).toString('base64');
    
    const result = await client.query(`
      INSERT INTO users (username, password_hash, role, email)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, role, email
    `, [username, passwordHash, role || 'user', email]);
    
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