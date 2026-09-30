# Hackathon Submission Draft

## Project name
Voice Operations Console

## One-line pitch
Turn spoken operational intent into verified, human-approved, auditable action receipts.

## Short description
Voice interfaces are fast, but operational commands become risky when critical details such as amounts, recipients, or dates are misheard. Voice Operations Console uses AssemblyAI realtime speech-to-text to capture a spoken instruction, structures the operational fields, flags critical values, reads the interpretation back, requires explicit human confirmation, and only then produces an execution-ready audit receipt.

## Problem
A voice assistant can hear “send the quote” correctly while still getting the amount, recipient, or date wrong. In operational workflows, a fluent response is not enough: the system needs a verification boundary before an action becomes executable.

## Solution
The prototype implements one bounded safety loop:

VOICE → TRANSCRIPT → STRUCTURED FIELDS → CRITICAL-FIELD VERIFICATION → READBACK → HUMAN CONFIRMATION → RECEIPT

Example instruction:

> Send a quote for 12 million VND to Customer A tomorrow.

The amount is treated as a critical field. Confirmation stays locked until the required operational fields are present. Confirming does not perform an external side effect in the demo; it creates an execution-ready JSON receipt that records the source transcript, extracted fields, verification state, human decision, and whether any side effect occurred.

## How AssemblyAI is used
- Browser microphone audio is converted to 16 kHz mono PCM16.
- Audio is streamed to AssemblyAI Universal-3.5 Pro Realtime over the v3 WebSocket API.
- Finalized `Turn` events (`end_of_turn: true`) become the source transcript for the verification workflow.
- A server-side endpoint mints a short-lived AssemblyAI streaming token, so the permanent API key never ships to the browser.
- The streaming session is explicitly terminated after finalization.

## What makes it different
The voice transcript is not treated as execution authority. The product inserts a visible human verification gate between speech recognition and operational readiness, then creates evidence of what was approved.

## Current prototype scope
One end-to-end workflow is intentionally prioritized over a generic chatbot:
1. Capture voice.
2. Transcribe with AssemblyAI.
3. Extract action, recipient, amount, and date.
4. Treat amount as critical.
5. Read the interpreted instruction back.
6. Require Confirm or Reject.
7. Produce an auditable JSON receipt.

## Technology
- AssemblyAI Universal-3.5 Pro Realtime
- WebSocket streaming
- Browser Web Audio API
- Vanilla JavaScript
- Vercel serverless temporary-token endpoint

## Safety boundary
The hackathon demo never sends a real quote, email, payment, or other external action. `CONFIRMED` means execution-ready, not executed.
