# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

IlliniClaw is a **spec-only repo** — no application code. It contains an architectural blueprint for building a WhatsApp-based AI teaching assistant. The spec is designed to be fed to an AI coding agent that builds the full system.

The source implementation lives in a private repo (`badm554-bot`). This repo publishes the architecture without exposing the code.

## Repo Structure

- `AGENT-PROMPT.md` — The main spec. This is the file users paste into their AI agent. It defines the complete system: tech stack, directory structure, database schema, message flows, API routes, deployment.
- `CUSTOMIZATION.md` — What to change and where (SOUL.md persona, knowledge base, guardrails, drip campaigns).
- `reference/` — Supporting files: SQL schema, env template, example SOUL.md, drip campaign script, guardrail topics.
- `README.md` — Public-facing overview with architecture diagram.

## Key Constraint

**Never link to or reference the private source repo** (`badm554-bot` or `gies-ai-experiments`). Describe the architecture; don't point to the implementation.

## When Editing

Changes to the spec should reflect the actual `badm554-bot` architecture. If the source system evolves (new features, changed patterns), update `AGENT-PROMPT.md` and `CUSTOMIZATION.md` to match. Keep reference files in sync with the schema and patterns described in the spec.
