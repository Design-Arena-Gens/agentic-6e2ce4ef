"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Cpu,
  Loader2,
  Mic,
  PauseCircle,
  RefreshCw,
  SendHorizonal,
  Settings2,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";

type ChatRole = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  pending?: boolean;
  muted?: boolean;
}

const SYSTEM_PROMPT = `You are Jarvis, an adaptive, hyper-capable AI operator trained to act as a tactical
mission assistant. Your tone is confident, precise, and mission-oriented.
Always provide structured, actionable insights. When appropriate, break down
responses into "Situation", "Analysis", and "Next Actions".`;

const INITIAL_ASSISTANT_GREETING =
  "Systems online. Jarvis standing by. What are we orchestrating today?";

function createMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${role}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt: Date.now(),
  };
}

function isSpeechSynthesisSupported() {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window && typeof window.speechSynthesis !== "undefined";
}

function getSpeechRecognition(): SpeechRecognitionShim | null {
  if (typeof window === "undefined") return null;
  const ctor =
    (window as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor })
      .SpeechRecognition ||
    (window as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor })
      .webkitSpeechRecognition;
  if (!ctor) return null;
  return new ctor();
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionShim;

interface SpeechRecognitionShim {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onaudioend: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; [key: number]: { transcript: string } }> }) => void) | null;
}

const suggestionDeck = [
  {
    title: "Strategize",
    body: "Summarize the current mission status and recommend next moves.",
  },
  {
    title: "Intel Sweep",
    body: "Scan news & brief me on critical developments in AI governance.",
  },
  {
    title: "Code Ops",
    body: "Review this repository and outline the highest risk change.",
  },
];

export default function AssistantConsole() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createMessage("system", SYSTEM_PROMPT),
    createMessage("assistant", INITIAL_ASSISTANT_GREETING),
  ]);
  const [input, setInput] = useState("");
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [statusText, setStatusText] = useState("All systems nominal.");
  const [error, setError] = useState<string | null>(null);

  const messagesRef = useRef<ChatMessage[]>(messages);
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionShim | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const speechSupported = useMemo(() => isSpeechSynthesisSupported(), []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (typeof window !== "undefined" && speechSupported) {
      synthRef.current = window.speechSynthesis;
    }
  }, [speechSupported]);

  useEffect(() => {
    if (!consoleRef.current) return;
    consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [messages]);

  const speak = useCallback(
    (text: string) => {
      if (!speechSupported || muted || !text.trim()) return;
      const synthesizer = synthRef.current;
      if (!synthesizer) return;
      synthesizer.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.pitch = 1.05;
      utterance.lang = "en-US";
      synthesizer.speak(utterance);
    },
    [muted, speechSupported],
  );

  const handleAssistantSpeech = useCallback(
    (message: ChatMessage) => {
      if (message.role !== "assistant" || message.pending) return;
      speak(message.content);
    },
    [speak],
  );

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (latest) {
      handleAssistantSpeech(latest);
    }
  }, [messages, handleAssistantSpeech]);

  const transmitPrompt = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || isTransmitting) return;

      const userMessage = createMessage("user", trimmed);
      const draftAssistant = { ...createMessage("assistant", ""), pending: true };

      setInput("");
      setError(null);
      setStatusText("Deploying Jarvis cognition stack…");
      setIsTransmitting(true);
      setMessages((prev) => [...prev, userMessage, draftAssistant]);

      const payload = messagesRef.current
        .filter((msg) => msg.role !== "system")
        .concat(userMessage)
        .map(({ role, content }) => ({ role, content }));

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const response = await fetch("/api/agent", {
          method: "POST",
          body: JSON.stringify({ messages: payload }),
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const failure = await response.text();
          throw new Error(failure || response.statusText);
        }

        setStatusText("Jarvis processing multi-threaded inference…");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        let done = false;

        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          if (value) {
            assistantContent += decoder.decode(value, { stream: true });
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === draftAssistant.id
                  ? { ...msg, content: assistantContent }
                  : msg,
              ),
            );
          }
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === draftAssistant.id
              ? { ...msg, content: assistantContent.trim(), pending: false }
              : msg,
          ),
        );
        setStatusText("Transmission complete.");
      } catch (err) {
        const failure =
          err instanceof Error ? err.message : "Unknown failure detected.";
        setError(failure);
        setStatusText("Jarvis encountered an obstruction.");
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === draftAssistant.id
              ? {
                  ...msg,
                  content:
                    "⚠️ Transmission failed. Verify the control room has OPENAI_API_KEY configured.",
                  pending: false,
                }
              : msg,
          ),
        );
      } finally {
        setIsTransmitting(false);
        abortRef.current = null;
      }
    },
    [isTransmitting],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      transmitPrompt(input);
    },
    [input, transmitPrompt],
  );

  const handleSuggestion = useCallback(
    (suggestion: string) => {
      transmitPrompt(suggestion);
    },
    [transmitPrompt],
  );

  const toggleListening = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = getSpeechRecognition();
    if (!recognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    let finalTranscript = "";

    recognition.onresult = (event) => {
      for (let i = event.results.length - 1; i >= 0; i -= 1) {
        const result = event.results[i];
        const transcriptChunk = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalTranscript += transcriptChunk;
        } else {
          setInput(finalTranscript + transcriptChunk);
        }
      }
    };

    recognition.onerror = (event) => {
      setError(`Mic input error: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      if (finalTranscript.trim()) {
        transmitPrompt(finalTranscript);
      }
    };

    recognition.start();
    setListening(true);
    setStatusText("Capturing voice command…");
  }, [transmitPrompt, listening]);

  const stopTransmission = useCallback(() => {
    abortRef.current?.abort();
    setStatusText("Transmission aborted.");
    setIsTransmitting(false);
  }, []);

  const operationalMessages = useMemo(
    () => messages.filter((message) => message.role !== "system"),
    [messages],
  );

  return (
    <section className="relative grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
              <Bot className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35rem] text-blue-300">
                Jarvis
              </p>
              <p className="text-xs text-zinc-400">Adaptive Intelligence Grid</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <Cpu className="size-4 text-emerald-400" />
            {statusText}
          </div>
        </div>

        <div className="flex h-[32rem] flex-col gap-6 overflow-hidden px-6 py-6">
          <div
            ref={consoleRef}
            className="flex-1 space-y-4 overflow-y-auto pr-2 text-sm [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/50"
          >
            {operationalMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
                <Sparkles className="mb-4 size-6" />
                <p>Awaiting your directive.</p>
              </div>
            ) : (
              operationalMessages.map((message) => (
                <article
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} text-sm`}
                >
                  <div
                    className={`max-w-xl rounded-3xl px-4 py-3 shadow-sm ring-1 ring-inset ring-white/10 ${
                      message.role === "assistant"
                        ? "bg-zinc-900/80 text-zinc-100"
                        : "bg-blue-500/80 text-white"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.3rem] text-white/70">
                      {message.role === "assistant" ? "Jarvis" : "Operator"}
                      {message.pending && (
                        <Loader2 className="size-3 animate-spin text-white/70" />
                      )}
                    </div>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-white/90">
                      {message.content}
                    </p>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {suggestionDeck.map((suggestion) => (
                <button
                  key={suggestion.title}
                  type="button"
                  onClick={() => handleSuggestion(suggestion.body)}
                  className="group flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-4 py-2 text-xs uppercase tracking-[0.2rem] text-zinc-300 transition hover:border-blue-400/60 hover:text-blue-200"
                >
                  <RefreshCw className="size-3.5 text-blue-300 transition group-hover:rotate-90" />
                  {suggestion.title}
                </button>
              ))}
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-3 rounded-full border border-zinc-800/70 bg-zinc-950/70 px-4 py-2"
            >
              <button
                type="button"
                onClick={toggleListening}
                className={`flex size-10 items-center justify-center rounded-full border border-zinc-700/60 transition ${
                  listening ? "border-red-400/70 text-red-300" : "text-zinc-400"
                }`}
                aria-label={listening ? "Stop listening" : "Start voice input"}
              >
                {listening ? <PauseCircle className="size-5" /> : <Mic className="size-5" />}
              </button>

              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Deploy a directive..."
                className="flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-500"
                disabled={isTransmitting}
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMuted((prev) => !prev)}
                  className="flex size-10 items-center justify-center rounded-full border border-zinc-700/60 text-zinc-400 transition hover:text-blue-200"
                  aria-label={muted ? "Enable speech" : "Mute speech"}
                >
                  {muted || !speechSupported ? (
                    <VolumeX className="size-5" />
                  ) : (
                    <Volume2 className="size-5" />
                  )}
                </button>

                <button
                  type="submit"
                  className="flex size-10 items-center justify-center rounded-full bg-blue-500/80 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isTransmitting && !listening}
                  aria-label="Transmit message"
                >
                  {isTransmitting ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <SendHorizonal className="size-5" />
                  )}
                </button>
              </div>
            </form>

            <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-[0.25rem] text-zinc-500">
              <div className="flex items-center gap-2">
                <Settings2 className="size-3.5" />
                Voice {speechSupported ? "online" : "offline"}
              </div>
              {isTransmitting && (
                <button
                  type="button"
                  onClick={stopTransmission}
                  className="flex items-center gap-1 rounded-full border border-red-400/50 px-3 py-1 text-[0.65rem] text-red-300 transition hover:border-red-300"
                >
                  <VolumeX className="size-3" />
                  Abort
                </button>
              )}
              {!isTransmitting && error && (
                <p className="text-red-300">
                  {error.length > 90 ? `${error.slice(0, 87)}…` : error}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <aside className="flex flex-col gap-4 rounded-3xl border border-zinc-800/80 bg-black/40 p-6 backdrop-blur-xl">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3rem] text-zinc-500">
              Mission Feed
            </p>
            <h2 className="text-lg font-semibold text-zinc-100">
              Operator Telemetry
            </h2>
          </div>
          <Sparkles className="size-5 text-blue-300" />
        </header>
        <p className="text-sm leading-relaxed text-zinc-400">
          Jarvis keeps a continuous thread of your directives, analyzes context,
          and proposes actionable next steps. Configure your OPENAI_API_KEY to
          empower the assistant with full inference capabilities.
        </p>
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-100">
          <p className="font-medium uppercase tracking-[0.25rem] text-blue-200">
            Deployment Brief
          </p>
          <ul className="mt-3 space-y-2">
            <li>• Supports voice dictation (Chrome / Edge recommended).</li>
            <li>• Streams Jarvis responses in real time.</li>
            <li>• Adaptive prompts for strategy, intel, and code ops.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs uppercase tracking-[0.3rem] text-zinc-500">
          Set OPENAI_API_KEY in your environment to enable live cognition.
        </div>
      </aside>
    </section>
  );
}
