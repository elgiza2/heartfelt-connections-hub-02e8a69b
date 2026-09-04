# Roadmap

## Email (done)
- [x] Store SMTP settings (Hostinger, port 465) as secrets
- [x] Build + deploy `send-email` (invites, welcome, codes) — tested, delivered
- [x] Store IMAP settings + inbound secret; `mail-poll` works (x-cron-key)
- [x] Cron: run `mail-poll` every 5 minutes
- [x] Told user the DNS records needed (SPF / DKIM / DMARC)
- [ ] User action: Supabase Auth custom SMTP + Send Email hook (`auth-email-hook`)

## Backend functions (built + deployed)
- [x] `media-video`, `media-video-poll`, `memory-extract`
- [x] `slides-api`, `chat-slides-stream`, `docs-generate`
- [x] `pipedream-connect`, `oauth-github-connect`, `github-push`, `oauth-authorize`
- [x] `report-error`, `operator-orchestrator`, `kashier-checkout`, `telegram-tasks-bot`
- [x] `mcp-gateway`, `web-search`, `read-url` (ported off the dev-only /api routes)
- [ ] `deep-research`, `transcribe` (port in progress)
- [ ] Remaining dev-only /api routes: integration-app-token, anything, manus-admin, dev-admin, dev-agent, computer-agent, long-run, clerk

## Verification
- [x] Chat streaming works; goes straight to the deployed function in production
- [ ] All settings pages verified while signed in
- [ ] In-chat features verified (tools, thinking, slides, research, media)

## Secrets still needed from the user
- [ ] `BROWSER_USE_API_KEY` (cloud.browser-use.com) — Computer Use
- [ ] `PIPEDREAM_CLIENT_ID`, `PIPEDREAM_CLIENT_SECRET`, `PIPEDREAM_PROJECT_ID`
- [ ] `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- [ ] `KASHIER_MERCHANT_ID`, `KASHIER_API_KEY`, `KASHIER_SECRET`
- [ ] `TELEGRAM_BOT_TOKEN`
- [ ] Alibaba/DashScope key row in `media_provider_keys` (video)
