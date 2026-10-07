#!/usr/bin/env python3
"""Scheduler de sync — roda dentro do container Docker no servidor."""

import schedule
import time
import subprocess
import sys
import os
import datetime

PYTHON = sys.executable

def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

def run(label, cmd):
    log(f"START {label}")
    result = subprocess.run(cmd, cwd="/app")
    if result.returncode == 0:
        log(f"OK {label}")
    else:
        log(f"ERRO {label} (exit {result.returncode})")

def mes_atual():
    return datetime.date.today().strftime("%Y-%m")

def mes_anterior():
    hoje = datetime.date.today()
    primeiro = hoje.replace(day=1)
    ant = primeiro - datetime.timedelta(days=1)
    return ant.strftime("%Y-%m")

def sync_convenia():
    run("Convenia", [PYTHON, "/app/main.py"])

def sync_historico():
    run("Historico", [PYTHON, "/app/sync_historico.py"])

def sync_tiquetaque():
    run("TiqueTaque", [PYTHON, "/app/scripts/sync_ponto.py",
                       "--de", mes_anterior(), "--ate", mes_atual()])

def morning_sync():
    log("=== SYNC MANHA (09:00 BRT) ===")
    sync_convenia()
    sync_historico()
    sync_tiquetaque()

def evening_sync():
    log("=== SYNC TARDE (20:00 BRT) ===")
    sync_tiquetaque()

schedule.every().day.at("09:00").do(morning_sync)
schedule.every().day.at("20:00").do(evening_sync)

log("Scheduler iniciado (TZ=America/Sao_Paulo)")
log("  Manha 09:00: Convenia + Historico + TiqueTaque")
log("  Tarde 20:00: TiqueTaque")
log(f"  Proximo sync agendado: {schedule.next_run()}")

while True:
    schedule.run_pending()
    time.sleep(30)
