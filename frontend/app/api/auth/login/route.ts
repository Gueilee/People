import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'vp_session';
const SESSION_TOKEN  = process.env.SESSION_SECRET ?? 'vp-auth-ok-2025';

const USUARIOS = [
  { login: 'admin', senha: 'vendemmia@2025', nome: 'Administrador' },
];

export async function POST(request: Request) {
  let body: { login?: string; senha?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida' }, { status: 400 });
  }

  const { login, senha } = body;
  const user = USUARIOS.find(u => u.login === login && u.senha === senha);

  if (!user) {
    await new Promise(r => setTimeout(r, 500)); // evita brute-force timing
    return NextResponse.json({ erro: 'Usuário ou senha inválidos' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, SESSION_TOKEN, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 horas
  });

  return NextResponse.json({ ok: true, nome: user.nome });
}
