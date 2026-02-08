import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = parseInt(params.id);
    const { projects } = await request.json();
    
    const client = await pool.connect();
    
    // Önce mevcut proje atamalarını sil
    await client.query(
      'DELETE FROM user_projects WHERE user_id = $1',
      [userId]
    );
    
    // Yeni proje atamalarını ekle
    if (projects && projects.length > 0) {
      const values = projects.map((projectId: number) => 
        `(${userId}, ${projectId})`
      ).join(', ');
      
      await client.query(`
        INSERT INTO user_projects (user_id, project_id)
        VALUES ${values}
      `);
    }
    
    client.release();
    
    return NextResponse.json({
      success: true,
      message: 'User projects updated successfully'
    });
  } catch (error) {
    console.error('Error updating user projects:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user projects' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = parseInt(params.id);
    
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT p.id, p.name, p.description, p.total_piles, p.status
      FROM user_projects up
      JOIN projects p ON up.project_id = p.id
      WHERE up.user_id = $1
      ORDER BY p.name
    `, [userId]);
    
    client.release();
    
    return NextResponse.json({
      success: true,
      projects: result.rows
    });
  } catch (error) {
    console.error('Error fetching user projects:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user projects' },
      { status: 500 }
    );
  }
} 