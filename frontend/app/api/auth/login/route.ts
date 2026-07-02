import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ensureUsersTable, findByLogin, findByEmail, verifyPassword } from '@/lib/users';

const SESSION_COOKIE = 'vp_session';
const SESSION_TOKEN  = process.env.SESSION_SECRET ?? 'vp-auth-ok-2025';

export async function POST(request: Request) {
  let body: { login?: string; senha?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida' }, { status: 400 });
  }

  const { login, senha } = body;
  if (!login || !senha) {
    return NextResponse.json({ erro: 'Usuário ou senha inválidos' }, { status: 401 });
  }

  await ensureUsersTable();

  // Tenta por email primeiro; fallback por login (para conta admin sem email)
  const user = (await findByEmail(login)) ?? (await findByLogin(login));

  if (!user || !user.senha_hash || !verifyPassword(senha, user.senha_hash)) {
    await new Promise(r => setTimeout(r, 500));
    return NextResponse.json({ erro: 'Usuário ou senha inválidos' }, { status: 401 });
  }

  const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 8 };
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, SESSION_TOKEN, cookieOpts);
  cookieStore.set('vp_uid', String(user.id), cookieOpts);
  cookieStore.set('vp_role', user.role, cookieOpts);

  return NextResponse.json({ ok: true, nome: user.nome });
}
