import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mes    = searchParams.get('mes')    || '';
  const filial = searchParams.get('filial') || '';

  try {
    const db = await getDb();

    // Meses disponíveis no cache
    const mesesRows = await db.all<{ mes: string }>(
      `SELECT DISTINCT mes FROM ponto_mensal ORDER BY mes DESC`
    );
    const mesesDisponiveis = mesesRows.map(r => r.mes);

    const mesFiltro = mes || mesesDisponiveis[0] || '';
    if (!mesFiltro) {
      await db.close();
      return NextResponse.json({ erro: 'Nenhum dado sincronizado ainda.' }, { status: 404 });
    }

    const where    = filial ? `mes = ? AND filial = ?` : `mes = ?`;
    const params   = filial ? [mesFiltro, filial]       : [mesFiltro];
    const paramsMes = [mesFiltro];

    // ── KPIs gerais ─────────────────────────────────────────────────────────
    const kpiRow = await db.get<any>(
      `SELECT
        COUNT(*)                                           AS total_func,
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
        COUNT(CASE WHEN banco_horas < 0 THEN 1 END)        AS banco_negativo,
        SUM(adicional_noturno)                             AS total_noturno,
        SUM(abono)                                         AS total_abono,
        SUM(ferias)                                        AS total_ferias,
        SUM(afastamento_nao_rem)                           AS total_afastamento,
        MAX(synced_at)                                     AS synced_at
       FROM ponto_mensal WHERE ${where}`,
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
        COUNT(*)                                       AS funcionarios,
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
        COUNT(CASE WHEN banco_horas < 0 THEN 1 END)    AS banco_negativo
       FROM ponto_mensal
       WHERE mes = ?
       GROUP BY filial
       ORDER BY filial`,
      paramsMes
    );

    // ── Top faltas ───────────────────────────────────────────────────────────
    const topFaltas = await db.all<any>(
      `SELECT nome, cargo, filial, departamento,
        falta_injustificada, atestado,
        (falta_injustificada + atestado) AS total_ausencia
       FROM ponto_mensal
       WHERE ${where} AND (falta_injustificada + atestado) > 0
       ORDER BY total_ausencia DESC LIMIT 15`,
      params
    );

    // ── Top horas extras ─────────────────────────────────────────────────────
    const topExtras = await db.all<any>(
      `SELECT nome, cargo, filial, departamento,
        extra_50, extra_60, extra_100,
        (extra_50 + extra_60 + extra_100) AS total_he
       FROM ponto_mensal
       WHERE ${where} AND (extra_50 + extra_60 + extra_100) > 0
       ORDER BY total_he DESC LIMIT 15`,
      params
    );

    // ── Top banco negativo ───────────────────────────────────────────────────
    const topBancoNeg = await db.all<any>(
      `SELECT nome, cargo, filial, banco_horas
       FROM ponto_mensal
       WHERE ${where} AND banco_horas < 0
       ORDER BY banco_horas ASC LIMIT 15`,
      params
    );

    // ── Top atrasos ──────────────────────────────────────────────────────────
    const topAtrasos = await db.all<any>(
      `SELECT nome, cargo, filial, atraso
       FROM ponto_mensal
       WHERE ${where} AND atraso > 0
       ORDER BY atraso DESC LIMIT 15`,
      params
    );

    // ── Distribuição banco de horas ──────────────────────────────────────────
    const distBanco = await db.get<any>(
      `SELECT
        COUNT(CASE WHEN banco_horas < -40  THEN 1 END) AS critico,
        COUNT(CASE WHEN banco_horas >= -40 AND banco_horas < 0  THEN 1 END) AS negativo,
        COUNT(CASE WHEN banco_horas >= 0   AND banco_horas <= 20 THEN 1 END) AS equilibrado,
        COUNT(CASE WHEN banco_horas > 20   AND banco_horas <= 40 THEN 1 END) AS positivo,
        COUNT(CASE WHEN banco_horas > 40   THEN 1 END) AS excesso
       FROM ponto_mensal WHERE ${where}`,
      params
    );

    // ── Absenteísmo por gestor (cruzamento Convenia) ─────────────────────────
    const absByGestor = await db.all<any>(
      `SELECT c.gestor,
        COUNT(p.employee_id)                               AS funcionarios,
        ROUND(SUM(p.falta_injustificada + p.atestado), 2) AS total_ausencia,
        ROUND(AVG(p.falta_injustificada + p.atestado), 2) AS media_ausencia
       FROM ponto_mensal p
       LEFT JOIN colaboradores c ON p.cpf = c.cpf
       WHERE p.mes = ? AND c.gestor IS NOT NULL AND c.gestor != '' AND c.status = 'Ativo'
       GROUP BY c.gestor
       HAVING total_ausencia > 0
       ORDER BY total_ausencia DESC LIMIT 12`,
      paramsMes
    );

    // ── Absenteísmo por cargo ────────────────────────────────────────────────
    const absByCargo = await db.all<any>(
      `SELECT cargo,
        COUNT(*)                                          AS funcionarios,
        ROUND(SUM(falta_injustificada + atestado), 2)    AS total_ausencia,
        ROUND(AVG(falta_injustificada + atestado), 2)    AS media_ausencia,
        ROUND(SUM(extra_50 + extra_60 + extra_100), 2)   AS total_he
       FROM ponto_mensal
       WHERE ${where} AND cargo != ''
       GROUP BY cargo
       ORDER BY total_ausencia DESC LIMIT 12`,
      params
    );

    // ── Tendência histórica (todos os meses disponíveis) ────────────────────
    const tendencia = await db.all<any>(
      `SELECT mes,
        COUNT(*)                                           AS funcionarios,
        ROUND(SUM(extra_50+extra_60+extra_100), 2)        AS he_total,
        ROUND(SUM(falta_injustificada+atestado), 2)       AS ausencias,
        ROUND(SUM(atraso), 2)                             AS atrasos,
        ROUND(SUM(banco_horas), 2)                        AS saldo_banco
       FROM ponto_mensal
       GROUP BY mes ORDER BY mes ASC`,
      []
    );

    await db.close();

    return NextResponse.json({
      mes: mesFiltro,
      mesesDisponiveis,
      kpis: {
        totalFuncionarios: kpiRow?.total_func      || 0,
        horasNormais:      +(kpiRow?.horas_normais || 0).toFixed(1),
        totalHE:           +(kpiRow?.total_he      || 0).toFixed(1),
        he50:              +(kpiRow?.he50          || 0).toFixed(1),
        he60:              +(kpiRow?.he60          || 0).toFixed(1),
        he100:             +(kpiRow?.he100         || 0).toFixed(1),
        totalFaltas:       +(kpiRow?.total_faltas  || 0).toFixed(1),
        totalAtestados:    +(kpiRow?.total_atestados|| 0).toFixed(1),
        totalAusencias:    +(kpiRow?.total_ausencias|| 0).toFixed(1),
        taxaAbsenteismo,
        totalAtraso:       +(kpiRow?.total_atraso  || 0).toFixed(1),
        saldoBanco:        +(kpiRow?.saldo_banco   || 0).toFixed(1),
        bancoNegativo:     kpiRow?.banco_negativo   || 0,
        totalNoturno:      +(kpiRow?.total_noturno || 0).toFixed(1),
        totalAbono:        +(kpiRow?.total_abono   || 0).toFixed(1),
        totalFerias:       +(kpiRow?.total_ferias  || 0).toFixed(1),
        totalAfastamento:  +(kpiRow?.total_afastamento || 0).toFixed(1),
        syncedAt:          kpiRow?.synced_at || '',
      },
      porFilial,
      topFaltas,
      topExtras,
      topBancoNeg,
      topAtrasos,
      distBanco,
      absByGestor,
      absByCargo,
      tendencia,
    });
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 });
  }
}
