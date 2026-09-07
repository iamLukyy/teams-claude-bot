# Eventuality Teams bot — nasazení na vps (176.102.64.244)

Bot = tento fork `Marvae/teams-claude-bot` + Claude Code session v `/root/Projects/flaskapp-caflou-checker`
(6 Caflou skills, `NAUCENO.md`, hook `caflou-write-guard`). Návrh a stav: `flaskapp-caflou-checker/docs/TEAMS-BOT.md`.

```
Teams (1:1 nebo skupina, @Eventuality Bot)
  → Azure Bot Service (Teams channel)
    → https://teamsbot.eventuality.app/api/messages   (nginx, Let's Encrypt; jen /api/messages + /healthz)
      → 127.0.0.1:3978  node dist/index.js            (systemd teams-claude-bot.service, Node 22 v /root/.local/node22)
        → Claude Agent SDK → /root/.local/bin/claude   (cwd = flaskapp-caflou-checker, model opus)
```

## Co je hotové (2026-09-07)
- Node 22 izolovaně v `/root/.local/node22` (systémový Node 20 pro ostatní služby nedotčen).
- nginx site `teamsbot.eventuality.app` + certifikát. `/` vrací 404, `/api/handoff` není zvenku dostupný.
- Fork s úpravami (branch `eventuality-deploy`): AAD allowlist (bez jmen) i pro tlačítka karet, zámek na
  konverzaci (`ALLOWED_CONVERSATIONS`), idle 12 h → nová session (`SESSION_IDLE_HOURS`), Opus výchozí,
  `ALLOWED_TOOLS` (root nesmí bypass), `CLAUDE_CLI_PATH`, manifest se scope `groupChat`.
- systemd unit + denní restart timer (04:30) v `deploy/`.
- Auth Claude: `/root/.claude-oauth.env` (setup-token, 0600) — sdílí limity Lukášova Max účtu; pro ostrý
  provoz vyměnit za Console API klíč (ToS).

## Krok A — registrace bota (HOTOVO 2026-09-07 přes Teams Developer Portal)
Azure Portal cesta z upstream návodu vyžaduje Azure subscription, kterou Eventuality nemá. Funkční cesta bez ní:
1. https://dev.teams.microsoft.com (admin tenantu) → **Tools → Bot management → + New Bot** → jméno → Add.
   Bot vzniká jako **single tenant**, v Entra se automaticky založí service principal.
2. Bot → **Configure → Endpoint address** = `https://teamsbot.eventuality.app/api/messages` → Save.
3. Bot → **Client secrets → Add a client secret** → hodnotu hned opsat (zobrazí se jen jednou).
4. **Bot ID** ze seznamu Bot management = `MICROSOFT_APP_ID`. Tenant ID: Entra → Overview, nebo veřejně
   `curl -s https://login.microsoftonline.com/eventuality.cz/v2.0/.well-known/openid-configuration` (pole `issuer`).
5. Teams admin center: **Manage apps → Org-wide app settings → Custom apps = On** a
   **Setup policies → Global → Upload custom apps = On** (propisuje se až hodiny).

Aktuální hodnoty: Bot ID `f79a0dcf-5d1b-4299-af72-353b1ae61813`, tenant `6775b406-54a0-4379-8098-076badb7f49a`,
`TEAMS_APP_ID` `30e786fe-e881-4f6c-a8a3-0a2d0ceefac0`. Secret jen v `.env` na vps.

## Krok B — Claude (po dodání údajů)
```bash
ssh vps
cd /root/Projects/teams-claude-bot
# .env: doplnit MICROSOFT_APP_ID / MICROSOFT_APP_PASSWORD / MICROSOFT_APP_TENANT_ID (chmod 600)
# zip se balí na Macu (na vps není `zip`): node scripts/package-manifest.mjs <BotID> <TEAMS_APP_ID>
systemctl enable --now teams-claude-bot.service
curl -s https://teamsbot.eventuality.app/healthz
```
Bootstrap allowlistů: první zpráva od Lukáše se zaloguje jako `[AUTH] message from aad=… conv=…`
(`/var/log/teams-claude-bot.log`). Tyto hodnoty (Lukáš + Adélka, id skupinového chatu) zapsat do
`ALLOWED_USERS` / `ALLOWED_CONVERSATIONS`, `systemctl restart teams-claude-bot`, pak
`systemctl enable --now teams-claude-bot-restart.timer`.

## Krok C — instalace do Teams
Teams → Apps → Manage your apps → **Upload a custom app** → `teams-claude-bot.zip`.
Skupina: v chatu s Adélkou „+ Přidat aplikaci" → Eventuality Bot. Ve skupině reaguje jen na `@Eventuality Bot …`.

## Provoz
- Log: `/var/log/teams-claude-bot.log` · zdraví: `/healthz` (model, idle, session) · `systemctl status teams-claude-bot`
- Idle: 12 h bez zprávy → session zavřena, další zpráva začíná čistě. Denní restart 04:30 (session se obnoví, pokud není idle).
- Zápisy do Caflou: jen po potvrzení (hook `caflou-write-guard` v checkeru), write-log a undo v `/root/caflou-bot/`.
- Paměťový strop 3 GB na celou cgroup (Node + claude). Přílohy z Teams se nepoužívají — soubory jdou přes Caflou.
