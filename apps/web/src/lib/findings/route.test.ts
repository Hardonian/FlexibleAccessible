import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

describe('API Route: POST /api/example-post', () => {
  it('should process a valid JSON body and return 201', async () => {
    // 1. Construct the NextRequest with POST method and stringified JSON body
    const request = new NextRequest('http://localhost:3000/api/example-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Aros Administrator' }),
    });

    // 2. Execute the handler
    const response = await POST(request);
    const data = await response.json();

    // 3. Assert on the results
    expect(response.status).toBe(201);
    expect(data).toEqual({ message: 'Successfully created Aros Administrator' });
  });

  it('should return 400 Bad Request if the name field is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/example-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Missing the name field' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Name is required' });
  });
});