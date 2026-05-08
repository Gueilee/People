import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

async function getDb() {
  const p = path.resolve(process.cwd(), '../database/vendemmia_people.db');
  return open({ filename: p, driver: sqlite3.Database });
}

function subMonths(d: Date, m: number) {
  const r = new Date(d); r.setMonth(r.getMonth() - m); return r;
}

// GET — verifica métricas e retorna status (sem enviar email)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const threshold = parseFloat(searchParams.get('threshold') || '10');
    const meses     = parseInt(searchParams.get('meses')     || '3', 10);

    const db   = await getDb();
    const rows = await db.all('SELECT unidade, data_desligamento, data_admissao, status FROM colaboradores');
    await db.close();

    const hoje   = new Date();
    const inicio = subMonths(hoje, meses);

    const ativos  = rows.filter(r => !r.data_desligamento);
    const deslPer = rows.filter(r => r.data_desligamento && new Date(r.data_desligamento) >= inicio);
    const admPer  = rows.filter(r => r.data_admissao     && new Date(r.data_admissao)     >= inicio);
    const hMedia  = Math.max((ativos.length + deslPer.length) / 2, 1);
    const taxaGeral = (((deslPer.length + admPer.length) / 2) / hMedia) * 100;

    // Taxa por unidade
    const unidades = [...new Set(rows.map(r => r.unidade))].filter(Boolean);
    const alertasPorUnidade = unidades.map(u => {
      const a = ativos.filter(r => r.unidade === u).length;
      const d = deslPer.filter(r => r.unidade === u).length;
      const taxa = (d / Math.max((a + d) / 2, 1)) * 100;
      return { unidade: u, taxa: +taxa.toFixed(1), ativos: a, desligados: d, emAlerta: taxa >= threshold };
    }).sort((a, b) => b.taxa - a.taxa);

    const unidadesEmAlerta = alertasPorUnidade.filter(u => u.emAlerta);

    return NextResponse.json({
      taxaGeral:           +taxaGeral.toFixed(1),
      threshold,
      emAlerta:            taxaGeral >= threshold,
      totalDesligamentos:  deslPer.length,
      periodo:             meses,
      unidadesEmAlerta,
      todasUnidades:       alertasPorUnidade,
      smtpConfigurado:     !!(process.env.SMTP_HOST && process.env.SMTP_USER),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — envia email de alerta
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { destinatario, threshold = 10, meses = 3 } = body;

    if (!destinatario) {
      return NextResponse.json({ error: 'destinatario é obrigatório' }, { status: 400 });
    }

    // Verificar configuração SMTP
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;

    if (!host || !user || !pass) {
      return NextResponse.json({
        error: 'SMTP não configurado. Defina SMTP_HOST, SMTP_USER e SMTP_PASS em .env.local',
      }, { status: 503 });
    }

    // Buscar métricas atuais
    const db   = await getDb();
    const rows = await db.all('SELECT unidade, data_desligamento, data_admissao FROM colaboradores');
    await db.close();

    const hoje   = new Date();
    const inicio = subMonths(hoje, meses);
    const ativos  = rows.filter(r => !r.data_desligamento);
    const deslPer = rows.filter(r => r.data_desligamento && new Date(r.data_desligamento) >= inicio);
    const admPer  = rows.filter(r => r.data_admissao && new Date(r.data_admissao) >= inicio);
    const hMedia  = Math.max((ativos.length + deslPer.length) / 2, 1);
    const taxaGeral = +(((deslPer.length + admPer.length) / 2 / hMedia) * 100).toFixed(1);

    const unidades = [...new Set(rows.map(r => r.unidade))].filter(Boolean);
    const unidadesEmAlerta = unidades.map(u => {
      const a = ativos.filter(r => r.unidade === u).length;
      const d = deslPer.filter(r => r.unidade === u).length;
      const taxa = +((d / Math.max((a + d) / 2, 1)) * 100).toFixed(1);
      return { unidade: u, taxa, ativos: a, desligados: d };
    }).filter(u => u.taxa >= threshold).sort((a, b) => b.taxa - a.taxa);

    const dataFmt = hoje.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

    const htmlBody = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 20px; }
  .card { background: #fff; border-radius: 12px; padding: 24px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  h1 { color: #422c76; font-size: 20px; margin: 0 0 4px; }
  .sub { color: #6b7280; font-size: 12px; margin-bottom: 20px; }
  .kpi { display: flex; gap: 16px; margin-bottom: 20px; }
  .kpi-box { flex: 1; border-radius: 8px; padding: 16px; text-align: center; }
  .kpi-box .val { font-size: 28px; font-weight: 900; }
  .kpi-box .lbl { font-size: 11px; color: #6b7280; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f3f4f6; padding: 8px 12px; text-align: left; color: #6b7280; font-size: 10px; text-transform: uppercase; }
  td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-weight: 700; font-size: 10px; color: #fff; }
  .red { background: #dc2626; }  .amber { background: #f59e0b; }
  footer { text-align: center; font-size: 10px; color: #9ca3af; margin-top: 16px; }
</style></head>
<body>
<div class="card">
  <h1>🚨 Alerta de Turnover — VENDEMMIA PEOPLE</h1>
  <div class="sub">Gerado em ${dataFmt} · Período de análise: ${meses} meses · Limite: ${threshold}%</div>
  <div class="kpi">
    <div class="kpi-box" style="background:#fef2f2">
      <div class="val" style="color:#dc2626">${taxaGeral}%</div>
      <div class="lbl">Taxa Geral de Turnover</div>
    </div>
    <div class="kpi-box" style="background:#fffbeb">
      <div class="val" style="color:#f59e0b">${deslPer.length}</div>
      <div class="lbl">Desligamentos (${meses}m)</div>
    </div>
    <div class="kpi-box" style="background:#f0fdf4">
      <div class="val" style="color:#16a34a">${ativos.length}</div>
      <div class="lbl">Headcount Ativo</div>
    </div>
  </div>
  ${unidadesEmAlerta.length ? `
  <p style="font-weight:700;color:#dc2626;margin-bottom:8px;">⚠️ Unidades acima do limite de ${threshold}%</p>
  <table>
    <tr><th>Unidade</th><th>Taxa</th><th>Desligamentos</th><th>Ativos</th></tr>
    ${unidadesEmAlerta.map(u => `
    <tr>
      <td>${u.unidade}</td>
      <td><span class="badge ${u.taxa >= threshold * 2 ? 'red' : 'amber'}">${u.taxa}%</span></td>
      <td>${u.desligados}</td>
      <td>${u.ativos}</td>
    </tr>`).join('')}
  </table>` : '<p style="color:#16a34a;font-weight:600;">✅ Todas as unidades dentro do limite configurado.</p>'}
  <br/>
  <footer>VENDEMMIA PEOPLE · Sistema de Gestão de Pessoas · Alerta automático</footer>
</div>
</body>
</html>`;

    // Enviar email
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transporter.sendMail({
      from: `"VENDEMMIA PEOPLE" <${from}>`,
      to: destinatario,
      subject: `[ALERTA] Turnover ${taxaGeral}% — ${unidadesEmAlerta.length} unidade(s) acima de ${threshold}%`,
      html: htmlBody,
    });

    return NextResponse.json({
      success: true,
      taxaGeral,
      unidadesEmAlerta: unidadesEmAlerta.length,
      mensagem: `Email enviado para ${destinatario}`,
    });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
