Automated Apex 200K Trading Assistant (Headless, CLI-first)

Overview
- Headless FastAPI microservices to turn TradingView alerts into validated LIMIT orders for NinjaTrader via file-drop.
- Vision via codex CLI with image input; no OpenAI API calls in code.
- Deterministic gatekeeper ensures ATR-bounded SL/TP, R≥1.5, spread, windows, and sizing constraints.
- Risk engine enforces Apex-style rules: daily loss, trailing drawdown, max contracts, and margin feasibility.
- Execution emits `order.json` into `NT_BRIDGE_DIR` for a NinjaScript strategy to place entry LIMIT with OCO SL/TP.
- Zero GUI. Everything runs from shell on Ubuntu.

Components
- server/rx.py: POST /rx receives TradingView webhooks, orchestrates screenshot → LLM → checks → execution.
- server/shot.py: Playwright Chromium screenshotter (1280x720).
- server/llm_cli.py: shells out to `codex -i chart.png "<prompt>"`, extracts STRICT JSON.
- server/decision_schema.py: Pydantic models for strict decision validation.
- server/gatekeeper.py: deterministic checks (R, ATR bounds, windows, spread, sizing).
- server/risk_api.py: in-memory risk controls and state; /can_open, /register_fill, /limits, /panic.
- server/exec_route.py: validates again and writes `order.json` atomically to `NT_BRIDGE_DIR`.
- ninjatrader/BridgeFileDrop.cs: NinjaTrader 8 Strategy sample to read `order.json` and submit unmanaged OCO.
- scripts/: install, run services, codex wrapper, and a glue script.
- systemd/: unit files to run services at boot.
- server/tests/: sample data and a local smoke script.

Quick Start (Ubuntu)
1) Install dependencies
- Run: scripts/install.sh
- This creates `.venv`, installs FastAPI/httpx/pydantic/pyyaml/playwright, and downloads Chromium.

2) Configure environment
- Copy `configs/env.sample` to `.env` and adjust:
  - `NT_BRIDGE_DIR=~/NT_bridge`
  - `TV_CHART_URL=https://www.tradingview.com/chart/XXXX/?symbol={sym}&interval={tf}`
  - `RISK_API_URL=http://127.0.0.1:8081`
  - `EXEC_API_URL=http://127.0.0.1:8082`

3) Codex CLI auth
- Install and authenticate `codex` CLI as needed.
- Test: codex "hello" should return a response.
- Vision calls are made via: codex -i /tmp/chart.png "<prompt>"

4) Run services (dev)
- Start all three: scripts/run-dev.sh
- Services:
  - /rx on 0.0.0.0:8080
  - /risk on 127.0.0.1:8081
  - /exec on 127.0.0.1:8082

5) End-to-end smoke (no LLM)
- With services running: server/tests/test_local_smokebench.sh
- It posts a prepared good plan directly to /execute and verifies `order.json` appears.

TradingView Webhook
- URL: http://YOUR_SERVER:8080/rx
- JSON payload fields:
  {
    "symbol":"ES", "tf":"5", "time_iso":"2025-01-01T00:00:00Z",
    "atr":2.0, "spread_ticks":1, "session":"RTH",
    "structure": {...}, "liquidity": {...}
  }
- The receiver builds `TV_CHART_URL` with {sym}/{tf}, screenshots, runs codex prompt, validates, checks risk, and emits order.

LLM Prompt Rules
- File: server/prompts/prompt_limit.txt
- JSON-only output. LIMIT entries only. GTT ≤ 5 minutes. R ≥ 1.5.
- SL ∈ [0.8,1.2]*ATR; TP ∈ [1.2,3.0]*ATR.
- Respect max_contracts and risk_pct from FEATURES; otherwise "avoid".
- FEATURES(JSON) is appended to the prompt.

Gatekeeper Checks
- Validates JSON completeness and types (Pydantic).
- Time window: `good_until` must be within 5 minutes after `features.time_iso`.
- R ≥ R_min; SL/TP within ATR bounds; contracts ≤ max_contracts; risk heat ≤ max_heat.
- Blocks configured no-trade hours and if spread/ATR ratio exceeds limit.

Risk Engine (risk_api)
- State: equity, peak, day PnL. Loads limits from configs/apex200k.yaml.
- /can_open: projects risk (distance to SL × point_value × contracts), checks:
  - daily loss limit
  - trailing drawdown vs peak
  - risk percent per trade
  - max contracts and margin feasibility
- /register_fill: updates equity and day PnL.
- /limits: returns state/config; /panic: flips a kill switch honored by execution.

Execution (exec_route)
- Re-validates decision via gatekeeper and asks risk_api again.
- Writes `order.json` atomically into `NT_BRIDGE_DIR`.
- Logs JSONL under `logs/orders/`.

Manual Glue (auto_trade.sh)
- scripts/auto_trade.sh runs: screenshot → codex → /can_open → /execute using a features file.
- Example: scripts/auto_trade.sh server/tests/sample_features.json

NinjaTrader Bridge
- File: ninjatrader/BridgeFileDrop.cs
- Strategy polls a mapped Windows path (e.g., `C:\NTBridge\order.json`) and places unmanaged LIMIT entry with OCO SL/TP.
- Delete the file after placing to avoid duplicates.
- On TP/SL fill, you can add code to call `http://127.0.0.1:8081/register_fill` with realized PnL.

Mapping NT_BRIDGE_DIR to Windows
- Samba example:
  - On Ubuntu:
    - sudo apt-get install -y samba
    - sudo mkdir -p /home/ubuntu/NT_bridge
    - sudo chown -R "$USER":"$USER" /home/ubuntu/NT_bridge
    - Add to /etc/samba/smb.conf:
      [NTBridge]
      path = /home/ubuntu/NT_bridge
      browseable = yes
      read only = no
      guest ok = yes
    - sudo systemctl restart smbd
  - On Windows: Map network drive to \\UBUNTU_HOST\NTBridge and point NinjaTrader strategy to the `order.json` path.

Systemd Services
- Edit `WorkingDirectory` in systemd/*.service to your repo path (e.g. /opt/trader-repo).
- Copy units:
  - sudo cp systemd/*.service /etc/systemd/system/
  - sudo systemctl daemon-reload
  - sudo systemctl enable --now trader-risk.service trader-exec.service trader-rx.service

Troubleshooting
- codex not found: ensure CLI is installed and in PATH.
- Playwright errors: run `python -m playwright install chromium` and ensure server has lib dependencies.
- /rx returns gatekeeper error: check ATR/SL/TP distances, R, spread/tick settings, and time windows.
- Risk denied: check /limits response and `configs/apex200k.yaml`.
- No order.json: check Exec logs and NT_BRIDGE_DIR path mapping.

Safety Notes
- LIMIT only; OCO assumed; GTT ≤ 5 minutes.
- Panic switch: POST /panic on risk_api to block new entries.
- Logs in `logs/`; orders JSONL in `logs/orders/`.

FAQ
- Can I run without NinjaTrader? Yes. The pipeline still runs and emits `order.json`.
- How do I test LLM? Manually run: `python -m server.llm_cli --features server/tests/sample_features.json --prompt server/prompts/prompt_limit.txt --image /tmp/chart.png`
- How do I change limits? Edit `configs/apex200k.yaml` and restart services.

File Paths
- configs/apex200k.yaml
- configs/env.sample
- server/__init__.py
- server/rx.py
- server/shot.py
- server/llm_cli.py
- server/prompts/prompt_limit.txt
- server/decision_schema.py
- server/gatekeeper.py
- server/risk_api.py
- server/exec_route.py
- server/tests/sample_features.json
- server/tests/sample_plan_good.json
- server/tests/sample_plan_bad.json
- server/tests/test_local_smokebench.sh
- ninjatrader/BridgeFileDrop.cs
- scripts/install.sh
- scripts/run-dev.sh
- scripts/run_codex.sh
- scripts/auto_trade.sh
- systemd/trader-*.service
- logs/.gitkeep

