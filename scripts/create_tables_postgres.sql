-- DDL: criação das tabelas no Azure PostgreSQL — banco: vdm_projetos
-- Execute uma vez antes do primeiro uso do sistema.
-- As tabelas colaboradores e historico_cargo_salario são criadas automaticamente pelo pandas to_sql.

CREATE TABLE IF NOT EXISTS usuarios (
    id           SERIAL PRIMARY KEY,
    nome         TEXT NOT NULL,
    email        TEXT,
    login        TEXT NOT NULL UNIQUE,
    senha_hash   TEXT,
    role         TEXT NOT NULL DEFAULT 'viewer',
    ativo        INTEGER NOT NULL DEFAULT 1,
    reset_token  TEXT,
    reset_expiry INTEGER,
    created_at   INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
);

CREATE TABLE IF NOT EXISTS vagas_recrutamento (
    id                      SERIAL PRIMARY KEY,
    responsavel             TEXT,
    data_abertura           TEXT,
    data_fechamento         TEXT,
    sla_dias                INTEGER,
    cargo                   TEXT,
    novo_colaborador        TEXT,
    status                  TEXT DEFAULT 'Aberta',
    motivo                  TEXT,
    tipo_substituicao       TEXT,
    colaborador_substituido TEXT,
    centro_custo            TEXT,
    unidade                 TEXT,
    gestor                  TEXT,
    data_inicio             TEXT,
    fonte                   TEXT,
    observacoes             TEXT,
    criado_em               TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS ponto_mensal (
    id                    SERIAL PRIMARY KEY,
    employee_id           TEXT NOT NULL,
    cpf                   TEXT,
    nome                  TEXT,
    departamento          TEXT,
    cargo                 TEXT,
    filial                TEXT,
    mes                   TEXT NOT NULL,
    horas_normais         DOUBLE PRECISION DEFAULT 0,
    total                 DOUBLE PRECISION DEFAULT 0,
    banco_horas           DOUBLE PRECISION DEFAULT 0,
    extra_50              DOUBLE PRECISION DEFAULT 0,
    extra_60              DOUBLE PRECISION DEFAULT 0,
    extra_100             DOUBLE PRECISION DEFAULT 0,
    atraso                DOUBLE PRECISION DEFAULT 0,
    falta_injustificada   DOUBLE PRECISION DEFAULT 0,
    atestado              DOUBLE PRECISION DEFAULT 0,
    abono                 DOUBLE PRECISION DEFAULT 0,
    ferias                DOUBLE PRECISION DEFAULT 0,
    afastamento_nao_rem   DOUBLE PRECISION DEFAULT 0,
    dispensa_legal        DOUBLE PRECISION DEFAULT 0,
    adicional_noturno     DOUBLE PRECISION DEFAULT 0,
    hora_noturna_reduzida DOUBLE PRECISION DEFAULT 0,
    dsr                   DOUBLE PRECISION DEFAULT 0,
    synced_at             TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
    UNIQUE(employee_id, mes)
);
