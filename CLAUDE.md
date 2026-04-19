# gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools directly.

Available gstack skills:
- `/office-hours` — YC-style office hours, startup or hiring mode
- `/plan-ceo-review` — CEO/founder-mode plan review
- `/plan-eng-review` — Eng manager-mode plan review
- `/plan-design-review` — Designer's eye plan review
- `/design-consultation` — Product design research and recommendations
- `/design-shotgun` — Generate multiple AI design variants
- `/design-html` — Generate production-quality Tailwind/HTML
- `/review` — Pre-landing PR review
- `/ship` — Ship workflow: merge base, run tests, push
- `/land-and-deploy` — Merge PR, wait for CI, deploy
- `/canary` — Post-deploy canary monitoring
- `/benchmark` — Performance regression detection
- `/browse` — Fast headless browser for QA and dogfooding
- `/connect-chrome` — Launch AI-controlled Chromium
- `/qa` — Systematically QA test a web app and fix bugs
- `/qa-only` — Report-only QA (no fixes)
- `/design-review` — Visual QA for spacing, contrast, consistency
- `/setup-browser-cookies` — Import cookies from your real browser
- `/setup-deploy` — Configure deployment for /land-and-deploy
- `/retro` — Weekly engineering retrospective
- `/investigate` — Systematic debugging with root cause analysis
- `/document-release` — Post-ship documentation update
- `/codex` — OpenAI Codex CLI wrapper
- `/cso` — Chief Security Officer mode
- `/autoplan` — Auto-review pipeline (CEO + design + eng)
- `/plan-devex-review` — Developer experience plan review
- `/devex-review` — Live developer experience audit
- `/careful` — Safety guardrails for destructive commands
- `/freeze` — Restrict edits to a specific directory
- `/guard` — Full safety mode (destructive warnings + freeze)
- `/unfreeze` — Clear freeze boundary
- `/gstack-upgrade` — Upgrade gstack to the latest version
- `/learn` — Manage project learnings

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, save state, save my work → invoke context-save
- Resume, where was I, pick up where I left off → invoke context-restore
- Code quality, health check → invoke health
