import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db';

function gravatarHash(email: string | null | undefined): string {
  return crypto.createHash('md5').update((email || '').toLowerCase().trim()).digest('hex');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const busca = searchParams.get('busca');
  const id    = searchParams.get('id');

  try {
    const db = await getDb();

    if (busca) {
      const rows = await db.all(
        `SELECT id_colaborador, nome, cargo, unidade, departamento, status
         FROM colaboradores
         WHERE nome LIKE ?
         ORDER BY nome ASC
         LIMIT 12`,
        [`%${busca}%`]
      );
      await db.close();
      return NextResponse.json(rows);
    }

    if (id) {
      const colab = await db.get(
        `SELECT * FROM colaboradores WHERE id_colaborador = ?`,
        [id]
      );
      if (!colab) {
        await db.close();
        return NextResponse.json({ erro: 'Colaborador não encontrado' }, { status: 404 });
      }

      const historico = await db.all(
        `SELECT * FROM historico_cargo_salario
         WHERE nome = ?
         ORDER BY COALESCE(data_inicio, '0000-00-00') ASC`,
        [colab.nome as string]
      );

      // Organograma: subordinados diretos
      const diretosRaw = await db.all(
        `SELECT id_colaborador, nome, cargo, departamento, unidade, status, email
         FROM colaboradores WHERE gestor = ? ORDER BY cargo, nome`,
        [colab.nome as string]
      );
      const diretos = diretosRaw.map((d: any) => ({ ...d, gravatar_hash: gravatarHash(d.email) }));
      const totalDiretos = diretos.length;

      // Gestor do colaborador (busca por nome)
      const gestorRaw = colab.gestor ? await db.get(
        `SELECT id_colaborador, nome, cargo, departamento, unidade, status, gestor, email
         FROM colaboradores WHERE nome = ? LIMIT 1`,
        [colab.gestor as string]
      ) ?? null : null;
      const gestorInfo = gestorRaw ? { ...(gestorRaw as any), gravatar_hash: gravatarHash((gestorRaw as any).email) } : null;

      // Gestor do gestor
      const gestorDoGestorRaw = (gestorInfo as any)?.gestor ? await db.get(
        `SELECT id_colaborador, nome, cargo, unidade, status, email
         FROM colaboradores WHERE nome = ? LIMIT 1`,
        [(gestorInfo as any).gestor as string]
      ) ?? null : null;
      const gestorDoGestor = gestorDoGestorRaw ? { ...(gestorDoGestorRaw as any), gravatar_hash: gravatarHash((gestorDoGestorRaw as any).email) } : null;

      // Colegas de equipe (mesmo gestor)
      const irmaoRaw = colab.gestor ? await db.all(
        `SELECT id_colaborador, nome, cargo, unidade, status, email
         FROM colaboradores WHERE gestor = ? AND nome != ? AND status = 'Ativo'
         ORDER BY cargo, nome LIMIT 8`,
        [colab.gestor as string, colab.nome as string]
      ) : [];
      const irmaos = irmaoRaw.map((d: any) => ({ ...d, gravatar_hash: gravatarHash(d.email) }));

      // Histórico de ponto (TiqueTaque) — join por nome
      const ponto = await db.all(
        `SELECT mes, horas_normais, total, banco_horas,
                extra_50, extra_60, extra_100,
                atraso, falta_injustificada, atestado, abono,
                ferias, afastamento_nao_rem, adicional_noturno,
                hora_noturna_reduzida, dsr, dispensa_legal, synced_at
         FROM ponto_mensal
         WHERE UPPER(TRIM(nome)) = UPPER(TRIM(?))
         ORDER BY mes DESC`,
        [colab.nome as string]
      );

      await db.close();
      return NextResponse.json({
        colaborador: { ...(colab as any), gravatar_hash: gravatarHash((colab as any).email) },
        historico,
        organograma: { diretos: diretos.slice(0, 8), totalDiretos, gestorInfo, gestorDoGestor, irmaos },
        ponto,
      });
    }

    await db.close();
    return NextResponse.json({ erro: 'Informe busca ou id' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 });
  }
}
