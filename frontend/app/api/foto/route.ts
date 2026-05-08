import { NextRequest, NextResponse } from 'next/server';

let cachedToken = '';
let tokenExpiry = 0;

async function getMsToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        scope:         'https://graph.microsoft.com/.default',
        grant_type:    'client_credentials',
      }),
    }
  );

  const data = await res.json();
  if (!data.access_token) throw new Error('MS token failed');

  cachedToken  = data.access_token as string;
  tokenExpiry  = Date.now() + (Number(data.expires_in) - 120) * 1000;
  return cachedToken;
}

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');

  if (!email || !process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const token = await getMsToken();

    const photoRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/photo/$value`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!photoRes.ok) return new NextResponse(null, { status: 404 });

    const buf = await photoRes.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type':  photoRes.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
