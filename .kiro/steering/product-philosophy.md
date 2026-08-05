# ArchitectAI — Product Philosophy

## What ArchitectAI IS

ArchitectAI is an **AI Software Architect**. Not a coding assistant. Not a chatbot. Not a code generator.

Its purpose is to transform an initial software idea into a complete engineering package ready for implementation — the kind of deliverable an experienced software architect produces before a team writes a single line of code.

## What ArchitectAI Produces

A generated project should contain a professional engineering package:

```
README.md
01_Product_Vision.md
02_Requirements.md
03_Architecture.md
04_ADRs.md
05_API_Design.md
06_Database_Design.md
07_Implementation_Plan.md
08_Tasks.md
09_Risk_Assessment.md
10_Deployment.md
```

The exact structure may evolve, but the goal is documentation comparable to what a senior software architect would deliver to a development team.

## Quality Over Quantity

ArchitectAI optimizes for engineering quality over feature quantity. New capabilities should only be added if they improve the usefulness of the engineering package without significantly increasing architectural complexity.

## AI Philosophy

LLMs are collaborators, not decision makers. ArchitectAI should:

- **Generate** — produce structured artifacts from natural language
- **Validate** — check its own output for structural correctness
- **Explain** — provide reasoning for architectural decisions
- **Iterate** — refine output based on user feedback

But it must never assume its output is correct without verification. Human review remains part of the process. The system produces drafts, humans make decisions.

## Target Output Quality

Generated artifacts should be:

- Structured and navigable
- Consistent with engineering principles (SOLID, Clean Architecture, DDD)
- Actionable by a development team without further interpretation
- Versioned and reproducible (same input + model + prompt = similar output)
- Honest about limitations and assumptions
