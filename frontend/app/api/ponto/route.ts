import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const filtroMeses    = (searchParams.get('mes')     || '').split(',').filter(Boolean);
  const filtroUnidades = (searchParams.get('unidade') || '').split(',').filter(Boolean);
  const filtroAreas    = (searchParams.get('area')    || '').split(',').filter(Boolean);
  const filtroGestores = (searchParams.get('gestor')  || '').split(',').filter(Boolean);
  const filtroPeriodo  = parseInt(searchParams.get('meses') || '0', 10);

  try {
    const db = await getDb();

    // ── Opções de filtro (sempre do total histórico) ──────────────────────────
    const mesesRows = await db.all<{ mes: string }>(
      `SELECT DISTINCT mes FROM ponto_mensal ORDER BY mes DESC`
    );
    const unidadesRows = await db.all<{ filial: string }>(
      `SELECT DISTINCT filial FROM ponto_mensal WHERE filial IS NOT NULL AND filial != '' ORDER BY filial`
    );
    const areasRows = await db.all<{ area: string }>(
      `SELECT DISTINCT c.area FROM colaboradores c
       INNER JOIN ponto_mensal p ON UPPER(TRIM(p.nome)) = UPPER(TRIM(c.nome))
       WHERE c.area IS NOT NULL AND c.area != '' ORDER BY c.area`
    );
    const gestoresRows = await db.all<{ gestor: string }>(
      `SELECT DISTINCT c.gestor FROM colaboradores c
       INNER JOIN ponto_mensal p ON UPPER(TRIM(p.nome)) = UPPER(TRIM(c.nome))
       WHERE c.gestor IS NOT NULL AND c.gestor != '' ORDER BY c.gestor`
    );

    // ── Construção do WHERE ──────────────────────────────────────────────────
    const whereParts: string[] = [];
    const params: (string | number)[] = [];

    if (filtroMeses.length > 0) {
      whereParts.push(`mes IN (${filtroMeses.map(() => '?').join(',')})`);
      params.push(...filtroMeses);
    } else if (filtroPeriodo > 0) {
      whereParts.push(`mes >= strftime('%Y-%m', date('now', '-' || CAST(? AS TEXT) || ' months'))`);
      params.push(filtroPeriodo);
    }
    if (filtroUnidades.length > 0) {
      whereParts.push(`filial IN (${filtroUnidades.map(() => '?').join(',')})`);
      params.push(...filtroUnidades);
    }
    if (filtroAreas.length > 0) {
      whereParts.push(`nome IN (SELECT nome FROM colaboradores WHERE area IN (${filtroAreas.map(() => '?').join(',')}))`);
      params.push(...filtroAreas);
    }
    if (filtroGestores.length > 0) {
      whereParts.push(`nome IN (SELECT nome FROM colaboradores WHERE gestor IN (${filtroGestores.map(() => '?').join(',')}))`);
      params.push(...filtroGestores);
    }

    const where = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    // ── WHERE para tendência (sem filtro de mês, mantém série histórica) ─────
    const whereTendParts: string[] = [];
    const whereTendParams: (string | number)[] = [];
    if (filtroUnidades.length > 0) {
      whereTendParts.push(`filial IN (${filtroUnidades.map(() => '?').join(',')})`);
      whereTendParams.push(...filtroUnidades);
    }
    if (filtroAreas.length > 0) {
      whereTendParts.push(`nome IN (SELECT nome FROM colaboradores WHERE area IN (${filtroAreas.map(() => '?').join(',')}))`);
      whereTendParams.push(...filtroAreas);
    }
    if (filtroGestores.length > 0) {
      whereTendParts.push(`nome IN (SELECT nome FROM colaboradores WHERE gestor IN (${filtroGestores.map(() => '?').join(',')}))`);
      whereTendParams.push(...filtroGestores);
    }
    const whereTend = whereTendParts.length > 0 ? `WHERE ${whereTendParts.join(' AND ')}` : '';

    // ── WHERE para absByGestor (JOIN com colaboradores) ───────────────────────
    const whereJoinParts: string[] = [
      `c.gestor IS NOT NULL`, `c.gestor != ''`, `c.status = 'Ativo'`
    ];
    const whereJoinParams: (string | number)[] = [];
    if (filtroMeses.length > 0) {
      whereJoinParts.push(`p.mes IN (${filtroMeses.map(() => '?').join(',')})`);
      whereJoinParams.push(...filtroMeses);
    } else if (filtroPeriodo > 0) {
      whereJoinParts.push(`p.mes >= strftime('%Y-%m', date('now', '-' || CAST(? AS TEXT) || ' months'))`);
      whereJoinParams.push(filtroPeriodo);
    }
    if (filtroUnidades.length > 0) {
      whereJoinParts.push(`p.filial IN (${filtroUnidades.map(() => '?').join(',')})`);
      whereJoinParams.push(...filtroUnidades);
    }
    if (filtroAreas.length > 0) {
      whereJoinParts.push(`c.area IN (${filtroAreas.map(() => '?').join(',')})`);
      whereJoinParams.push(...filtroAreas);
    }
    if (filtroGestores.length > 0) {
      whereJoinParts.push(`c.gestor IN (${filtroGestores.map(() => '?').join(',')})`);
      whereJoinParams.push(...filtroGestores);
    }
    const whereJoin = `WHERE ${whereJoinParts.join(' AND ')}`;

    // ── KPIs gerais ──────────────────────────────────────────────────────────
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

    // ── Top faltas ───────────────────────────────────────────────────────────
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

    // ── Top horas extras ─────────────────────────────────────────────────────
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

    // ── Top banco negativo ───────────────────────────────────────────────────
    const topBancoNeg = await db.all<any>(
      `SELECT nome, cargo, filial, SUM(banco_horas) AS banco_horas
       FROM ponto_mensal ${where}
       GROUP BY nome, cargo, filial
       HAVING banco_horas < 0
       ORDER BY banco_horas ASC LIMIT 15`,
      params
    );

    // ── Top banco positivo ───────────────────────────────────────────────────
    const topBancoPos = await db.all<any>(
      `SELECT nome, cargo, filial, SUM(banco_horas) AS banco_horas
       FROM ponto_mensal ${where}
       GROUP BY nome, cargo, filial
       HAVING banco_horas > 0
       ORDER BY banco_horas DESC LIMIT 15`,
      params
    );

    // ── Top atrasos ──────────────────────────────────────────────────────────
    const topAtrasos = await db.all<any>(
      `SELECT nome, cargo, filial, SUM(atraso) AS atraso
       FROM ponto_mensal ${where}
       GROUP BY nome, cargo, filial
       HAVING atraso > 0
       ORDER BY atraso DESC LIMIT 15`,
      params
    );

    // ── Top noturno ──────────────────────────────────────────────────────────
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

    // ── Distribuição banco de horas ──────────────────────────────────────────
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

    // ── Absenteísmo por gestor ───────────────────────────────────────────────
    const absByGestor = await db.all<any>(
      `SELECT c.gestor,
        COUNT(DISTINCT p.nome)                              AS funcionarios,
        ROUND(SUM(p.falta_injustificada + p.atestado), 2)  AS total_ausencia,
        ROUND(AVG(p.falta_injustificada + p.atestado), 2)  AS media_ausencia
       FROM ponto_mensal p
       LEFT JOIN colaboradores c ON UPPER(TRIM(p.nome)) = UPPER(TRIM(c.nome))
       ${whereJoin}
       GROUP BY c.gestor
       HAVING total_ausencia > 0
       ORDER BY total_ausencia DESC LIMIT 12`,
      whereJoinParams
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

    // ── Tendência histórica (sem filtro de mês) ──────────────────────────────
    const tendencia = await db.all<any>(
      `SELECT mes,
        COUNT(DISTINCT nome)                               AS funcionarios,
        ROUND(SUM(extra_50+extra_60+extra_100), 2)        AS he_total,
        ROUND(SUM(falta_injustificada+atestado), 2)       AS ausencias,
        ROUND(SUM(atraso), 2)                             AS atrasos,
        ROUND(SUM(banco_horas), 2)                        AS saldo_banco
       FROM ponto_mensal ${whereTend}
       GROUP BY mes ORDER BY mes ASC`,
      whereTendParams
    );

    await db.close();

    return NextResponse.json({
      filtroMeses,
      filtroUnidades,
      mesesDisponiveis: mesesRows.map(r => r.mes),
      opcoesFiltro: {
        unidades: unidadesRows.map(r => r.filial),
        areas:    areasRows.map(r => r.area),
        gestores: gestoresRows.map(r => r.gestor),
      },
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
