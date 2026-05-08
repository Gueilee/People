import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

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
      const diretos = await db.all(
        `SELECT id_colaborador, nome, cargo, departamento, unidade, status
         FROM colaboradores WHERE gestor = ? ORDER BY cargo, nome`,
        [colab.nome as string]
      );
      const totalDiretos = diretos.length;

      // Gestor do colaborador (busca por nome)
      const gestorInfo = colab.gestor ? await db.get(
        `SELECT id_colaborador, nome, cargo, departamento, unidade, status, gestor
         FROM colaboradores WHERE nome = ? LIMIT 1`,
        [colab.gestor as string]
      ) ?? null : null;

      // Gestor do gestor
      const gestorDoGestor = (gestorInfo as any)?.gestor ? await db.get(
        `SELECT id_colaborador, nome, cargo, unidade, status
         FROM colaboradores WHERE nome = ? LIMIT 1`,
        [(gestorInfo as any).gestor as string]
      ) ?? null : null;

      // Colegas de equipe (mesmo gestor)
      const irmaos = colab.gestor ? await db.all(
        `SELECT id_colaborador, nome, cargo, unidade, status
         FROM colaboradores WHERE gestor = ? AND nome != ? AND status = 'Ativo'
         ORDER BY cargo, nome LIMIT 8`,
        [colab.gestor as string, colab.nome as string]
      ) : [];

      await db.close();
      return NextResponse.json({
        colaborador: colab,
        historico,
        organograma: { diretos: diretos.slice(0, 8), totalDiretos, gestorInfo, gestorDoGestor, irmaos },
      });
    }

    await db.close();
    return NextResponse.json({ erro: 'Informe busca ou id' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 });
  }
}
