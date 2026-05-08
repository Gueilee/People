"""
ETL: Histórico de Cargos e Salários
Importa o Excel exportado do Convenia para a tabela historico_cargo_salario no SQLite.
"""
import pandas as pd
from sqlalchemy import create_engine
import datetime
import os

DB_PATH = "sqlite:///../database/vendemmia_people.db"
engine  = create_engine(DB_PATH)

EXCEL_PATH = os.path.join(os.path.dirname(__file__), "..", "Histórico cargos e salários.xlsx")


def extrair_area_unidade(dept_str: str) -> tuple[str, str]:
    """'Fiscal - Vila Olímpia' → ('Fiscal', 'Vila Olímpia')"""
    if pd.isna(dept_str) or not str(dept_str).strip():
        return "", ""
    s = str(dept_str).strip()
    if " - " in s:
        partes = s.split(" - ", 1)
        return partes[0].strip(), partes[1].strip()
    return s, ""


def classificar_tipo(motivo: str) -> str:
    """Agrupa os motivos em categorias analíticas."""
    if pd.isna(motivo):
        return "outro"
    m = str(motivo).lower().strip()
    if "admissao" in m or "admissão" in m:
        return "admissao"
    if "promocao" in m or "promoção" in m or "enquadramento de funcao" in m or "enquadramento de função" in m or "alteracao de funcao" in m or "alteração de função" in m:
        return "promocao"
    if "merito" in m or "mérito" in m or "reajuste" in m or "espontaneo" in m or "espontâneo" in m:
        return "reajuste_merito"
    if "acordo coletivo" in m or "dissidio" in m or "dissídio" in m:
        return "reajuste_coletivo"
    if "enquadramento salarial" in m:
        return "reajuste_salarial"
    if "reestruturacao" in m or "reestruturação" in m:
        return "reestruturacao"
    if "reducao" in m or "redução" in m:
        return "outro"
    return "outro"


def parse_data(val) -> str | None:
    """Converte string de data para ISO ou None."""
    if pd.isna(val):
        return None
    s = str(val).strip()
    if not s or s.lower() in ("nao informado", "não informado", "nan"):
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def processar_excel() -> pd.DataFrame:
    print(f"  Lendo: {EXCEL_PATH}")
    df = pd.read_excel(EXCEL_PATH, dtype=str)

    df.columns = [c.strip() for c in df.columns]
    df = df.rename(columns={
        "Nome do colaborador":    "nome",
        "CPF do colaborador":     "cpf",
        "Vínculo":                "vinculo",
        "Cargo":                  "cargo",
        "Departamento":           "departamento_raw",
        "Centro de custo":        "centro_custo",
        "De":                     "data_inicio_raw",
        "Até":                    "data_fim_raw",
        "Motivo":                 "motivo",
    })

    # Área e unidade
    df[["area", "unidade"]] = df["departamento_raw"].apply(
        lambda x: pd.Series(extrair_area_unidade(x))
    )

    # Datas
    df["data_inicio"] = df["data_inicio_raw"].apply(parse_data)
    df["data_fim"]    = df["data_fim_raw"].apply(parse_data)
    df["is_current"]  = df["data_fim_raw"].apply(
        lambda x: str(x).strip().lower() in ("nan", "nao informado", "não informado", "")
    ).astype(int)

    # Duração em dias
    hoje = datetime.date.today().isoformat()
    def calc_duracao(row) -> int | None:
        d1 = row["data_inicio"]
        d2 = row["data_fim"] if row["data_fim"] else hoje
        if not d1:
            return None
        try:
            return (datetime.date.fromisoformat(d2) - datetime.date.fromisoformat(d1)).days
        except Exception:
            return None

    df["duracao_dias"] = df.apply(calc_duracao, axis=1)

    # Tipo de evento
    df["tipo_evento"] = df["motivo"].apply(classificar_tipo)

    # Campos finais
    resultado = df[[
        "nome", "cpf", "vinculo", "cargo", "departamento_raw",
        "area", "unidade", "centro_custo", "motivo", "tipo_evento",
        "data_inicio", "data_fim", "is_current", "duracao_dias",
    ]].rename(columns={"departamento_raw": "departamento"})

    # Normaliza nome para UPPER
    resultado["nome"] = resultado["nome"].str.strip().str.upper()

    print(f"  Total: {len(resultado)} registros")
    print(f"  Colaboradores únicos: {resultado['nome'].nunique()}")
    print(f"  Motivos:", dict(resultado["motivo"].value_counts()))

    return resultado


def main():
    print("=" * 52)
    print("  ETL Historico Cargos e Salarios")
    print("=" * 52)

    try:
        df = processar_excel()
    except FileNotFoundError:
        print(f"  [ERRO] Arquivo nao encontrado: {EXCEL_PATH}")
        return

    print("  Salvando tabela historico_cargo_salario...")
    df.to_sql("historico_cargo_salario", con=engine, if_exists="replace", index=True,
              index_label="id")

    # Verificação
    df_check = pd.read_sql("SELECT COUNT(*) as n FROM historico_cargo_salario", con=engine)
    print(f"  [OK] {int(df_check.iloc[0]['n'])} linhas salvas.")

    promo = pd.read_sql(
        "SELECT COUNT(*) as n FROM historico_cargo_salario WHERE tipo_evento='promocao'",
        con=engine
    )
    print(f"  [OK] Promocoes: {int(promo.iloc[0]['n'])}")
    print("=" * 52)


if __name__ == "__main__":
    main()
