"""
Sincroniza histórico de cargos e salários via Convenia API → PostgreSQL.
Substitui etl_historico.py (que dependia de Excel exportado manualmente).

Uso:
  python backend/sync_historico.py
"""

import requests
import psycopg2
import psycopg2.extras
import time
import os
import unicodedata
import datetime
import re

API_TOKEN = "244dd481-fbbd-4f95-bb8b-b6617df75403"
BASE_URL  = "https://public-api.convenia.com.br/api/v3"
HEADERS   = {"token": API_TOKEN, "Accept": "application/json"}
DELAY     = 1.2   # 1.2s entre requests → ~50 req/min (limite: 60/min)

PG_CONN = {
    "host":     os.getenv("PG_HOST",     "chico-bento-lake-pg-dev.postgres.database.azure.com"),
    "user":     os.getenv("PG_USER",     "projetos_admin"),
    "password": os.getenv("PG_PASSWORD", "projetos_vdm2026#%"),
    "dbname":   os.getenv("PG_DB",       "vdm_projetos"),
    "port":     5432,
    "sslmode":  "require",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _sem_acentos(s: str) -> str:
    return unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode("ascii")


def extrair_area_unidade(dept_str: str) -> tuple:
    if not dept_str:
        return "", ""
    s = str(dept_str).strip()
    if " - " in s:
        parts = s.split(" - ", 1)
        return parts[0].strip(), parts[1].strip()
    return s, ""


def normalizar_area(area: str) -> str:
    if not area:
        return "Não informado"
    a = area.strip()
    if re.match(r'^opera[çc][õo]es?\s*(0?[1-4])?$', a, re.IGNORECASE):
        return 'Operações'
    if re.match(r'^(cont[áa]bil|fiscal|controladoria)$', a, re.IGNORECASE):
        return 'Controladoria'
    return a


def classificar_tipo(motivo: str) -> str:
    if not motivo:
        return "outro"
    m = _sem_acentos(str(motivo)).lower()
    if "admissao" in m:
        return "admissao"
    if any(x in m for x in ["promocao", "enquadramento de funcao", "alteracao de funcao"]):
        return "promocao"
    if any(x in m for x in ["acordo coletivo", "dissidio", "convencao coletiva", "convencao"]):
        return "reajuste_coletivo"
    if "enquadramento salarial" in m:
        return "reajuste_salarial"
    if "reestruturacao" in m:
        return "reestruturacao"
    if any(x in m for x in ["merito", "espontaneo", "reajuste"]):
        return "reajuste_merito"
    return "outro"


def calc_duracao(d1: str, d2) -> int | None:
    try:
        start = datetime.date.fromisoformat(d1)
        end   = datetime.date.fromisoformat(d2) if d2 else datetime.date.today()
        return max(0, (end - start).days)
    except Exception:
        return None


# ── API Convenia ──────────────────────────────────────────────────────────────

def buscar_ativos() -> list:
    todos, page = [], 1
    while True:
        r = requests.get(f"{BASE_URL}/employees?per_page=100&page={page}",
                         headers=HEADERS, timeout=30)
        if r.status_code != 200:
            break
        data  = r.json()
        items = data.get("data", []) if isinstance(data, dict) else data
        if not items:
            break
        for e in items:
            nome = f"{e.get('name', '')} {e.get('last_name', '')}".strip().upper()
            todos.append({"id": str(e["id"]), "nome": nome,
                          "cpf": e.get("cpf", "") or "", "status": "Ativo"})
        total = data.get("total", 0) if isinstance(data, dict) else 0
        if not total or len(todos) >= total:
            break
        page += 1
        time.sleep(DELAY)
    return todos


def buscar_desligados() -> list:
    todos, page = [], 1
    while True:
        r = requests.get(f"{BASE_URL}/employees/dismissed?per_page=100&page={page}",
                         headers=HEADERS, timeout=30)
        if r.status_code != 200:
            break
        data  = r.json()
        items = data.get("data", []) if isinstance(data, dict) else data
        if not items:
            break
        for e in items:
            nome = f"{e.get('name', '')} {e.get('last_name', '')}".strip().upper()
            todos.append({"id": str(e["id"]), "nome": nome,
                          "cpf": e.get("cpf", "") or "", "status": "Desligado"})
        total = data.get("total", 0) if isinstance(data, dict) else 0
        if not total or len(todos) >= total:
            break
        page += 1
        time.sleep(DELAY)
    return todos


def buscar_historico(emp_id: str) -> list:
    for tentativa in range(3):
        try:
            r = requests.get(f"{BASE_URL}/employees/{emp_id}/salaries-historic",
                             headers=HEADERS, timeout=20)
            if r.status_code == 200:
                data = r.json()
                return data.get("data", data) if isinstance(data, dict) else (data or [])
            if r.status_code == 429:
                time.sleep(10 * (tentativa + 1))
                continue
            return []
        except Exception:
            time.sleep(2)
    return []


# ── Banco ─────────────────────────────────────────────────────────────────────

def criar_tabela(conn):
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS historico_cargo_salario (
            id            SERIAL PRIMARY KEY,
            employee_id   TEXT NOT NULL,
            nome          TEXT,
            cpf           TEXT,
            vinculo       TEXT,
            cargo         TEXT,
            departamento  TEXT,
            area          TEXT,
            unidade       TEXT,
            centro_custo  TEXT,
            motivo        TEXT,
            tipo_evento   TEXT,
            salario_cents INTEGER DEFAULT 0,
            data_inicio   TEXT,
            data_fim      TEXT,
            is_current    INTEGER DEFAULT 0,
            duracao_dias  INTEGER,
            synced_at     TEXT,
            UNIQUE(employee_id, data_inicio)
        )
    """)
    conn.commit()
    cur.close()


def salvar_lote(conn, registros: list):
    if not registros:
        return
    # Dedup por (employee_id, data_inicio) dentro do mesmo lote
    seen = {}
    for r in registros:
        seen[(r["employee_id"], r["data_inicio"])] = r
    registros = list(seen.values())
    cur = conn.cursor()
    psycopg2.extras.execute_values(cur, """
        INSERT INTO historico_cargo_salario
          (employee_id, nome, cpf, vinculo, cargo, departamento, area, unidade,
           centro_custo, motivo, tipo_evento, salario_cents,
           data_inicio, data_fim, is_current, duracao_dias, synced_at)
        VALUES %s
        ON CONFLICT (employee_id, data_inicio) DO UPDATE SET
          cargo        = EXCLUDED.cargo,
          departamento = EXCLUDED.departamento,
          area         = EXCLUDED.area,
          unidade      = EXCLUDED.unidade,
          motivo       = EXCLUDED.motivo,
          tipo_evento  = EXCLUDED.tipo_evento,
          salario_cents= EXCLUDED.salario_cents,
          data_fim     = EXCLUDED.data_fim,
          is_current   = EXCLUDED.is_current,
          duracao_dias = EXCLUDED.duracao_dias,
          synced_at    = EXCLUDED.synced_at
    """, [
        (
            r["employee_id"], r["nome"], r["cpf"], r["vinculo"], r["cargo"],
            r["departamento"], r["area"], r["unidade"], r["centro_custo"],
            r["motivo"], r["tipo_evento"], r["salario_cents"],
            r["data_inicio"], r["data_fim"], r["is_current"],
            r["duracao_dias"], r["synced_at"]
        )
        for r in registros
    ])
    conn.commit()
    cur.close()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    agora = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print("=" * 58)
    print("  Sync Histórico Cargos/Salários  —  Convenia → PostgreSQL")
    print(f"  {agora}")
    print("=" * 58)

    conn = psycopg2.connect(**PG_CONN)
    criar_tabela(conn)

    print("\n👥 Buscando colaboradores da Convenia...")
    ativos     = buscar_ativos()
    desligados = buscar_desligados()
    todos      = ativos + desligados
    print(f"   Ativos: {len(ativos)} | Desligados: {len(desligados)} | Total: {len(todos)}")

    print(f"\n📋 Buscando histórico (1 req/{DELAY}s — estimativa: ~{int(len(todos)*DELAY/60)} min)...")
    ok = sem_hist = total_regs = 0

    for i, emp in enumerate(todos, start=1):
        historico = buscar_historico(emp["id"])
        regs = []

        for h in historico:
            dept_nome   = (h.get("department") or {}).get("name", "")
            area, unid  = extrair_area_unidade(dept_nome)
            motivo_nome = (h.get("motive") or {}).get("name", "")
            date_from   = h.get("date_from") or ""
            date_to     = h.get("date_to")

            if not date_from:
                continue

            regs.append({
                "employee_id":   emp["id"],
                "nome":          emp["nome"],
                "cpf":           emp["cpf"],
                "vinculo":       (h.get("relationship") or {}).get("name", "CLT"),
                "cargo":         (h.get("job") or {}).get("name", ""),
                "departamento":  dept_nome,
                "area":          normalizar_area(area),
                "unidade":       unid,
                "centro_custo":  (h.get("cost_center") or {}).get("name", ""),
                "motivo":        motivo_nome,
                "tipo_evento":   classificar_tipo(motivo_nome),
                "salario_cents": int(h.get("salary") or 0),
                "data_inicio":   date_from,
                "data_fim":      date_to,
                "is_current":    1 if h.get("is_active") else 0,
                "duracao_dias":  calc_duracao(date_from, date_to),
                "synced_at":     agora,
            })

        if regs:
            salvar_lote(conn, regs)
            total_regs += len(regs)
            ok += 1
        else:
            sem_hist += 1

        if i % 25 == 0 or i == len(todos):
            print(f"   [{i:3d}/{len(todos)}] ✅ {ok} com histórico | ⏭  {sem_hist} sem | {total_regs} registros")

        time.sleep(DELAY)

    # Resumo final
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM historico_cargo_salario")
    total_db = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM historico_cargo_salario WHERE tipo_evento='promocao'")
    promos = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT nome) FROM historico_cargo_salario")
    nomes_unicos = cur.fetchone()[0]
    cur.close()
    conn.close()

    print(f"\n{'='*58}")
    print(f"  ✅ Sync concluído!")
    print(f"     Registros no banco : {total_db}")
    print(f"     Colaboradores únicos: {nomes_unicos}")
    print(f"     Promoções          : {promos}")
    print(f"{'='*58}")


if __name__ == "__main__":
    main()
