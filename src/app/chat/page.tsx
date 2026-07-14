"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSocket, disconnectSocket } from "@/lib/socket";

type Message = {
  id: string;
  author: "you" | "them" | "system";
  text: string;
  time: string;
};

const LABELS: Record<string, string> = {
  random: "Random",
  vent: "Going through something",
  talk: "Just want to talk",
  music: "Music",
  sport: "Sport",
  country: "Country",
  religion: "Religion",
};

function timeNow() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChatInner() {
  const router = useRouter();
  const params = useSearchParams();
  const category = params.get("category") ?? "random";
  const savedNickname = localStorage.getItem("driftroom:nickname");
  const savedPartner = sessionStorage.getItem("driftroom:partner");

  const [nickname, setNickname] = useState<string | null>(savedNickname);
  const [partner, setPartner] = useState<string | null>(savedPartner);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (!savedNickname || !savedPartner) return [];
    return [
      {
        id: "s1",
        author: "system",
        text: `connected to ${savedPartner} · #${LABELS[category] ?? category}`,
        time: timeNow(),
      },
    ];
  });
  const [draft, setDraft] = useState("");
  const [partnerLeft, setPartnerLeft] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const roomId = sessionStorage.getItem("driftroom:roomId");

    if (!savedNickname || !savedPartner || !roomId) {
      router.replace("/");
      return;
    }

    const socket = getSocket();

    function onMessage({
      text,
      from,
      time,
    }: {
      text: string;
      from: string;
      time: string;
    }) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          author: "them",
          text,
          time: new Date(time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    }

    function onPartnerLeft() {
      setPartnerLeft(true);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          author: "system",
          text: `${savedPartner} disconnected`,
          time: timeNow(),
        },
      ]);
    }

    socket.on("message", onMessage);
    socket.on("partner-left", onPartnerLeft);

    return () => {
      socket.off("message", onMessage);
      socket.off("partner-left", onPartnerLeft);
    };
  }, [router, category]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send() {
    const text = draft.trim();
    if (!text || partnerLeft) return;
    getSocket().emit("send-message", { text });
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), author: "you", text, time: timeNow() },
    ]);
    setDraft("");
  }

  function nextMatch() {
    getSocket().emit("leave-room");
    sessionStorage.removeItem("driftroom:roomId");
    sessionStorage.removeItem("driftroom:partner");
    router.push(`/connecting?category=${category}`);
  }

  function leave() {
    getSocket().emit("leave-room");
    disconnectSocket();
    localStorage.removeItem("driftroom:nickname");
    sessionStorage.removeItem("driftroom:roomId");
    sessionStorage.removeItem("driftroom:partner");
    router.push("/");
  }

  if (!nickname || !partner) return null;

  return (
    <div className="flex h-screen flex-col bg-ink text-paper">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${partnerLeft ? "bg-mist" : "bg-signal animate-pulse-line"}`}
            />
            <h1 className="font-display text-base font-semibold">{partner}</h1>
          </div>
          <p className="mt-0.5 font-mono text-xs text-mist">
            #{LABELS[category] ?? category}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={nextMatch}
            className="rounded-full border border-line px-4 py-1.5 font-mono text-xs text-mist transition hover:border-signal/60 hover:text-signal"
          >
            Next
          </button>
          <button
            onClick={leave}
            className="rounded-full border border-line px-4 py-1.5 font-mono text-xs text-mist transition hover:border-coral/50 hover:text-coral"
          >
            Leave
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((m) =>
            m.author === "system" ?
              <p
                key={m.id}
                className="text-center font-mono text-xs text-mist/60"
              >
                {m.text} · {m.time}
              </p>
            : <div
                key={m.id}
                className={`flex gap-3 ${m.author === "you" ? "flex-row-reverse text-right" : ""}`}
              >
                <span className="mt-0.5 shrink-0 font-mono text-xs text-mist/50">
                  {m.time}
                </span>
                <p className="text-sm">
                  <span
                    className={`font-mono font-medium ${m.author === "you" ? "text-coral" : "text-signal"}`}
                  >
                    {m.author === "you" ? nickname : partner}
                  </span>{" "}
                  <span className="text-paper/90">{m.text}</span>
                </p>
              </div>,
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-line px-6 py-4">
        {partnerLeft ?
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-3">
            <button
              onClick={nextMatch}
              className="rounded-full bg-signal px-6 py-3 font-display text-sm font-semibold text-ink transition hover:bg-signal/90"
            >
              Find someone else
            </button>
          </div>
        : <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-full border border-line bg-ink-2 px-5 py-3 focus-within:border-signal/60">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={`message ${partner}...`}
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
        }
      </div>
    </div>
  );
}

export default function Chat() {
  return (
    <Suspense fallback={null}>
      <ChatInner />
    </Suspense>
  );
}
