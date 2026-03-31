import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // 1. Reading headers directly from the NextRequest object
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Reading cookies using the Next.js async cookies() utility
    const cookieStore = await cookies();
    const themeCookie = cookieStore.get('theme')?.value || 'light';

    return NextResponse.json({ theme: themeCookie, message: 'Success' }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}