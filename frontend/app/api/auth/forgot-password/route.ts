import { NextResponse } from 'next/server';
import { findByEmail, setResetToken, generateToken } from '@/lib/users';
import { sendResetEmail } from '@/lib/mailer';

export async function POST(request: Request) {
  let body: { email?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ erro: 'Requisição inválida' }, { status: 400 });
  }

  const { email } = body;
  if (!email) return NextResponse.json({ erro: 'E-mail obrigatório' }, { status: 400 });

  // Responde igual independente de encontrar ou não (evita enumerar usuários)
  const user = await findByEmail(email);
  if (user) {
    const token = generateToken();
    await setResetToken(user.id, token, 3600); // 1 hora
    try {
      await sendResetEmail(user.email!, user.nome, token);
    } catch (err) {
      console.error('Erro ao enviar email de recuperação:', err);
    }
  }

  return NextResponse.json({ ok: true, mensagem: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.' });
}
