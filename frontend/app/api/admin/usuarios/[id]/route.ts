import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { findById, findByIdAdmin, deactivateUser, deleteUser, reactivateUser, generateToken, setResetToken } from '@/lib/users';
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

// Hard delete — remove permanently from DB
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });

  const { id } = await params;
  const targetId = parseInt(id);
  if (targetId === admin.id) return NextResponse.json({ erro: 'Não é possível excluir seu próprio usuário' }, { status: 400 });

  await deleteUser(targetId);
  return NextResponse.json({ ok: true });
}

// Resend invite
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

// PATCH: acao = "reativar" | "desativar"
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });

  const { id } = await params;
  const targetId = parseInt(id);

  let acao = 'reativar';
  try {
    const body = await req.json();
    if (body.acao) acao = body.acao;
  } catch { /* sem body = reativar */ }

  if (acao === 'desativar') {
    if (targetId === admin.id) return NextResponse.json({ erro: 'Não é possível desativar seu próprio usuário' }, { status: 400 });
    await deactivateUser(targetId);
    return NextResponse.json({ ok: true });
  }

  // reativar
  const user = await findByIdAdmin(targetId);
  if (!user) return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 404 });

  await reactivateUser(user.id);

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
