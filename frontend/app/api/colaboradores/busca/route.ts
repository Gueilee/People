import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const TENANT_ID     = process.env.MS_TENANT_ID     || '';
const CLIENT_ID     = process.env.MS_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET || '';

// Cache do token para não buscar a cada request (tokens duram ~1h)
let _tokenCache: { value: string; expiresAt: number } | null = null;

async function getGraphToken(): Promise<string> {
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 60_000) {
    return _tokenCache.value;
  }
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope:         'https://graph.microsoft.com/.default',
      }),
    }
  );
  if (!res.ok) throw new Error(`Token MS: ${res.status} ${await res.text()}`);
  const data = await res.json();
  _tokenCache = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return _tokenCache.value;
}

async function buscaViaGraph(q: string) {
  const token = await getGraphToken();
  // $search requer ConsistencyLevel: eventual e aceita busca parcial em qualquer posição
  const url = `https://graph.microsoft.com/v1.0/users`
    + `?$search="displayName:${q.replace(/"/g, '')}"`
    + `&$select=displayName,mail,jobTitle,department`
    + `&$top=8`
    + `&$orderby=displayName`
    + `&$count=true`;

  const res = await fetch(url, {
    headers: {
      Authorization:    `Bearer ${token}`,
      ConsistencyLevel: 'eventual',
    },
  });
  if (!res.ok) throw new Error(`Graph: ${res.status} ${await res.text()}`);
  const data = await res.json();

  return (data.value as Array<{ displayName: string; mail: string | null; jobTitle: string | null; department: string | null }>)
    .filter(u => u.mail)
    .map(u => ({
      nome:    u.displayName,
      email:   u.mail,
      cargo:   u.jobTitle   || null,
      unidade: u.department || null,
    }));
}

async function buscaViaDb(q: string) {
  const db   = await getDb();
  const rows = await db.all<{ nome: string; email: string | null; cargo: string | null; unidade: string | null }>(
    `SELECT nome, email, cargo, unidade FROM colaboradores
     WHERE status = 'Ativo' AND nome ILIKE $1
     ORDER BY nome LIMIT 8`,
    [`%${q}%`]
  );
  return rows;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    if (q.length < 2) return NextResponse.json([]);

    // Usa Microsoft Graph se as credenciais estiverem configuradas; senão usa o banco
    const results = (TENANT_ID && CLIENT_ID && CLIENT_SECRET)
      ? await buscaViaGraph(q)
      : await buscaViaDb(q);

    return NextResponse.json(results);
  } catch (err) {
    console.error('[colaboradores/busca]', err);
    // Se o Graph falhar por qualquer motivo, cai de volta no banco
    try {
      const { searchParams } = new URL(request.url);
      const q = (searchParams.get('q') || '').trim();
      const rows = await buscaViaDb(q);
      return NextResponse.json(rows);
    } catch {
      return NextResponse.json([], { status: 500 });
    }
  }
}
