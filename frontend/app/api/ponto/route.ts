import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Filtros com múltipla seleção
  const filtroMeses   = (searchParams.get('mes')    || '').split(',').filter(Boolean);
  const filtroFiliais = (searchParams.get('filial') || '').split(',').filter(Boolean);

  try {
    const db = await getDb();

    // Meses disponíveis (sempre o total histórico)
    const mesesRows = await db.all<{ mes: string }>(
      `SELECT DISTINCT mes FROM ponto_mensal ORDER BY mes DESC`
    );
    const mesesDisponiveis = mesesRows.map(r => r.mes);

    // ── Construção do WHERE ──────────────────────────────────────────────────
    const whereParts: string[] = [];
    const params: string[]     = [];

    if (filtroMeses.length > 0) {
      whereParts.push(`mes IN (${filtroMeses.map(() => '?').join(',')})`);
      params.push(...filtroMeses);
    }
    if (filtroFiliais.length > 0) {
      whereParts.push(`filial IN (${filtroFiliais.map(() => '?').join(',')})`);
      params.push(...filtroFiliais);
    }

    const where = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    // ── KPIs gerais ──────────────────────────────────────────────────────────
    // bancoNegativo = funcionários com saldo ACUMULADO negativo
    const bancoNegRow = await db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM (
         SELECT nome, SUM(banco_horas) AS acum
         FROM ponto_mensal ${where}
         GROUP BY nome
         HAVING acum < 0
       )`,
      params
    );

    const kpiRow = await db.get<any>(
      `SELECT
        COUNT(DISTINCT nome)                               AS total_func,
        SUM(horas_normais)                                 AS horas_normais,
        SUM(extra_50 + extra_60 + extra_100)               AS total_he,
        SUM(extra_50)                                      AS he50,
        SUM(extra_60)                                      AS he60,
        SUM(extra_100)                                     AS he100,
        SUM(falta_injustificada)                           AS total_faltas,
        SUM(atestado)                                      AS total_atestados,
        SUM(falta_injustificada + atestado)                AS total_ausencias,
        SUM(atraso)                                        AS total_atraso,
        SUM(banco_horas)                                   AS saldo_banco,
        SUM(adicional_noturno)                             AS total_noturno,
        SUM(hora_noturna_reduzida)                         AS total_hora_not,
        SUM(dsr)                                           AS total_dsr,
        SUM(abono)                                         AS total_abono,
        SUM(ferias)                                        AS total_ferias,
        SUM(afastamento_nao_rem)                           AS total_afastamento,
        MAX(synced_at)                                     AS synced_at
       FROM ponto_mensal ${where}`,
      params
    );

    const horasEsperadas = (kpiRow?.horas_normais || 0) + (kpiRow?.total_ausencias || 0);
    const taxaAbsenteismo = horasEsperadas > 0
      ? +((kpiRow?.total_ausencias / horasEsperadas) * 100).toFixed(2)
      : 0;

    // ── Por filial ───────────────────────────────────────────────────────────
    const porFilial = await db.all<any>(
      `SELECT
        filial,
        COUNT(DISTINCT nome)                           AS funcionarios,
        SUM(horas_normais)                             AS horas_normais,
        SUM(extra_50 + extra_60 + extra_100)           AS extra_total,
        SUM(extra_50)                                  AS extra_50,
        SUM(extra_60)                                  AS extra_60,
        SUM(extra_100)                                 AS extra_100,
        SUM(falta_injustificada)                       AS faltas,
        SUM(atestado)                                  AS atestados,
        SUM(falta_injustificada + atestado)            AS ausencias,
        SUM(atraso)                                    AS atrasos,
        SUM(banco_horas)                               AS banco_horas,
        SUM(adicional_noturno)                         AS adicional_noturno,
        SUM(hora_noturna_reduzida)                     AS hora_noturna_reduzida,
        SUM(dsr)                                       AS dsr,
        COUNT(CASE WHEN banco_horas < 0 THEN 1 END)    AS banco_negativo
       FROM ponto_mensal ${where}
       GROUP BY filial
       ORDER BY filial`,
      params
    );

    // ── Top faltas (acumulado por colaborador) ───────────────────────────────
    const topFaltas = await db.all<any>(
      `SELECT nome, cargo, filial, departamento,
        SUM(falta_injustificada)                        AS falta_injustificada,
        SUM(atestado)                                   AS atestado,
        SUM(falta_injustificada + atestado)             AS total_ausencia
       FROM ponto_mensal ${where}
       GROUP BY nome, cargo, filial, departamento
       HAVING total_ausencia > 0
       ORDER BY total_ausencia DESC LIMIT 15`,
      params
    );

    // ── Top horas extras (acumulado por colaborador) ─────────────────────────
    const topExtras = await db.all<any>(
      `SELECT nome, cargo, filial, departamento,
        SUM(extra_50)                                   AS extra_50,
        SUM(extra_60)                                   AS extra_60,
        SUM(extra_100)                                  AS extra_100,
        SUM(extra_50 + extra_60 + extra_100)            AS total_he
       FROM ponto_mensal ${where}
       GROUP BY nome, cargo, filial, departamento
       HAVING total_he > 0
       ORDER BY total_he DESC LIMIT 15`,
      params
    );

    // ── Top banco negativo (saldo ACUMULADO por colaborador) ─────────────────
    const topBancoNeg = await db.all<any>(
      `SELECT nome, cargo, filial, SUM(banco_horas) AS banco_horas
       FROM ponto_mensal ${where}
       GROUP BY nome, cargo, filial
       HAVING banco_horas < 0
       ORDER BY banco_horas ASC LIMIT 15`,
      params
    );

    // ── Top banco positivo (saldo ACUMULADO por colaborador) ─────────────────
    const topBancoPos = await db.all<any>(
      `SELECT nome, cargo, filial, SUM(banco_horas) AS banco_horas
       FROM ponto_mensal ${where}
       GROUP BY nome, cargo, filial
       HAVING banco_horas > 0
       ORDER BY banco_horas DESC LIMIT 15`,
      params
    );

    // ── Top atrasos (acumulado por colaborador) ──────────────────────────────
    const topAtrasos = await db.all<any>(
      `SELECT nome, cargo, filial, SUM(atraso) AS atraso
       FROM ponto_mensal ${where}
       GROUP BY nome, cargo, filial
       HAVING atraso > 0
       ORDER BY atraso DESC LIMIT 15`,
      params
    );

    // ── Top noturno (acumulado por colaborador) ──────────────────────────────
    const topNoturno = await db.all<any>(
      `SELECT nome, cargo, filial,
        SUM(adicional_noturno)     AS adicional_noturno,
        SUM(hora_noturna_reduzida) AS hora_noturna_reduzida
       FROM ponto_mensal ${where}
       GROUP BY nome, cargo, filial
       HAVING adicional_noturno > 0
       ORDER BY adicional_noturno DESC LIMIT 10`,
      params
    );

    // ── Distribuição banco de horas (saldo ACUMULADO por colaborador) ─────────
    const distBanco = await db.get<any>(
      `SELECT
        COUNT(CASE WHEN acum < -40                        THEN 1 END) AS critico,
        COUNT(CASE WHEN acum >= -40 AND acum < 0          THEN 1 END) AS negativo,
        COUNT(CASE WHEN acum >= 0   AND acum <= 20        THEN 1 END) AS equilibrado,
        COUNT(CASE WHEN acum > 20   AND acum <= 40        THEN 1 END) AS positivo,
        COUNT(CASE WHEN acum > 40                         THEN 1 END) AS excesso
       FROM (
         SELECT nome, SUM(banco_horas) AS acum
         FROM ponto_mensal ${where}
         GROUP BY nome
       )`,
      params
    );

    // ── Absenteísmo por gestor (cruzamento Convenia) ─────────────────────────
    const absByGestor = await db.all<any>(
      `SELECT c.gestor,
        COUNT(DISTINCT p.nome)                              AS funcionarios,
        ROUND(SUM(p.falta_injustificada + p.atestado), 2)  AS total_ausencia,
        ROUND(AVG(p.falta_injustificada + p.atestado), 2)  AS media_ausencia
       FROM ponto_mensal p
       LEFT JOIN colaboradores c ON UPPER(TRIM(p.nome)) = UPPER(TRIM(c.nome))
       ${where ? where + ' AND' : 'WHERE'} c.gestor IS NOT NULL AND c.gestor != '' AND c.status = 'Ativo'
       GROUP BY c.gestor
       HAVING total_ausencia > 0
       ORDER BY total_ausencia DESC LIMIT 12`,
      params
    );

    // ── Absenteísmo por cargo ────────────────────────────────────────────────
    const absByCargo = await db.all<any>(
      `SELECT cargo,
        COUNT(DISTINCT nome)                              AS funcionarios,
        ROUND(SUM(falta_injustificada + atestado), 2)    AS total_ausencia,
        ROUND(AVG(falta_injustificada + atestado), 2)    AS media_ausencia,
        ROUND(SUM(extra_50 + extra_60 + extra_100), 2)   AS total_he
       FROM ponto_mensal ${where}
       ${where ? 'AND' : 'WHERE'} cargo != ''
       GROUP BY cargo
       ORDER BY total_ausencia DESC LIMIT 12`,
      params
    );

    // ── Tendência histórica — sempre todos os meses, sem filtro de período ───
    const tendencia = await db.all<any>(
      `SELECT mes,
        COUNT(DISTINCT nome)                               AS funcionarios,
        ROUND(SUM(extra_50+extra_60+extra_100), 2)        AS he_total,
        ROUND(SUM(falta_injustificada+atestado), 2)       AS ausencias,
        ROUND(SUM(atraso), 2)                             AS atrasos,
        ROUND(SUM(banco_horas), 2)                        AS saldo_banco
       FROM ponto_mensal
       ${filtroFiliais.length > 0
         ? `WHERE filial IN (${filtroFiliais.map(() => '?').join(',')})`
         : ''}
       GROUP BY mes ORDER BY mes ASC`,
      filtroFiliais.length > 0 ? filtroFiliais : []
    );

    await db.close();

    return NextResponse.json({
      filtroMeses,
      filtroFiliais,
      mesesDisponiveis,
      kpis: {
        totalFuncionarios: kpiRow?.total_func       || 0,
        horasNormais:      +(kpiRow?.horas_normais  || 0).toFixed(1),
        totalHE:           +(kpiRow?.total_he       || 0).toFixed(1),
        he50:              +(kpiRow?.he50           || 0).toFixed(1),
        he60:              +(kpiRow?.he60           || 0).toFixed(1),
        he100:             +(kpiRow?.he100          || 0).toFixed(1),
        totalFaltas:       +(kpiRow?.total_faltas   || 0).toFixed(1),
        totalAtestados:    +(kpiRow?.total_atestados || 0).toFixed(1),
        totalAusencias:    +(kpiRow?.total_ausencias || 0).toFixed(1),
        taxaAbsenteismo,
        totalAtraso:       +(kpiRow?.total_atraso   || 0).toFixed(1),
        saldoBanco:        +(kpiRow?.saldo_banco    || 0).toFixed(1),
        bancoNegativo:     bancoNegRow?.n            || 0,
        totalNoturno:      +(kpiRow?.total_noturno   || 0).toFixed(1),
        totalHoraNot:      +(kpiRow?.total_hora_not || 0).toFixed(1),
        totalDsr:          +(kpiRow?.total_dsr      || 0).toFixed(1),
        totalAbono:        +(kpiRow?.total_abono    || 0).toFixed(1),
        totalFerias:       +(kpiRow?.total_ferias   || 0).toFixed(1),
        totalAfastamento:  +(kpiRow?.total_afastamento || 0).toFixed(1),
        syncedAt:          kpiRow?.synced_at || '',
      },
      porFilial,
      topFaltas,
      topExtras,
      topBancoNeg,
      topBancoPos,
      topAtrasos,
      topNoturno,
      distBanco,
      absByGestor,
      absByCargo,
      tendencia,
    });
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 });
  }
}
