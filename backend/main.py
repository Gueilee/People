import requests
import pandas as pd
from sqlalchemy import create_engine
import datetime
import random
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed

API_TOKEN = "244dd481-fbbd-4f95-bb8b-b6617df75403"
BASE_URL  = "https://public-api.convenia.com.br/api/v3"

HEADERS = {
    "token": API_TOKEN,
    "Accept": "application/json",
    "Content-Type": "application/json",
}

DB_PATH = "sqlite:///../database/vendemmia_people.db"
engine  = create_engine(DB_PATH)


# ──────────────────────────────────────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _sem_acentos(texto: str) -> str:
    return unicodedata.normalize("NFD", str(texto)).encode("ascii", "ignore").decode("ascii")


def extrair_depto_unidade(dept_name: str) -> tuple[str, str]:
    """Convenia armazena 'Dept - Unidade' no mesmo campo."""
    if " - " in dept_name:
        partes = dept_name.split(" - ", 1)
        return partes[0].strip(), partes[1].strip()
    return dept_name.strip(), ""


def normalizar_tipo(titulo) -> str:
    """Mapeia os títulos verbosos do Convenia para categorias gerenciais."""
    if not titulo:
        return "Nao informado"
    t = _sem_acentos(str(titulo)).lower()
    if "pedido do empregado" in t or "pedido de demissao" in t:
        return "Pedido de demissao"
    if "antecipado pelo empregado" in t:
        return "Pedido de demissao"
    if "sem justa causa" in t or "antecipado pelo empregador" in t or "pedido da empresa" in t:
        return "Demissao sem justa causa"
    if "justa causa" in t:
        return "Demissao com justa causa"
    if "acordo" in t:
        return "Acordo mutuo"
    if "suspensao" in t:
        return "Suspensao de contrato"
    if "aposentadoria" in t:
        return "Aposentadoria"
    if "termino" in t or "rescisao" in t:
        return "Termino de contrato"
    return str(titulo)[:60]


def _tenure_dias(hiring_date, dismissal_date) -> int | None:
    """Calcula dias de permanência entre admissão e desligamento."""
    try:
        d1 = datetime.date.fromisoformat(str(hiring_date))
        d2 = datetime.date.fromisoformat(str(dismissal_date))
        return (d2 - d1).days
    except Exception:
        return None


# ──────────────────────────────────────────────────────────────────────────────
#  Mapeamento dos campos da API
# ──────────────────────────────────────────────────────────────────────────────

def _base_campos(emp: dict, cost_center: dict = None) -> tuple:
    """Extrai departamento e unidade do campo department.name."""
    dept = emp.get("department") or {}
    dept_nome = dept.get("name", "")
    departamento, unidade = extrair_depto_unidade(dept_nome)
    if not unidade and cost_center:
        unidade = (cost_center or {}).get("name", "")
    return departamento, unidade


def _supervisor_nome(supervisor: dict) -> str:
    s = supervisor or {}
    n = s.get("name", "")
    l = s.get("last_name", "")
    return f"{n} {l}".strip() if n else "Nao informado"


def mapear_ativo(emp: dict, extra: dict = None) -> dict:
    """Mapeia colaborador ativo; 'extra' traz gender/etnia/vinculo da chamada individual."""
    extra = extra or {}
    dept, unidade = _base_campos(emp, emp.get("cost_center"))
    return {
        "id_colaborador":    str(emp.get("id", "")),
        "nome":              f"{emp.get('name', '')} {emp.get('last_name', '')}".strip().upper(),
        "email":             emp.get("email", ""),
        "unidade":           unidade,
        "departamento":      dept,
        "cargo":             (emp.get("job") or {}).get("name", ""),
        "gestor":            _supervisor_nome(emp.get("supervisor")),
        "data_admissao":     emp.get("hiring_date", ""),
        "birth_date":        emp.get("birth_date", ""),
        "gender":            extra.get("gender", ""),
        "etnia":             extra.get("etnia", ""),
        "vinculo":           extra.get("vinculo", "CLT"),
        "data_desligamento": None,
        "tipo_desligamento": None,
        "tenure_days":       None,
        "status":            "Ativo",
    }


def mapear_desligado(emp_detail: dict, dismissal_info: dict) -> dict:
    """Combina detalhes do colaborador com informações de desligamento."""
    data     = emp_detail.get("data", emp_detail)
    dept, unidade = _base_campos(data, data.get("cost_center"))
    dismissal    = (dismissal_info.get("dismissal") or {})
    tipo_raw     = (dismissal.get("type") or {}).get("title", "")
    desl_date    = dismissal.get("date")
    return {
        "id_colaborador":    str(data.get("id", "")),
        "nome":              f"{data.get('name', '')} {data.get('last_name', '')}".strip().upper(),
        "email":             data.get("email", "") or dismissal_info.get("corporate_email", ""),
        "unidade":           unidade,
        "departamento":      dept,
        "cargo":             (data.get("job") or {}).get("name", ""),
        "gestor":            _supervisor_nome(data.get("supervisor")),
        "data_admissao":     data.get("hiring_date", ""),
        "birth_date":        data.get("birth_date", ""),
        "gender":            data.get("gender", ""),
        "etnia":             (data.get("ethnicity") or {}).get("name", ""),
        "vinculo":           (data.get("relationship") or {}).get("name", "CLT"),
        "data_desligamento": desl_date,
        "tipo_desligamento": normalizar_tipo(tipo_raw),
        "tenure_days":       _tenure_dias(data.get("hiring_date"), desl_date),
        "status":            "Desligado",
    }


# ──────────────────────────────────────────────────────────────────────────────
#  Chamadas à API
# ──────────────────────────────────────────────────────────────────────────────

def _get_employee(emp_id: str, tentativas: int = 3) -> dict | None:
    for i in range(tentativas):
        try:
            r = requests.get(f"{BASE_URL}/employees/{emp_id}", headers=HEADERS, timeout=20)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return None
            if r.status_code == 429:
                time.sleep(2 * (i + 1))
        except requests.exceptions.Timeout:
            time.sleep(1)
        except Exception:
            break
    return None


def _parallel_fetch(ids: list[str], fn, workers: int = 4) -> dict:
    """Executa fn(emp_id) em paralelo e retorna {emp_id: resultado}."""
    resultados = {}
    total = len(ids)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(fn, eid): eid for eid in ids}
        done = 0
        for future in as_completed(futures):
            done += 1
            eid = futures[future]
            try:
                resultado = future.result()
                if resultado is not None:
                    resultados[eid] = resultado
            except Exception:
                pass
            if done % 100 == 0:
                pct = int(done / total * 100)
                print(f"    {done}/{total} ({pct}%) | obtidos: {len(resultados)}")
    return resultados


def buscar_ativos_bulk() -> list[dict]:
    r = requests.get(f"{BASE_URL}/employees?per_page=500", headers=HEADERS, timeout=30)
    r.raise_for_status()
    data = r.json()
    items = data.get("data", []) if isinstance(data, dict) else data
    print(f"  Ativos (bulk): {len(items)}")
    return items


def buscar_extras_ativos(items: list[dict]) -> dict:
    """Busca gender / etnia / vinculo via endpoint individual para cada ativo."""
    ids = [str(e.get("id")) for e in items if e.get("id")]
    print(f"  Buscando dados de diversidade de {len(ids)} ativos...")

    def fetch_extra(emp_id):
        det = _get_employee(emp_id)
        if det:
            d = det.get("data", det)
            return {
                "gender": d.get("gender", ""),
                "etnia":  (d.get("ethnicity") or {}).get("name", ""),
                "vinculo": (d.get("relationship") or {}).get("name", "CLT"),
            }
        return None

    resultados = _parallel_fetch(ids, fetch_extra, workers=4)
    print(f"  Extras ativos: {len(resultados)}/{len(ids)}")
    return resultados


def buscar_lista_desligados() -> list[dict]:
    todos, page = [], 1
    while True:
        r = requests.get(f"{BASE_URL}/employees/dismissed?per_page=100&page={page}",
                         headers=HEADERS, timeout=30)
        r.raise_for_status()
        data  = r.json()
        items = data.get("data", []) if isinstance(data, dict) else data
        if not items:
            break
        todos.extend(items)
        if len(todos) >= data.get("total", len(todos)):
            break
        page += 1
    print(f"  Desligados lista: {len(todos)}")
    return todos


def buscar_desligados_completo(lista: list[dict]) -> list[dict]:
    print(f"  Buscando detalhes de {len(lista)} desligados...")
    resultados = []

    def processar(item):
        try:
            emp_id = item.get("id") if item else None
            if not emp_id:
                return None
            det = _get_employee(emp_id)
            if det:
                return mapear_desligado(det, item)
        except Exception:
            pass
        return None

    total = len(lista)
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(processar, item): item for item in lista}
        done = 0
        for future in as_completed(futures):
            done += 1
            try:
                res = future.result()
                if res:
                    resultados.append(res)
            except Exception:
                pass
            if done % 100 == 0:
                pct = int(done / total * 100)
                print(f"    {done}/{total} ({pct}%) | obtidos: {len(resultados)}")

    print(f"  Desligados completos: {len(resultados)}/{total}")
    return resultados


def buscar_colaboradores_api() -> list[dict]:
    print("Conectando a API Convenia...")
    # Ativos
    items_bulk  = buscar_ativos_bulk()
    extras_dict = buscar_extras_ativos(items_bulk)
    ativos = [
        mapear_ativo(emp, extras_dict.get(str(emp.get("id")), {}))
        for emp in items_bulk if emp.get("id")
    ]
    print(f"  Ativos mapeados: {len(ativos)}")
    # Desligados
    lista_desl = buscar_lista_desligados()
    desligados = buscar_desligados_completo(lista_desl)
    resultado  = ativos + desligados
    if not resultado:
        raise Exception("API retornou zero registros")
    return resultado


# ──────────────────────────────────────────────────────────────────────────────
#  Mock data (fallback)
# ──────────────────────────────────────────────────────────────────────────────

def gerar_mock_data() -> list[dict]:
    random.seed(42)
    hoje = datetime.date.today()

    DIST = [
        ("Navegantes CD01","Operacional",22),("Navegantes CD01","Fiscal",9),
        ("Navegantes CD01","Logistica",13),("Navegantes CD01","Administrativo",5),
        ("Itapevi","Operacional",19),("Itapevi","Logistica",11),
        ("Itapevi","Administrativo",3),("Vila Olimpia","Comercial",13),
        ("Vila Olimpia","Financeiro",8),("Vila Olimpia","RH",5),
        ("Vila Olimpia","TI",6),("Vila Olimpia","Juridico",3),
        ("Vila Olimpia","Compliance",3),("Navegantes CD02","Operacional",11),
        ("Navegantes CD02","Fiscal",6),("Navegantes CD02","Logistica",8),
        ("Garuva","Operacional",9),("Garuva","Comercial",5),
    ]
    CARGOS = {
        "Operacional":["Analista de Operacoes","Assistente Operacional","Supervisor de Operacoes","Coordenador Operacional"],
        "Fiscal":["Analista Fiscal","Assistente Fiscal","Supervisor Fiscal"],
        "Comercial":["Executivo de Contas","Analista Comercial","Coordenador Comercial"],
        "RH":["Analista de RH","Assistente de RH","Business Partner RH"],
        "Financeiro":["Analista Financeiro","Controller","Coordenador Financeiro"],
        "TI":["Desenvolvedor","Analista de Suporte","DevOps"],
        "Juridico":["Advogado","Analista Juridico"],
        "Administrativo":["Assistente Administrativo","Analista Administrativo"],
        "Logistica":["Auxiliar de Logistica","Analista de Logistica","Coordenador de Logistica"],
        "Compliance":["Analista de Compliance","Coordenador de Compliance"],
    }
    TIPOS = ["Pedido de demissao","Pedido de demissao","Pedido de demissao",
             "Demissao sem justa causa","Demissao sem justa causa","Demissao sem justa causa",
             "Acordo mutuo","Acordo mutuo","Demissao com justa causa","Termino de contrato"]
    GENEROS  = ["M","M","M","F","F"]
    ETNIAS   = ["Branca","Branca","Parda","Parda","Parda","Preta","Amarela","Indigena"]
    VINCULOS = ["CLT","CLT","CLT","CLT","CLT","CLT","Estagio"]
    NOMES    = ["ADRIANA","ADRIANO","ALEXANDRE","ANA","ANDERSON","ANDRESSA","ANTONIO","BEATRIZ",
                "BRUNA","CAIO","CARLA","CARLOS","CAROLINA","DANIEL","DANIELA","DIEGO","EDUARDA",
                "EDUARDO","FABIANO","FABIO","FERNANDA","FERNANDO","GABRIEL","GABRIELA","GUILHERME",
                "GUSTAVO","IGOR","ISABELA","JESSICA","JOAO","JOSE","JULIA","JULIANA","KAREN",
                "LARISSA","LEANDRO","LETICIA","LUCAS","LUCIA","LUIZ","MANUELA","MARCELA","MARCELO",
                "MARCOS","MARIANA","MATEUS","MATHEUS","MAURICIO","NATHALIA","NICOLAS","PATRICIA",
                "PAULO","PEDRO","RAFAEL","RAFAELA","RAQUEL","RENATA","RENATO","RICARDO","ROBERTA",
                "RODRIGO","SAMUEL","SARAH","SERGIO","THIAGO","VANESSA","VICTOR","WELLINGTON","YASMIN"]
    SOBRENOMES = ["SILVA","SANTOS","OLIVEIRA","SOUZA","RODRIGUES","FERREIRA","ALVES","PEREIRA",
                  "LIMA","GOMES","COSTA","RIBEIRO","MARTINS","CARVALHO","ALMEIDA","LOPES",
                  "SOARES","FERNANDES","VIEIRA","BARBOSA","ROCHA","DIAS","NASCIMENTO","ANDRADE"]
    usados, dados, id_cnt = set(), [], 1001

    def nome_unico():
        for _ in range(300):
            n, s = random.choice(NOMES), random.choice(SOBRENOMES)
            k = f"{n} {s}"
            if k not in usados:
                usados.add(k)
                return k, n.lower(), s.lower()
        return "FULANO SILVA", "fulano", "silva"

    gestores = {(u, d): nome_unico()[0] for u, d, _ in DIST}

    for unidade, dep, total in DIST:
        gestor = gestores[(unidade, dep)]
        qtd_desl = max(1, int(total * random.uniform(0.18, 0.38)))
        cargos = CARGOS.get(dep, ["Analista"])
        ano_nasc_base = random.randint(1975, 2002)

        for _ in range(total - qtd_desl):
            nome, nl, sl = nome_unico()
            adm  = hoje - datetime.timedelta(days=random.randint(30, 1800))
            nasc = datetime.date(ano_nasc_base + random.randint(-5,5), random.randint(1,12), random.randint(1,28))
            dados.append({"id_colaborador":str(id_cnt),"nome":nome,
                "email":f"{nl}.{sl}@vendemmia.com.br","unidade":unidade,"departamento":dep,
                "cargo":random.choice(cargos),"gestor":gestor,
                "data_admissao":adm.strftime("%Y-%m-%d"),"birth_date":str(nasc),
                "gender":random.choice(GENEROS),"etnia":random.choice(ETNIAS),
                "vinculo":random.choice(VINCULOS),
                "data_desligamento":None,"tipo_desligamento":None,"tenure_days":None,"status":"Ativo"})
            id_cnt += 1

        for _ in range(qtd_desl):
            nome, nl, sl = nome_unico()
            adm  = hoje - datetime.timedelta(days=random.randint(365, 2190))
            desl = hoje - datetime.timedelta(days=random.randint(1, 548))
            if desl <= adm:
                desl = adm + datetime.timedelta(days=60)
            nasc = datetime.date(ano_nasc_base + random.randint(-5,5), random.randint(1,12), random.randint(1,28))
            tenure = (desl - adm).days
            dados.append({"id_colaborador":str(id_cnt),"nome":nome,
                "email":f"{nl}.{sl}@vendemmia.com.br","unidade":unidade,"departamento":dep,
                "cargo":random.choice(cargos),"gestor":gestor,
                "data_admissao":adm.strftime("%Y-%m-%d"),"birth_date":str(nasc),
                "gender":random.choice(GENEROS),"etnia":random.choice(ETNIAS),
                "vinculo":random.choice(VINCULOS),
                "data_desligamento":desl.strftime("%Y-%m-%d"),
                "tipo_desligamento":random.choice(TIPOS),
                "tenure_days":tenure,"status":"Desligado"})
            id_cnt += 1

    return dados


# ──────────────────────────────────────────────────────────────────────────────
#  Pipeline
# ──────────────────────────────────────────────────────────────────────────────

def processar_e_salvar():
    print("=" * 52)
    print("  VENDEMMIA PEOPLE - Pipeline de Dados v2")
    print("=" * 52)

    dados = []
    try:
        dados = buscar_colaboradores_api()
        if not dados:
            raise Exception("API retornou zero registros")
        print(f"  [OK] Total carregado: {len(dados)}")
    except Exception as e:
        print(f"  [ERRO] {e}")
        # Se ja existe dados reais no banco, nao sobrescreve com mock
        try:
            df_existing = pd.read_sql("SELECT COUNT(*) as n FROM colaboradores", con=engine)
            n_existing = int(df_existing.iloc[0]["n"])
        except Exception:
            n_existing = 0
        if n_existing > 0:
            print(f"  -> Mantendo dados existentes no banco ({n_existing} registros). Execute novamente quando a API estiver disponivel.")
            return
        print("  -> Banco vazio. Usando mock data...")
        dados = gerar_mock_data()
        print(f"  [OK] Mock: {len(dados)} registros")

    df = pd.DataFrame(dados)
    df["data_admissao"]     = pd.to_datetime(df["data_admissao"],     errors="coerce").dt.date
    df["data_desligamento"] = pd.to_datetime(df["data_desligamento"], errors="coerce").dt.date
    df["birth_date"]        = pd.to_datetime(df["birth_date"],        errors="coerce").dt.date
    df["tenure_days"]       = pd.to_numeric(df["tenure_days"],        errors="coerce")

    print("  Salvando no banco...")
    df.to_sql("colaboradores", con=engine, if_exists="replace", index=False)

    ativos = len(df[df["status"] == "Ativo"])
    desl   = len(df[df["status"] == "Desligado"])
    com_gender = len(df[df["gender"].notna() & (df["gender"] != "")])
    com_etnia  = len(df[df["etnia"].notna()  & (df["etnia"]  != "")])
    print(f"  [OK] Banco: {len(df)} total | {ativos} ativos | {desl} desligados")
    print(f"  [OK] Diversidade: {com_gender} com genero | {com_etnia} com etnia")
    print("=" * 52)


if __name__ == "__main__":
    processar_e_salvar()
