import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { findById } from '@/lib/users';

const SESSION_TOKEN = process.env.SESSION_SECRET ?? 'vp-auth-ok-2025';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('vp_session')?.value;
  if (session !== SESSION_TOKEN) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
  }

  const uid = cookieStore.get('vp_uid')?.value;
  if (!uid) return NextResponse.json({ erro: 'Sessão inválida' }, { status: 401 });

  const user = await findById(parseInt(uid));
  if (!user) return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 401 });

  return NextResponse.json({ id: user.id, nome: user.nome, email: user.email, login: user.login, role: user.role });
}
