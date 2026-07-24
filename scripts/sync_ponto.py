#!/usr/bin/env python3
"""
Sincroniza dados de ponto do TiqueTaque para o banco PostgreSQL (Azure).

Uso:
  python scripts/sync_ponto.py --mes 2026-04
  python scripts/sync_ponto.py --historico
  python scripts/sync_ponto.py --de 2025-09 --ate 2026-04
"""

import requests
import psycopg2
import base64
import time
import calendar
import argparse
import os
from datetime import date

TOKEN   = "e7d43df8-9070-4932-8da7-a779fc458290"
BASE    = "https://api.tiquetaque.com/v2.1"
DELAY   = 1.25   # segundos entre requests (seguro para 60/min)

PG_CONN = {
    "host":     os.getenv("PG_HOST",     "chico-bento-lake-pg-dev.postgres.database.azure.com"),
    "user":     os.getenv("PG_USER",     "projetos_admin"),
    "password": os.getenv("PG_PASSWORD", "projetos_vdm2026#%"),
    "dbname":   os.getenv("PG_DB",       "vdm_projetos"),
    "port":     5432,
    "sslmode":  "require",
}

HEADERS = {
    "Authorization": "Basic " + base64.b64encode(f"public:{TOKEN}".encode()).decode()
}

# ── Banco ────────────────────────────────────────────────────────────────────

def criar_tabela(conn):
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ponto_mensal (
            id                      SERIAL PRIMARY KEY,
            employee_id             TEXT NOT NULL,
            cpf                     TEXT,
            nome                    TEXT,
            departamento            TEXT,
            cargo                   TEXT,
            filial                  TEXT,
            mes                     TEXT NOT NULL,
            horas_normais           DOUBLE PRECISION DEFAULT 0,
            total                   DOUBLE PRECISION DEFAULT 0,
            banco_horas             DOUBLE PRECISION DEFAULT 0,
            extra_50                DOUBLE PRECISION DEFAULT 0,
            extra_60                DOUBLE PRECISION DEFAULT 0,
            extra_100               DOUBLE PRECISION DEFAULT 0,
            atraso                  DOUBLE PRECISION DEFAULT 0,
            falta_injustificada     DOUBLE PRECISION DEFAULT 0,
            atestado                DOUBLE PRECISION DEFAULT 0,
            abono                   DOUBLE PRECISION DEFAULT 0,
            ferias                  DOUBLE PRECISION DEFAULT 0,
            afastamento_nao_rem     DOUBLE PRECISION DEFAULT 0,
            dispensa_legal          DOUBLE PRECISION DEFAULT 0,
            adicional_noturno       DOUBLE PRECISION DEFAULT 0,
            hora_noturna_reduzida   DOUBLE PRECISION DEFAULT 0,
            dsr                     DOUBLE PRECISION DEFAULT 0,
            synced_at               TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
            UNIQUE(employee_id, mes)
        )
    """)
    conn.commit()
    cur.close()

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

        cur = conn.cursor()
        cur.execute("""
            INSERT INTO ponto_mensal
              (employee_id, cpf, nome, departamento, cargo, filial, mes,
               horas_normais, total, banco_horas,
               extra_50, extra_60, extra_100,
               atraso, falta_injustificada, atestado, abono,
               ferias, afastamento_nao_rem, dispensa_legal,
               adicional_noturno, hora_noturna_reduzida, dsr,
               synced_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
            ON CONFLICT(employee_id, mes) DO UPDATE SET
              horas_normais=EXCLUDED.horas_normais, total=EXCLUDED.total,
              banco_horas=EXCLUDED.banco_horas,
              extra_50=EXCLUDED.extra_50, extra_60=EXCLUDED.extra_60, extra_100=EXCLUDED.extra_100,
              atraso=EXCLUDED.atraso, falta_injustificada=EXCLUDED.falta_injustificada,
              atestado=EXCLUDED.atestado, abono=EXCLUDED.abono,
              ferias=EXCLUDED.ferias, afastamento_nao_rem=EXCLUDED.afastamento_nao_rem,
              dispensa_legal=EXCLUDED.dispensa_legal,
              adicional_noturno=EXCLUDED.adicional_noturno,
              hora_noturna_reduzida=EXCLUDED.hora_noturna_reduzida,
              dsr=EXCLUDED.dsr, synced_at=TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        """, (
            eid, cpf, nome, dept, cargo, filial, mes,
            f("horas_normais"), f("total"), f("banco_horas"),
            f("extra_50"), f("extra_60"), f("extra_100"),
            f("atraso"), f("falta_injustificada"), f("atestado"), f("abono"),
            f("ferias"), f("afastamento_nao_remunerado"), f("dispensa_legal"),
            f("adicional_noturno"), f("hora_noturna_reduzida"), f("dsr"),
        ))
        conn.commit()
        cur.close()
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

    p = argparse.ArgumentParser(description="Sync TiqueTaque → PostgreSQL")
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
    print(f"   Banco: {PG_CONN['host']} / {PG_CONN['dbname']}\n")

    conn = psycopg2.connect(**PG_CONN)
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
    print(f"\n🎉 Sync concluído! {total} registros salvos no PostgreSQL")

if __name__ == "__main__":
    main()
