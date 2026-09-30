const $ = (id) => document.getElementById(id);

const ui = {
  start: $("startBtn"), stop: $("stopBtn"), status: $("status"),
  transcript: $("transcript"), risk: $("riskBadge"),
  action: $("actionField"), recipient: $("recipientField"),
  amount: $("amountField"), date: $("dateField"),
  readback: $("readback"), speak: $("speakBtn"),
  confirm: $("confirmBtn"), reject: $("rejectBtn"),
  receipt: $("receipt"), copy: $("copyBtn"),
  language: $("languageSelect"), languageHint: $("languageHint")
};

let ws;
let mediaStream;
let audioContext;
let sourceNode;
let processorNode;
let muteNode;
let finalTranscript = "";
let partialTranscript = "";
let currentFields = null;
let sessionId = null;

function setStatus(text, kind = "idle") {
  ui.status.textContent = text;
  ui.status.className = "status " + kind;
}

function normalize(text) {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

function vietnameseNumberValue(raw) {
  const text = raw.toLowerCase().normalize("NFC").replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim();
  const direct = Number(text.replace(",", "."));
  if (Number.isFinite(direct)) return direct;

  const units = {
    "không": 0, "một": 1, "mốt": 1, "hai": 2, "ba": 3, "bốn": 4, "tư": 4,
    "năm": 5, "lăm": 5, "sáu": 6, "bảy": 7, "tám": 8, "chín": 9
  };
  const tokens = text.split(" ").filter(Boolean);
  let total = 0;
  let current = 0;
  let seen = false;

  for (const token of tokens) {
    if (Object.prototype.hasOwnProperty.call(units, token)) {
      current += units[token];
      seen = true;
    } else if (token === "mười") {
      current += 10;
      seen = true;
    } else if (token === "mươi") {
      current = (current || 1) * 10;
      seen = true;
    } else if (token === "trăm") {
      current = (current || 1) * 100;
      seen = true;
    } else if (token === "linh" || token === "lẻ") {
      continue;
    } else {
      return null;
    }
  }
  return seen ? total + current : null;
}

function parseAmount(text) {
  const t = text.toLowerCase().normalize("NFC").replace(/,/g, "");

  const englishNumbers = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
    "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
    "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20
  };
  let em = t.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+million\b/i);
  if (em) return englishNumbers[em[1].toLowerCase()] * 1000000;

  let m = t.match(/(?:vnd|₫)?\s*(\d+(?:\.\d+)?)\s*(?:triệu|million)(?=\s|vnd|₫|đồng|dong|[,.!?]|$)/i);
  if (m) return Math.round(Number(m[1]) * 1000000);

  m = t.match(/(?:vnd|₫)?\s*(không|một|mốt|hai|ba|bốn|tư|năm|lăm|sáu|bảy|tám|chín|mười)(?:\s+(không|một|mốt|hai|ba|bốn|tư|năm|lăm|sáu|bảy|tám|chín|mười|mươi|trăm|linh|lẻ))*\s+triệu(?=\s|vnd|₫|đồng|dong|[,.!?]|$)/i);
  if (m) {
    const phrase = m[0]
      .replace(/^(?:vnd|₫)?\s*/i, "")
      .replace(/\s+triệu(?:\s*(?:vnd|₫|đồng|dong))?\s*$/i, "");
    const value = vietnameseNumberValue(phrase);
    if (value != null) return Math.round(value * 1000000);
  }

  m = t.match(/(?:vnd|₫)?\s*(\d{4,12})\s*(?:vnd|₫|đồng|dong)?(?=\s|[,.!?]|$)/i);
  if (m) return Number(m[1]);
  return null;
}

function parseFields(text) {
  const clean = normalize(text);
  const lower = clean.toLowerCase();

  const amount = parseAmount(clean);

  let recipient = null;
  const recipientPatterns = [
    /(?:cho|tới|đến)\s+(khách(?:\s+hàng)?\s+[^,.!?]+?)(?=\s+(?:vào|ngày|hôm|tomorrow|today)\b|[,.!?]|$)/i,
    /(?:to|for)\s+(customer\s+[^,.!?]+?)(?=\s+(?:on|tomorrow|today)\b|[,.!?]|$)/i
  ];
  for (const pattern of recipientPatterns) {
    const match = clean.match(pattern);
    if (match) { recipient = match[1].trim(); break; }
  }

  let date = null;
  if (/\b(ngày mai|tomorrow)\b/i.test(clean)) date = "tomorrow";
  else if (/\b(hôm nay|today)\b/i.test(clean)) date = "today";
  else {
    const dateMatch = clean.match(/\b(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)\b/);
    if (dateMatch) date = dateMatch[1];
  }

  let action = null;
  if (/(?:báo giá|\bquote\b)/i.test(clean)) action = /(?:gửi|người|\bsend\b)/i.test(clean) ? "send quote" : "create quote";
  else if (/(?:gửi|\bsend\b)/i.test(clean)) action = "send";
  else if (/(?:tạo|\bcreate\b)/i.test(clean)) action = "create task";

  return { action, recipient, amount, currency: amount ? "VND" : null, date, source_text: clean };
}

function money(value) {
  return value == null ? "—" : new Intl.NumberFormat("en-US").format(value) + " VND";
}

function renderFields(fields) {
  currentFields = fields;
  ui.action.textContent = fields.action || "—";
  ui.recipient.textContent = fields.recipient || "—";
  ui.amount.textContent = money(fields.amount);
  ui.date.textContent = fields.date || "—";

  const criticalReady = fields.amount != null;
  const operationalReady = criticalReady && fields.action && fields.recipient;

  if (!criticalReady) {
    ui.risk.textContent = "Critical field missing";
    ui.risk.className = "status warn";
  } else {
    ui.risk.textContent = "Critical field detected";
    ui.risk.className = "status live";
  }

  const parts = [
    "I heard:",
    fields.action ? "Action: " + fields.action + "." : "Action: missing.",
    fields.recipient ? "Recipient: " + fields.recipient + "." : "Recipient: missing.",
    fields.amount != null ? "Critical amount: " + money(fields.amount) + "." : "Critical amount: missing.",
    fields.date ? "Date: " + fields.date + "." : "Date: not specified.",
    operationalReady ? "Confirm this instruction?" : "Confirmation is locked until action, recipient, and critical amount are present."
  ];
  ui.readback.textContent = parts.join(" ");
  ui.speak.disabled = false;
  ui.confirm.disabled = !operationalReady;
  ui.reject.disabled = false;
}

function updateTranscript() {
  const combined = normalize([finalTranscript, partialTranscript].filter(Boolean).join(" "));
  ui.transcript.textContent = combined || "Listening…";
}

function resampleTo16k(input, inputRate) {
  if (inputRate === 16000) return input;
  const ratio = inputRate / 16000;
  const length = Math.round(input.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) { sum += input[j]; count++; }
    output[i] = count ? sum / count : input[Math.min(start, input.length - 1)];
  }
  return output;
}

function floatToPcm16(float32) {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

async function startRecording() {
  ui.start.disabled = true;
  ui.receipt.textContent = "No receipt yet.";
  ui.copy.disabled = true;
  finalTranscript = "";
  partialTranscript = "";
  currentFields = null;
  sessionId = null;
  updateTranscript();
  setStatus("Authorizing…", "warn");

  try {
    const tokenResponse = await fetch("/api/token", { cache: "no-store" });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.token) {
      throw new Error(tokenPayload.error || "Temporary token unavailable");
    }

    const selectedLanguage = ui.language.value;
    const params = new URLSearchParams({
      sample_rate: "16000",
      encoding: "pcm_s16le",
      speech_model: "universal-3-5-pro",
      mode: "max_accuracy",
      token: tokenPayload.token
    });
    if (selectedLanguage !== "auto") params.set("language_code", selectedLanguage);

    const context = selectedLanguage === "vi"
      ? "Người dùng sẽ nói một chỉ dẫn vận hành ngắn về gửi hoặc tạo báo giá, số tiền VND, khách hàng và ngày thực hiện."
      : selectedLanguage === "en"
        ? "The user will speak a short operational instruction about sending or creating a quote, a VND amount, a customer, and a date."
        : "The user will speak a short operational instruction that may be English or Vietnamese, about a quote, VND amount, customer, and date.";
    params.set("agent_context", context);
    ws = new WebSocket("wss://streaming.assemblyai.com/v3/ws?" + params.toString());

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("AssemblyAI connection timed out")), 10000);
      ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      ws.addEventListener("error", () => { clearTimeout(timer); reject(new Error("AssemblyAI WebSocket connection failed")); }, { once: true });
    });

    // Bias recognition toward the small operational vocabulary used by this demo.
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "UpdateConfiguration",
        keyterms: selectedLanguage === "vi"
          ? ["báo giá", "triệu", "VND", "khách hàng", "ngày mai"]
          : selectedLanguage === "en"
            ? ["quote", "million", "VND", "Customer", "tomorrow"]
            : ["quote", "báo giá", "million", "triệu", "VND", "Customer", "khách hàng", "tomorrow", "ngày mai"]
      }));
    }

    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "Begin") {
        sessionId = msg.id || null;
        setStatus("AssemblyAI live", "live");
      } else if (msg.type === "Turn") {
        const text = normalize(msg.transcript || "");
        if (msg.end_of_turn) {
          if (text) finalTranscript = normalize([finalTranscript, text].filter(Boolean).join(" "));
          partialTranscript = "";
          updateTranscript();
          if (text || finalTranscript) renderFields(parseFields(finalTranscript));
        } else {
          partialTranscript = text;
          updateTranscript();
        }
      } else if (msg.type === "Termination") {
        setStatus("Finalized", "idle");
      }
    });

    ws.addEventListener("close", () => {
      if (ui.stop.disabled === false) setStatus("Connection closed", "idle");
    });

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    processorNode = audioContext.createScriptProcessor(2048, 1, 1);
    muteNode = audioContext.createGain();
    muteNode.gain.value = 0;

    processorNode.onaudioprocess = (event) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm = floatToPcm16(resampleTo16k(input, audioContext.sampleRate));
      ws.send(pcm);
    };

    sourceNode.connect(processorNode);
    processorNode.connect(muteNode);
    muteNode.connect(audioContext.destination);

    ui.stop.disabled = false;
    setStatus("AssemblyAI live", "live");
  } catch (error) {
    setStatus("Start failed", "warn");
    ui.transcript.textContent = error.message;
    ui.start.disabled = false;
    await cleanupAudio();
  }
}

async function cleanupAudio() {
  if (processorNode) processorNode.disconnect();
  if (sourceNode) sourceNode.disconnect();
  if (muteNode) muteNode.disconnect();
  if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
  if (audioContext && audioContext.state !== "closed") await audioContext.close();
  processorNode = sourceNode = muteNode = mediaStream = audioContext = null;
}

async function stopRecording() {
  ui.stop.disabled = true;
  setStatus("Finalizing…", "warn");

  // Preserve whatever the user can currently see before audio teardown.
  const visibleAtStop = normalize([finalTranscript, partialTranscript].filter(Boolean).join(" "));
  await cleanupAudio();

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "ForceEndpoint" }));
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "Terminate" }));
    }, 1400);
  }

  setTimeout(() => {
    const bestTranscript = normalize(finalTranscript || visibleAtStop);
    if (bestTranscript) {
      finalTranscript = bestTranscript;
      partialTranscript = "";
      updateTranscript();
      renderFields(parseFields(bestTranscript));
    }
    ui.start.disabled = false;
    if (ui.status.textContent === "Finalizing…") setStatus("Finalized", "idle");
  }, 1550);
}

function speakReadback() {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(ui.readback.textContent);
  utterance.rate = 0.95;
  speechSynthesis.speak(utterance);
}

function createReceipt(decision) {
  const receipt = {
    schema: "voice-operations-console/receipt-v1",
    receipt_id: "VOC-" + Date.now().toString(36).toUpperCase(),
    created_at: new Date().toISOString(),
    assemblyai: {
      product: "Universal-3.5 Pro Realtime",
      session_id: sessionId,
      realtime_transcription_used: true
    },
    source: { modality: "voice", transcript: finalTranscript },
    extracted_fields: currentFields,
    critical_fields: ["amount"],
    verification: {
      readback_presented: true,
      explicit_human_decision: decision,
      external_side_effect_executed: false
    },
    state: decision === "CONFIRMED" ? "EXECUTION_READY" : "REJECTED"
  };
  ui.receipt.textContent = JSON.stringify(receipt, null, 2);
  ui.copy.disabled = false;
  ui.confirm.disabled = true;
  ui.reject.disabled = true;
  return receipt;
}

function updateLanguageHint() {
  if (ui.language.value === "vi") {
    ui.languageHint.innerHTML = 'Tiếng Việt: <strong>“Gửi báo giá 12 triệu cho khách A vào ngày mai.”</strong>';
  } else if (ui.language.value === "auto") {
    ui.languageHint.innerHTML = 'Auto / Multilingual: AssemblyAI tự nhận diện ngôn ngữ. Dùng khi có chuyển đổi ngôn ngữ; với một ngôn ngữ cố định, nên chọn trực tiếp.';
  } else {
    ui.languageHint.innerHTML = 'English: <strong>“Send a quote for 12 million VND to Customer A tomorrow.”</strong>';
  }
}
ui.language.addEventListener("change", updateLanguageHint);
updateLanguageHint();

ui.start.addEventListener("click", startRecording);
ui.stop.addEventListener("click", stopRecording);
ui.speak.addEventListener("click", speakReadback);
ui.confirm.addEventListener("click", () => createReceipt("CONFIRMED"));
ui.reject.addEventListener("click", () => createReceipt("REJECTED"));
ui.copy.addEventListener("click", async () => {
  await navigator.clipboard.writeText(ui.receipt.textContent);
  const original = ui.copy.textContent;
  ui.copy.textContent = "Copied";
  setTimeout(() => { ui.copy.textContent = original; }, 1200);
});
