import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('vp_session');
  cookieStore.delete('vp_uid');
  cookieStore.delete('vp_role');
  return NextResponse.json({ ok: true });
}
