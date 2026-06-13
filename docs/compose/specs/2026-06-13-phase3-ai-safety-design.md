# Phase 3: AI Safety & Governance — Design Spec

## [S1] Problem

The AI chat feature has several safety and governance gaps:
- No consent before sending data to LLM provider
- PII (names) were sent to provider (fixed in Phase 1, but needs redaction framework)
- Risk classifier exists but no human handoff path
- No documentation that AI output is not a diagnosis
- No cost/abuse protection beyond basic rate limit

## [S2] Solution Overview

7 focused improvements for AI safety:

### AI-001: Consent & Disclosure
Add a disclosure banner before first chat message explaining:
- Data is sent to a third-party AI provider
- What data is sent (message text only, no PII)
- Purpose (risk assessment, counseling guidance)
- User must click "Saya Setuju" before chatting

### AI-002: PII Redaction
Strip any accidental PII from messages before sending to LLM:
- Email addresses → [EMAIL]
- Phone numbers → [PHONE]
- Names (if somehow included) → [NAMA]

### AI-003: Unified Risk Classifier
Frontend `getRiskScore()` and backend `classifyRisk()` should use the same logic. Since backend is the source of truth, frontend should call backend for classification when available, fallback to local when offline.

### AI-004: Human Handoff
When risk level is "high", provide clear escalation path:
- Show emergency contacts immediately
- Offer to connect with campus counselor
- Log the escalation in audit trail

### AI-005: Evaluation Set
Create a test set of Indonesian messages covering:
- Self-harm keywords
- Violence keywords
- Sexual harassment keywords
- Negation ("tidak" + keyword)
- Slang/colloquial
- False positives
- Prompt injection attempts

### AI-006: Cost Protection
- Rate limit per IP (already exists)
- Add per-session rate limit
- Add message length validation
- Add timeout for LLM requests (already exists)
- Log 429 and provider errors

### AI-007: AI Disclaimer
Add clear disclaimer in chat UI:
- "SafeBot adalah asisten AI, bukan konselor atau profesional kesehatan mental"
- "Output AI bukan diagnosis medis atau hukum"
- "Untuk situasi darurat, hubungi kontak darurat"

## [S3] Implementation Order

| Step | Task | Priority |
|------|------|----------|
| 1 | AI-007: AI disclaimer in chat UI | Quick win |
| 2 | AI-001: Consent banner before chat | Quick win |
| 3 | AI-002: PII redaction | Medium |
| 4 | AI-004: Human handoff for high risk | Medium |
| 5 | AI-005: Evaluation test set | Medium |
| 6 | AI-006: Cost protection improvements | Medium |

## [S4] Success Criteria

- [ ] AI disclaimer visible in chat UI
- [ ] Consent banner shown before first message
- [ ] PII stripped from messages before LLM call
- [ ] High-risk messages show emergency contacts + escalation
- [ ] Test set covers key Indonesian safety scenarios
- [ ] Rate limit works per-session
