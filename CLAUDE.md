# teams-claude-bot (fork iamLukyy) — Eventuality Teams bot

Fork `Marvae/teams-claude-bot` (MIT): Teams bot, který je mostem do Claude Code session (Claude Agent SDK,
streaming). **Naše větev: `eventuality-deploy`**, `main` = upstream. Bot běží na **vps** (176.102.64.244)
v `/root/Projects/teams-claude-bot`; pracovní adresář session je `/root/Projects/flaskapp-caflou-checker`
(tam je CLAUDE.md s pravidly chování bota, skills, hook `caflou-write-guard`, `docs/TEAMS-BOT.md` = návrh + stav).

## Živé nasazení (stav 2026-09-07, 14:55)
| Co | Hodnota / kde |
|---|---|
| Registrace bota | **Teams Developer Portal** (dev.teams.microsoft.com → Tools → Bot management), bot `eventuality-bot`. Žádná Azure subscription — Eventuality ji nemá a nepotřebuje. Vzniká jako single tenant. |
| Bot ID = `MICROSOFT_APP_ID` | `f79a0dcf-5d1b-4299-af72-353b1ae61813` |
| Tenant ID | `6775b406-54a0-4379-8098-076badb7f49a` (eventuality.cz; veřejně z `login.microsoftonline.com/eventuality.cz/v2.0/.well-known/openid-configuration`) |
| `TEAMS_APP_ID` (id manifestu) | `30e786fe-e881-4f6c-a8a3-0a2d0ceefac0` |
| Client secret | jen v `/root/Projects/teams-claude-bot/.env` na vps (0600). Vytvořen v Developer Portal → bot → Client secrets. Při rotaci: nový secret tam, přepsat `.env`, restart služby. |
| Endpoint | Developer Portal → bot → Configure → `https://teamsbot.eventuality.app/api/messages` |
| Služba | `systemctl status teams-claude-bot` (enabled, běží od 2026-09-07 14:52), log `/var/log/teams-claude-bot.log`, `curl -s https://teamsbot.eventuality.app/healthz` |
| Balíček pro Teams | balí se **na Macu**: `node scripts/package-manifest.mjs f79a0dcf-5d1b-4299-af72-353b1ae61813 30e786fe-e881-4f6c-a8a3-0a2d0ceefac0` → `teams-claude-bot.zip` (na vps chybí `zip`). Nahrává se v Teams: Apps → Manage your apps → Upload a custom app. |
| Allowlisty | `ALLOWED_USERS` / `ALLOWED_CONVERSATIONS` v `.env` — po bootstrapu z `[AUTH]` řádků logu MUSÍ být vyplněné (Lukáš, Adélka, 1:1 chat + skupina). |
| Denní restart | `teams-claude-bot-restart.timer` (04:30) — zapnout po bootstrapu: `systemctl enable --now teams-claude-bot-restart.timer` |

## Čti nejdřív
- `docs/EVENTUALITY-DEPLOY.md` — runbook: Azure Bot registrace, `.env`, systemd, sideload, bootstrap allowlistů
- `deploy/` — systemd unit, denní restart timer, nginx site, šablona `.env`
- `README.md`, `docs/setup-guide.md` — upstream (dev tunnel a `teams-bot setup` **nepoužíváme**, endpoint dělá nginx)

## Co je v naší větvi navíc (vs. upstream 0.6.0)
| Oblast | Soubory | Env |
|---|---|---|
| Allowlist jen podle Entra object ID (nikdy jméno), i pro tlačítka karet | `src/bot/access.ts`, `src/bot/message.ts`, `src/index.ts` | `ALLOWED_USERS` |
| Zámek na konverzaci — cizí chaty i instalace tiše ignoruje | tamtéž | `ALLOWED_CONVERSATIONS` |
| Idle expirace: N h bez zpráv → session zavřena, další zpráva čistá (platí i přes restart) | `src/session/state.ts`, reaper v `src/index.ts` | `SESSION_IDLE_HOURS` (12) |
| Výchozí model | `src/session/state.ts` | `DEFAULT_MODEL` (opus) |
| Nástroje bez ptaní — root na vps **nesmí** `bypassPermissions` | `src/bot/bridge.ts` | `ALLOWED_TOOLS` |
| Nainstalovaný `claude` místo SDK-bundled `cli.js` | `src/claude/session.ts` | `CLAUDE_CLI_PATH` |
| `allowDangerouslySkipPermissions` jen na vyžádání — upstream ho posílá vždy a **root na vps s ním padá exit 1** (`--dangerously-skip-permissions cannot be used with root`) | `src/claude/session.ts` | `ALLOW_DANGEROUSLY_SKIP_PERMISSIONS` (0) |
| Manifest: scope `groupChat`, branding Eventuality | `manifest/manifest.json` | — |
| `/healthz`: model, idleHours, lastActivityAt | `src/index.ts` | — |

Z upstreamu zůstává: **jedna globální session** (ne per-user), SDK strippuje @označení (`mentions.stripText`),
streaming odpovědí, příkazy `/new /stop /model /permission /sessions /status`, tool-interceptor
(nástroj mimo `ALLOWED_TOOLS` se ptá kartou v Teams), `SESSION_INIT_PROMPT` (nepoužíváme, stačí CLAUDE.md checkeru).

## Workflow (standard pro tento projekt)
1. **Edituj lokálně** `~/Projects/teams-claude-bot` (Node ≥ 22; na Macu je 25).
2. `npm run typecheck && npm run lint && npm test && npm run build` — všechno zelené, teprve pak commit.
   Testy jsou vitest v `tests/`; config je mockovaný v `tests/setup.ts` → **nové pole v `src/config.ts` doplň i do mocku**.
3. Commit na `eventuality-deploy`, push. Na vps:
   ```bash
   ssh vps 'export PATH=/root/.local/node22/bin:$PATH; cd /root/Projects/teams-claude-bot && git pull --ff-only && npm ci && npm run build && systemctl restart teams-claude-bot && sleep 3 && curl -s https://teamsbot.eventuality.app/healthz'
   ```
4. Log: `/var/log/teams-claude-bot.log` (`[AUTH]` řádky = aad + conversation id pro allowlisty).
5. Upstream sync: `git fetch upstream && git merge upstream/main` do naší větve; konflikty čekej v `message.ts`, `state.ts`, `index.ts`.

## Nikdy
- Necommitovat `.env` (na vps `/root/Projects/teams-claude-bot/.env`, 0600). Auth Claude je `/root/.claude-oauth.env`
  (0600), sourcuje ho systemd unit — token Max účtu je dočasný, ostrý provoz = Console API klíč (ToS).
- Nespouštět bota s prázdnými allowlisty mimo bootstrap: kdo se dostane do povolené konverzace, má shell na
  produkčním vps s Caflou tokenem.
- Neotvírat `/api/handoff` ani devtools zvenku — nginx pouští jen `/api/messages` a `/healthz`.
- Zápisy do Caflou hlídá hook v checkeru, ne tento kód; log a undo jsou v `/root/caflou-bot/`.
