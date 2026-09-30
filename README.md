# Voice Operations Console

**AssemblyAI Voice Agent Hackathon — bounded end-to-end demo**

Speech is convenient, but operational commands can be unsafe when names, amounts, dates, or other critical fields are misheard. Voice Operations Console turns spoken intent into a **verified, auditable, human-approved action record**.

## Golden path

```text
VOICE
  ↓
AssemblyAI Universal-3.5 Pro Realtime
  ↓
FINAL TRANSCRIPT
  ↓
STRUCTURED OPERATIONAL FIELDS
  ↓
CRITICAL-FIELD CHECK
  ↓
READBACK
  ↓
EXPLICIT HUMAN CONFIRM / REJECT
  ↓
AUDITABLE EXECUTION-READY RECEIPT
```

Example:

> “Send a quote for 12 million VND to Customer A tomorrow.”

The demo extracts the action, recipient, amount, and date. **Amount is treated as a critical field.** The system reads the interpreted command back and keeps confirmation locked until the required operational fields are present.

Confirmation does **not** perform a real external side effect in this hackathon demo. It creates an execution-ready JSON receipt showing exactly what was heard, extracted, verified, and approved.

## Why this exists

Most voice demos optimize for convenience: speak and immediately trigger something.

This prototype optimizes for **safe operations**:

1. Voice is input, not authority.
2. Critical fields are visible before execution.
3. The system reads the interpreted command back.
4. A human must explicitly confirm or reject.
5. The result is an auditable receipt.

## AssemblyAI integration

The browser microphone audio is converted to **16 kHz mono PCM16** and streamed to:

```text
wss://streaming.assemblyai.com/v3/ws
```

using:

```text
speech_model=universal-3-5-pro
```

The browser never receives the permanent AssemblyAI API key. It calls `/api/token`, a server-side function that uses `ASSEMBLYAI_API_KEY` to mint a short-lived AssemblyAI streaming token.

The client handles AssemblyAI `Turn` messages and treats `end_of_turn: true` as the finalized utterance. On stop it requests an endpoint and sends `Terminate` to close the streaming session.

## Run / deploy

The fastest public deployment path is Vercel.

1. Import this GitHub repository into Vercel.
2. Add environment variable:
   - `ASSEMBLYAI_API_KEY` = your AssemblyAI API key
3. Deploy.
4. Open the HTTPS deployment and allow microphone access.

**Never commit the API key.** `.env.example` contains only the variable name.

## Demo sequence

1. Click **Start microphone**.
2. Say: “Send a quote for 12 million VND to Customer A tomorrow.”
3. Click **Stop & finalize**.
4. Verify the extracted fields, especially the critical amount.
5. Click **Read back aloud**.
6. Click **Confirm**.
7. Show the generated JSON receipt and `EXECUTION_READY` state.

## Scope

This is intentionally one bounded workflow, not a generic chatbot and not a full automation platform. The hackathon proof is the safety loop:

**VOICE → TRANSCRIPT → STRUCTURE → VERIFY → CONFIRM → RECEIPT**

## Privacy and safety

- Permanent AssemblyAI credentials stay server-side.
- No real quote, email, payment, or other external action is executed by the demo.
- Human confirmation is a hard gate.
- The receipt records whether an external side effect occurred.

## Tech

- Vanilla HTML/CSS/JavaScript
- Browser microphone / Web Audio API
- AssemblyAI Universal-3.5 Pro Realtime
- Vercel serverless function for temporary-token minting
- No second AI API required for the bounded proof

## Hackathon project

**Team / product:** Voice Operations Console  
**Primary proof:** spoken operational intent becomes a verified, human-approved, auditable execution-ready record.
