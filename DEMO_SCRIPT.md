# 60–90 Second Demo Script

## 0–10s — Problem
“Voice is convenient, but operational commands are unsafe if one critical field is misheard. This prototype puts a human verification gate between speech and action.”

Show the Voice Operations Console landing screen and the five-step flow.

## 10–30s — Real AssemblyAI voice input
Click **Start microphone**.

Say clearly:

> Send a quote for 12 million VND to Customer A tomorrow.

Show the live AssemblyAI transcript appearing. Click **Stop & finalize**.

## 30–50s — Structured verification
Show:
- Action: send quote
- Recipient: Customer A
- Amount: 12,000,000 VND — marked critical
- Date: tomorrow

Say:

“The transcript is not execution authority. The system extracts operational fields and highlights the critical amount.”

## 50–65s — Human gate
Click **Read back aloud**.

Say:

“Before anything becomes executable, the system reads the interpreted command back and requires an explicit human decision.”

Click **Confirm**.

## 65–80s — Evidence
Show the JSON receipt and `EXECUTION_READY` state.

Say:

“The receipt records the original voice transcript, AssemblyAI session, extracted fields, critical-field verification, and explicit confirmation. No external side effect is performed in this demo.”

## 80–90s — Close
“Voice Operations Console turns spoken intent into verified, auditable, human-approved operations.”

## Recording checklist
- Keep browser zoom so transcript, fields, and buttons are readable.
- Show the AssemblyAI realtime status.
- Do not expose the AssemblyAI API key or environment settings.
- Use one clean take if possible.
- Target 60–90 seconds.
