import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { findById, findByIdAdmin, deleteUser, reactivateUser, generateToken, setResetToken } from '@/lib/users';
import { sendInviteEmail } from '@/lib/mailer';

const SESSION_TOKEN = process.env.SESSION_SECRET ?? 'vp-auth-ok-2025';

async function requireAdmin() {
  const cookieStore = await cookies();
  if (cookieStore.get('vp_session')?.value !== SESSION_TOKEN) return null;
  const uid = cookieStore.get('vp_uid')?.value;
  if (!uid) return null;
  const user = await findById(parseInt(uid));
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });

  const { id } = await params;
  const targetId = parseInt(id);
  if (targetId === admin.id) return NextResponse.json({ erro: 'Não é possível remover seu próprio usuário' }, { status: 400 });

  await deleteUser(targetId);
  return NextResponse.json({ ok: true });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });

  const { id } = await params;
  const user = await findById(parseInt(id));
  if (!user || !user.email) return NextResponse.json({ erro: 'Usuário não encontrado ou sem e-mail' }, { status: 404 });

  const token = generateToken();
  await setResetToken(user.id, token, 7 * 24 * 3600);
  try {
    await sendInviteEmail(user.email, user.nome, token);
  } catch (err) {
    return NextResponse.json({ erro: `Erro ao enviar e-mail: ${err}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });

  const { id } = await params;
  const user = await findByIdAdmin(parseInt(id));
  if (!user) return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 404 });

  await reactivateUser(user.id);

  // Se ainda não tem senha, envia novo convite junto com a reativação
  if (!user.tem_senha && user.email) {
    const token = generateToken();
    await setResetToken(user.id, token, 7 * 24 * 3600);
    try {
      await sendInviteEmail(user.email, user.nome, token);
    } catch (err) {
      console.error('Erro ao enviar convite na reativação:', err);
    }
    return NextResponse.json({ ok: true, convite_enviado: true });
  }

  return NextResponse.json({ ok: true, convite_enviado: false });
}
