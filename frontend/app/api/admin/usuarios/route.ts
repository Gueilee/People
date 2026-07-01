import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { listUsers, createUser, findById, generateToken, setResetToken } from '@/lib/users';
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

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });
  const users = await listUsers();
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });

  let body: { nome?: string; email?: string; login?: string; role?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 });
  }

  const { nome, email, login, role } = body;
  if (!nome || !email || !login) {
    return NextResponse.json({ erro: 'Nome, e-mail e login são obrigatórios' }, { status: 400 });
  }
  if (!['admin', 'viewer'].includes(role || '')) {
    return NextResponse.json({ erro: 'Perfil inválido' }, { status: 400 });
  }

  try {
    const id = await createUser(nome, email, login, (role as 'admin' | 'viewer'));
    const token = generateToken();
    await setResetToken(id, token, 7 * 24 * 3600); // 7 dias para convite
    try {
      await sendInviteEmail(email, nome, token, login);
    } catch (err) {
      console.error('Erro ao enviar convite:', err);
    }
    return NextResponse.json({ ok: true, id });
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes('UNIQUE')) return NextResponse.json({ erro: 'Login ou e-mail já em uso' }, { status: 409 });
    return NextResponse.json({ erro: 'Erro ao criar usuário' }, { status: 500 });
  }
}
