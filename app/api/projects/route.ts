import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT id, name, description, total_piles, status, created_at 
      FROM projects 
      ORDER BY created_at DESC
    `);
    
    client.release();
    
    return NextResponse.json({
      success: true,
      projects: result.rows
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, total_piles, status } = await request.json();
    
    const client = await pool.connect();
    
    const result = await client.query(`
      INSERT INTO projects (name, description, total_piles, status)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, description, total_piles, status
    `, [name, description, total_piles || 0, status || 'active']);
    
    client.release();
    
    return NextResponse.json({
      success: true,
      project: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create project' },
      { status: 500 }
    );
  }
} 