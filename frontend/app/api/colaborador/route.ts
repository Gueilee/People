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

      await db.close();
      return NextResponse.json({ colaborador: colab, historico });
    }

    await db.close();
    return NextResponse.json({ erro: 'Informe busca ou id' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 });
  }
}
