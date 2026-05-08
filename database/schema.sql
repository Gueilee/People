-- VENDEMMIA PEOPLE — Schema do banco de dados
-- Gerado automaticamente pelo pipeline ETL (backend/main.py)
-- Todos os campos de desligamento ficam na tabela principal (espelha a API Convenia)

CREATE TABLE IF NOT EXISTS colaboradores (
    id_colaborador    VARCHAR(255) PRIMARY KEY,
    nome              VARCHAR(255),
    email             VARCHAR(255),
    unidade           VARCHAR(100),
    departamento      VARCHAR(100),
    cargo             VARCHAR(150),
    gestor            VARCHAR(255),
    data_admissao     DATE,
    -- NULL = colaborador ativo | data preenchida = desligado (campo dismissal.date na API)
    data_desligamento DATE,
    -- Mapeado de dismissal.type.title na API Convenia
    tipo_desligamento VARCHAR(100),
    status            VARCHAR(20) DEFAULT 'Ativo'
);

CREATE INDEX IF NOT EXISTS idx_colab_status  ON colaboradores(status);
CREATE INDEX IF NOT EXISTS idx_colab_unidade ON colaboradores(unidade);
CREATE INDEX IF NOT EXISTS idx_colab_dep     ON colaboradores(departamento);
CREATE INDEX IF NOT EXISTS idx_colab_gestor  ON colaboradores(gestor);
CREATE INDEX IF NOT EXISTS idx_colab_desl_dt ON colaboradores(data_desligamento);
CREATE INDEX IF NOT EXISTS idx_colab_adm_dt  ON colaboradores(data_admissao);
