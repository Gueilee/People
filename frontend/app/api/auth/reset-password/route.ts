import { NextResponse } from 'next/server';
import { findByToken, setPassword } from '@/lib/users';

export async function POST(request: Request) {
  let body: { token?: string; senha?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ erro: 'Requisição inválida' }, { status: 400 });
  }

  const { token, senha } = body;
  if (!token || !senha) return NextResponse.json({ erro: 'Dados obrigatórios' }, { status: 400 });
  if (senha.length < 6) return NextResponse.json({ erro: 'A senha deve ter ao menos 6 caracteres' }, { status: 400 });

  const user = await findByToken(token);
  if (!user) return NextResponse.json({ erro: 'Link inválido ou expirado' }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  if (user.reset_expiry < now) {
    return NextResponse.json({ erro: 'Este link expirou. Solicite um novo.' }, { status: 400 });
  }

  await setPassword(user.id, senha);
  return NextResponse.json({ ok: true, mensagem: 'Senha definida com sucesso!', login: user.login });
}
