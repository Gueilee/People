#!/usr/bin/env python3
"""
Sincroniza dados de ponto do TiqueTaque para o banco SQLite local.

Uso:
  python scripts/sync_ponto.py --mes 2026-04
  python scripts/sync_ponto.py --historico
  python scripts/sync_ponto.py --de 2025-09 --ate 2026-04
"""

import requests
import sqlite3
import base64
import time
import calendar
import argparse
from datetime import date

TOKEN   = "e7d43df8-9070-4932-8da7-a779fc458290"
BASE    = "https://api.tiquetaque.com/v2.1"
DB_PATH = "frontend/database/vendemmia_people.db"
DELAY   = 1.25   # segundos entre requests (seguro para 60/min)

HEADERS = {
    "Authorization": "Basic " + base64.b64encode(f"public:{TOKEN}".encode()).decode()
}

# ── Banco ────────────────────────────────────────────────────────────────────

def criar_tabela(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ponto_mensal (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id             TEXT NOT NULL,
            cpf                     TEXT,
            nome                    TEXT,
            departamento            TEXT,
            cargo                   TEXT,
            filial                  TEXT,
            mes                     TEXT NOT NULL,
            horas_normais           REAL DEFAULT 0,
            total                   REAL DEFAULT 0,
            banco_horas             REAL DEFAULT 0,
            extra_50                REAL DEFAULT 0,
            extra_60                REAL DEFAULT 0,
            extra_100               REAL DEFAULT 0,
            atraso                  REAL DEFAULT 0,
            falta_injustificada     REAL DEFAULT 0,
            atestado                REAL DEFAULT 0,
            abono                   REAL DEFAULT 0,
            ferias                  REAL DEFAULT 0,
            afastamento_nao_rem     REAL DEFAULT 0,
            dispensa_legal          REAL DEFAULT 0,
            adicional_noturno       REAL DEFAULT 0,
            hora_noturna_reduzida   REAL DEFAULT 0,
            dsr                     REAL DEFAULT 0,
            synced_at               TEXT DEFAULT (datetime('now')),
            UNIQUE(employee_id, mes)
        )
    """)
    conn.commit()

# ── TiqueTaque ───────────────────────────────────────────────────────────────

def buscar_funcionarios():
    todos = []
    page  = 1
    while True:
        r = requests.get(f"{BASE}/employees?page={page}", headers=HEADERS, timeout=30)
        if r.status_code != 200:
            print(f"  ⚠️  Erro buscando funcionários página {page}: {r.status_code}")
            break
        data  = r.json()
        items = data.get("_items", [])
        todos.extend(items)
        total = data["_meta"]["total"]
        pages = (total - 1) // data["_meta"]["max_results"] + 1
        print(f"  👥 Funcionários: página {page}/{pages} — {len(todos)}/{total}")
        if len(todos) >= total:
            break
        page += 1
        time.sleep(DELAY)
    return todos

def buscar_filiais():
    r  = requests.get(f"{BASE}/payment-sources", headers=HEADERS, timeout=30)
    time.sleep(DELAY)
    ps = {}
    if r.status_code == 200:
        for item in r.json().get("_items", []):
            nome = item["name"].replace("Vendemmia - Filial ", "")
            ps[item["_id"]] = nome
    return ps

def mes_para_datas(mes):
    y, m = map(int, mes.split("-"))
    ultimo = calendar.monthrange(y, m)[1]
    return f"{y:04d}-{m:02d}-01", f"{y:04d}-{m:02d}-{ultimo:02d}"

# ── Sync ─────────────────────────────────────────────────────────────────────

def sincronizar_mes(conn, funcionarios, filiais, mes):
    inicio, fim = mes_para_datas(mes)
    print(f"\n📅 Sincronizando {mes}  ({inicio} → {fim})")
    print(f"   {len(funcionarios)} funcionários a processar\n")

    ok = skip = err = 0
    total = len(funcionarios)

    for i, emp in enumerate(funcionarios):
        eid  = emp["_id"]
        nome = emp.get("full_name", "—")
        cpf  = emp.get("cpf", "")
        ct   = emp.get("contract_data", {})
        dept = ct.get("department", "")
        cargo= ct.get("job_role", "")
        fid  = ct.get("payment_source", "")
        filial = filiais.get(fid, fid)

        label = f"[{i+1:3d}/{total}] {nome[:45]:<45}"

        r = requests.get(
            f"{BASE}/timesheets?employee_id={eid}&start_date={inicio}&end_date={fim}",
            headers=HEADERS, timeout=30
        )
        time.sleep(DELAY)

        if r.status_code == 404:
            print(f"  {label} ⏭  sem espelho")
            skip += 1
            continue

        if r.status_code == 429:
            print("  ⏸  Rate limit — aguardando 65s...")
            time.sleep(65)
            r = requests.get(
                f"{BASE}/timesheets?employee_id={eid}&start_date={inicio}&end_date={fim}",
                headers=HEADERS, timeout=30
            )
            time.sleep(DELAY)

        if r.status_code != 200:
            print(f"  {label} ⚠️  HTTP {r.status_code}")
            err += 1
            continue

        t = r.json().get("totals", {})
        def f(k): return float(t.get(k, 0) or 0)

        conn.execute("""
            INSERT INTO ponto_mensal
              (employee_id, cpf, nome, departamento, cargo, filial, mes,
               horas_normais, total, banco_horas,
               extra_50, extra_60, extra_100,
               atraso, falta_injustificada, atestado, abono,
               ferias, afastamento_nao_rem, dispensa_legal,
               adicional_noturno, hora_noturna_reduzida, dsr,
               synced_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
            ON CONFLICT(employee_id, mes) DO UPDATE SET
              horas_normais=excluded.horas_normais, total=excluded.total,
              banco_horas=excluded.banco_horas,
              extra_50=excluded.extra_50, extra_60=excluded.extra_60, extra_100=excluded.extra_100,
              atraso=excluded.atraso, falta_injustificada=excluded.falta_injustificada,
              atestado=excluded.atestado, abono=excluded.abono,
              ferias=excluded.ferias, afastamento_nao_rem=excluded.afastamento_nao_rem,
              dispensa_legal=excluded.dispensa_legal,
              adicional_noturno=excluded.adicional_noturno,
              hora_noturna_reduzida=excluded.hora_noturna_reduzida,
              dsr=excluded.dsr, synced_at=datetime('now')
        """, (
            eid, cpf, nome, dept, cargo, filial, mes,
            f("horas_normais"), f("total"), f("banco_horas"),
            f("extra_50"), f("extra_60"), f("extra_100"),
            f("atraso"), f("falta_injustificada"), f("atestado"), f("abono"),
            f("ferias"), f("afastamento_nao_remunerado"), f("dispensa_legal"),
            f("adicional_noturno"), f("hora_noturna_reduzida"), f("dsr"),
        ))
        conn.commit()
        print(f"  {label} ✅")
        ok += 1

    print(f"\n  Resultado {mes}: ✅ {ok} salvos | ⏭  {skip} sem espelho | ⚠️  {err} erros")
    return ok

# ── Intervalo de meses ───────────────────────────────────────────────────────

def gerar_meses(de, ate):
    sy, sm = map(int, de.split("-"))
    ey, em = map(int, ate.split("-"))
    meses  = []
    while (sy, sm) <= (ey, em):
        meses.append(f"{sy:04d}-{sm:02d}")
        sm += 1
        if sm > 12:
            sm = 1; sy += 1
    return meses

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    hoje = date.today()
    mes_atual = f"{hoje.year:04d}-{hoje.month:02d}"

    p = argparse.ArgumentParser(description="Sync TiqueTaque → SQLite")
    p.add_argument("--mes",      help="Mês único (ex: 2026-04)")
    p.add_argument("--historico",action="store_true", help="Histórico completo desde set/2025")
    p.add_argument("--de",       help="Início do intervalo (ex: 2025-09)")
    p.add_argument("--ate",      help="Fim do intervalo (ex: 2026-04)")
    args = p.parse_args()

    if args.mes:
        meses = [args.mes]
    elif args.historico:
        meses = gerar_meses("2025-09", mes_atual)
    elif args.de and args.ate:
        meses = gerar_meses(args.de, args.ate)
    else:
        meses = [mes_atual]

    print(f"\n🚀 TiqueTaque Sync — {len(meses)} mês(es)")
    print(f"   {meses[0]} → {meses[-1]}")
    print(f"   Banco: {DB_PATH}\n")

    conn = sqlite3.connect(DB_PATH)
    criar_tabela(conn)

    print("👥 Buscando funcionários...")
    funcionarios = buscar_funcionarios()
    print(f"   ✅ {len(funcionarios)} funcionários carregados\n")

    print("🏢 Buscando filiais...")
    filiais = buscar_filiais()
    print(f"   ✅ {len(filiais)} filiais\n")

    total = 0
    for mes in meses:
        total += sincronizar_mes(conn, funcionarios, filiais, mes)

    conn.close()
    print(f"\n🎉 Sync concluído! {total} registros salvos em {DB_PATH}")
    print(f"   Próximo passo: git add . && git commit -m 'data: sync ponto {meses[0]}..{meses[-1]}' && git push\n")

if __name__ == "__main__":
    main()
