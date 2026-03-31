import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body || !body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    
    return NextResponse.json({ message: `Successfully created ${body.name}` }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
  }
}