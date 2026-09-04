# Project knowledge

1. Russian Obsidian documentation is canonical for planning, decisions, roadmap, and manual evidence: `/Users/jjuchara/Documents/MySecondBrain/1. Projects/Проектирование workflow Obsidian + Goodnotes (Essential).md` ([open in Obsidian](obsidian://open?vault=MySecondBrain&file=1.%20Projects%2F%D0%9F%D1%80%D0%BE%D0%B5%D0%BA%D1%82%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5%20workflow%20Obsidian%20%2B%20Goodnotes%20%28Essential%29.md)). Read it and its linked project folder before changing the workflow.
2. This repository contains the Obsidian plugin implementation and its operational contracts. Do not create English mirrors of product planning. English repository documentation is limited to code-adjacent usage, maintenance, verification, architecture, and release contracts.
3. Goodnotes Essential is a hard product boundary. Never design around Goodnotes Cloud, direct cloud storage integration, AI Meeting Assistant, private collaboration, or another Pro-only capability without a new explicit decision in the canonical Obsidian docs.
4. Preserve explicit user control: capture begins from a Share Sheet action; Cancel performs no write; ordinary capture never overwrites or deletes a source artifact. A confirmed edit session may fully replace only its linked exported copy after format and hash checks, while the editable Goodnotes original remains unchanged.

# Documentation gate

Before a commit, update the Russian Obsidian source of truth first when behavior, decisions, roadmap, or manual evidence changes. Then run `npm run check` for the plugin and `git diff --check` for repository text changes. Manual Goodnotes, Share Sheet, ObSync, and mobile Obsidian evidence remains a separate gate and must not be inferred from automated checks.

<!-- project-agent-factory:start -->
# Project agents for Проектирование workflow Obsidian + Goodnotes (Essential)

Project agent documentation lives in `.projectAgents/`.

- Read `.projectAgents/AGENTS.md` first.
- Project context: `.projectAgents/context/project-intelligence/`
- Rules: `.projectAgents/docs/`
- Evidence: `.projectAgents/evidence/index.json`
- Team memory: `.projectAgents/memory/MEMORY.md`
- Generated files must be updated through Project Agent Factory; do not edit them manually.
<!-- project-agent-factory:end -->
