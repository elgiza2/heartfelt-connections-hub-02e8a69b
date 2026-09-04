# Roadmap

- [x] Copy full project from GitHub repo
- [x] Telegram media storage schema (storage only — no bot/tasks features)
- [x] Storage buckets + policies
- [x] Keys stored: Browser Use, Pipedream (client id/secret + project id), Kashier, Telegram bot + storage chat, Plus AI (slides)
- [x] Remove "Continue with GitHub" sign-in (GitHub token is for the coding agent only)
- [x] Keys stored: DODO_PAYMENTS_API_KEY, DODO_WEBHOOK_SECRET, DEAPI_API_KEY, RENDERFUL_API_KEY
- [x] Dodo checkout + signed webhook (global) alongside Kashier (Arabic users)
- [x] Dodo product IDs mapped in dodo_products (monthly / monthly_intro / monthly_winback / yearly / yearly_winback)
- [x] Video quota: video_quota_usage + plan-aware consume_video_quota (Free 3 / Pro 40 / Elite 120)
- [x] DeAPI + Renderful wired for images (anything-api) and video (media-video / media-video-poll)
- [x] Plus AI slides pipeline verified (chat-slides-stream → background_jobs → done)
- [x] Browser Use computer agent with model fallback ladder
- [x] Coding agent (kimi-coder) SSE + skills import (import-skill)
- [x] Referral tiers + reward tasks seeded, UI reads them
- [x] Test account created and saved to TEST_ACCOUNT.md, all services tested end-to-end
- [ ] Web search needs one API key: BRAVE_API_KEY, TAVILY_API_KEY or SERPER_API_KEY (code paths ready)

- [x] Serper search key: read env names `serper`/`SERPER`/`SERPER_API_KEY` in _shared/search/webSearchCore.ts
- [ ] GLM model: not served by abliteration.ai (/v1/models = abliterated-model, -large, -large-v2). Needs a GLM provider key (z.ai) to switch.

## Chat UI/UX pass — 2026-09-04
Done:
- Smaller, calmer chat typography (Arabic/English/other), no gradient headings
- Message action buttons: no springy rotate/scale, no shadows
- Composer: removed focus scale jitter, softened tap/enter animations
- Deep research now calls the deployed edge function (was hitting a dev-only /api route)
- Removed the duplicate "Files" button under project results

Open:
- Raw JSON/tool output still leaks into some chat messages
- Agent-delivered files/reports should render as clean clickable cards with preview
- Slides: blank-slide generation, model picker, thinking display, deck card + viewer redesign (sticky download/orientation, floating back)
- Image generation panel redesign
- Move image/video/slides model pickers into the composer
- Plus menu + chips redesign
- Integrations sheet opens slowly
