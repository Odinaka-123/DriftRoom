"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  author: string;
  text: string;
  time: string;
  system?: boolean;
};

const ROOMS = ["general", "random", "late-night", "music"];
const PRESENCE = ["fern", "kip", "otter22", "nomad", "blue.wave"];

const SEED: Message[] = [
  {
    id: "s1",
    author: "system",
    text: "fern drifted in",
    time: "12:01",
    system: true,
  },
  { id: "m1", author: "fern", text: "anyone awake out there?", time: "12:02" },
  {
    id: "m2",
    author: "kip",
    text: "always. what's on your mind",
    time: "12:03",
  },
  {
    id: "s2",
    author: "system",
    text: "otter22 drifted in",
    time: "12:04",
    system: true,
  },
];

function timeNow() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Room() {
  const router = useRouter();
  const [nickname, setNickname] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("driftroom:nickname");
  });
  const [messages, setMessages] = useState<Message[]>(SEED);
  const [draft, setDraft] = useState("");
  const [room, setRoom] = useState("general");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nickname) {
      router.replace("/");
    }
  }, [nickname, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send() {
    const text = draft.trim();
    if (!text || !nickname) return;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), author: nickname, text, time: timeNow() },
    ]);
    setDraft("");
  }

  function leave() {
    localStorage.removeItem("driftroom:nickname");
    router.push("/");
  }

  if (!nickname) return null;

  return (
    <div className="flex h-screen bg-ink text-paper">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-ink-2 p-5 md:flex">
        <div className="font-display text-lg font-semibold tracking-tight">
          driftroom
        </div>

        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-mist/70">
          rooms
        </p>
        <nav className="mt-3 flex flex-col gap-1">
          {ROOMS.map((r) => (
            <button
              key={r}
              onClick={() => setRoom(r)}
              className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                room === r ?
                  "bg-ink-3 text-signal"
                : "text-mist hover:bg-ink-3/60 hover:text-paper"
              }`}
            >
              #{r}
            </button>
          ))}
        </nav>

        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-mist/70">
          drifting ({PRESENCE.length + 1})
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          <li className="flex items-center gap-2 text-sm text-paper">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" /> {nickname}{" "}
            <span className="text-mist/60">(you)</span>
          </li>
          {PRESENCE.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-mist">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-dim" /> {p}
            </li>
          ))}
        </ul>

        <button
          onClick={leave}
          className="mt-auto rounded-lg border border-line py-2 text-sm text-mist transition hover:border-coral/50 hover:text-coral"
        >
          Leave
        </button>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h1 className="font-display text-base font-semibold">#{room}</h1>
          <span className="font-mono text-xs text-mist">
            signed in as {nickname}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {messages.map((m) =>
              m.system ?
                <p
                  key={m.id}
                  className="text-center font-mono text-xs text-mist/60"
                >
                  {m.text} · {m.time}
                </p>
              : <div key={m.id} className="flex gap-3">
                  <span className="mt-0.5 font-mono text-xs text-mist/50">
                    {m.time}
                  </span>
                  <p className="text-sm">
                    <span
                      className={`font-mono font-medium ${
                        m.author === nickname ? "text-coral" : "text-signal"
                      }`}
                    >
                      {m.author}
                    </span>{" "}
                    <span className="text-paper/90">{m.text}</span>
                  </p>
                </div>,
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-line px-6 py-4">
          <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-full border border-line bg-ink-2 px-5 py-3 focus-within:border-signal/60">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="say something..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-mist/50"
            />
            <button
              onClick={send}
              disabled={!draft.trim()}
              className="rounded-full bg-signal px-4 py-1.5 font-display text-xs font-semibold text-ink transition hover:bg-signal/90 disabled:opacity-30"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
