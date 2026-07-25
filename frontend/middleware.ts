import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'vp_session';
const SESSION_TOKEN  = process.env.SESSION_SECRET ?? 'vp-auth-ok-2025';

export function middleware(request: NextRequest) {
  const session  = request.cookies.get(SESSION_COOKIE)?.value;
  const role     = request.cookies.get('vp_role')?.value;
  const { pathname } = request.nextUrl;

  const isProtected = pathname.startsWith('/dashboard')
    || pathname.startsWith('/carreira')
    || pathname.startsWith('/colaborador')
    || pathname.startsWith('/ponto')
    || pathname.startsWith('/configuracoes')
    || pathname.startsWith('/recrutamento')
    || pathname.startsWith('/solicitar-vaga');
  const isLogin      = pathname === '/login';
  const isPublicAuth = pathname.startsWith('/recuperar-senha') || pathname.startsWith('/definir-senha');

  if (isPublicAuth) return NextResponse.next();

  if (isProtected && session !== SESSION_TOKEN) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Requisitante só pode acessar /solicitar-vaga
  if (session === SESSION_TOKEN && role === 'requisitante' && !pathname.startsWith('/solicitar-vaga')) {
    const url = request.nextUrl.clone();
    url.pathname = '/solicitar-vaga';
    return NextResponse.redirect(url);
  }

  if (isLogin && session === SESSION_TOKEN) {
    const url = request.nextUrl.clone();
    url.pathname = role === 'requisitante' ? '/solicitar-vaga' : '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/carreira/:path*',
    '/colaborador/:path*',
    '/ponto/:path*',
    '/configuracoes/:path*',
    '/configuracoes',
    '/recrutamento/:path*',
    '/recrutamento',
    '/solicitar-vaga',
    '/login',
    '/recuperar-senha',
    '/definir-senha',
  ],
};
