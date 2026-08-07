# ArchitectAI — UI Design Principles

## Identity

ArchitectAI is an engineering workspace. Not a chatbot.

Think: VS Code + GitHub + Linear + Vercel.

## What ArchitectAI Is NOT

- NOT a conversational AI interface
- NOT ChatGPT, Claude, or Gemini in a wrapper
- NOT a chat history with AI responses
- NOT a place for speech bubbles or "AI is thinking" spinners

## Core Concepts

- The primary concept is a **Project**, not a Conversation
- The primary workflow is an **Engineering Pipeline**, not a chat history
- Artifacts (Requirements, Architecture, Tasks) are **first-class documents**
- Generation progress is shown as **pipeline stages**, not typing indicators

## Visual Language

- Clean, minimalist aesthetic
- Neutral colors (gray, white, slate) with subtle blue accents
- Information-dense layouts
- Professional Markdown rendering for documents
- Monospace for IDs, metadata, and code references
- System fonts, no decorative typography

## Engineering Metadata

Surface these naturally in the UI — not hidden in modals:

- LLM provider and model used
- Prompt version
- Generation duration
- Token usage
- Context window utilization
- Retry count (if applicable)
- Artifact chain (spec → architecture → tasks)

## DO

- Show artifacts as readable documents with sections, headings, and structured data
- Use pipeline/kanban-style progress (stages with status indicators)
- Display provenance metadata inline (subtle, not dominant)
- Use cards, tables, and lists for structured information
- Make every pixel communicate engineering information

## DO NOT

- Gradients or glowing effects
- Robot icons or AI avatars
- Speech bubbles or chat-style layouts
- "AI is thinking" animation
- Typewriter effects on output
- Decorative illustrations
- Dark/light theme toggle (use light theme, period)
- Excessive whitespace without purpose

## Reference Aesthetic

The feel of:

- GitHub's code review interface (information density)
- Linear's project boards (clean, fast, professional)
- Vercel's deployment pipeline (clear stages)
- VS Code's sidebar panels (compact, functional)

## Goal

Users should feel they are working in a **modern software engineering tool** that happens to use AI — not chatting with an assistant that happens to produce documents.
