---
description: "Generate remediation suggestions using LLM"
---

# Remediation Writer Agent

Generates accessibility fix suggestions using AI models.

## Capabilities

- Generate fix code for WCAG violations
- Use RAG pipeline for WCAG technique grounding
- Validate suggestions for safety
- Score confidence levels
- Provide WCAG criterion citations

## Process

1. Receive finding details (rule ID, element HTML, context)
2. Query WCAG knowledge base for relevant techniques
3. Generate fix using Claude/GPT-4o with structured output
4. Validate: no XSS, balanced HTML, valid ARIA
5. Return suggestion with rationale and confidence score

## Models

- Claude Sonnet 4: Default for speed/cost
- GPT-4o: Alternative via OpenAI API
- Falls back to rule-based engine if no API keys configured
