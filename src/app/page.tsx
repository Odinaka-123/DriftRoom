"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DriftField from "@/components/DriftField";

const CATEGORIES = [
  { id: "random", label: "Random", desc: "Let fate decide" },
  {
    id: "vent",
    label: "Going through something",
    desc: "Just need to talk it out",
  },
  { id: "talk", label: "Just want to talk", desc: "No agenda, just company" },
  { id: "music", label: "Music", desc: "Trade playlists and takes" },
  { id: "sport", label: "Sport", desc: "Whatever's on tonight" },
  {
    id: "country",
    label: "Country",
    desc: "Where you're from, where you'd go",
  },
  { id: "religion", label: "Religion", desc: "Faith, doubt, all of it" },
];

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const router = useRouter();

  function dropIn() {
    const trimmed = nickname.trim();
    if (!trimmed || !category) return;
    localStorage.setItem("driftroom:nickname", trimmed);
    router.push(`/connecting?category=${category}`);
  }

  const ready = nickname.trim() && category;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-ink px-6 py-16">
      <DriftField />

      <div className="relative z-10 w-full max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-signal">
          signal found
        </p>
        <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight text-paper">
          driftroom
        </h1>
        <p className="mt-3 text-sm text-mist">
          pick a name, pick what&apos;s on your mind. we&apos;ll find someone.
        </p>

        <div className="mt-9">
          <label htmlFor="nickname" className="sr-only">
            Nickname
          </label>
          <div className="flex items-center gap-2 rounded-full border border-line bg-ink-2 px-5 py-3.5 focus-within:border-signal/60">
            <span className="h-2 w-2 shrink-0 rounded-full bg-signal animate-pulse-line" />
            <input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="your nickname"
              maxLength={20}
              autoFocus
              className="w-full bg-transparent font-mono text-sm text-paper placeholder:text-mist/60 outline-none"
            />
          </div>
        </div>

        <div className="mt-8 text-left">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist/70">
            what&apos;s on your mind
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`rounded-xl border px-3.5 py-3 text-left transition ${
                    active ?
                      "border-signal/70 bg-signal/10"
                    : "border-line bg-ink-2 hover:border-mist/40"
                  }`}
                >
                  <span
                    className={`block font-display text-sm font-semibold ${
                      active ? "text-signal" : "text-paper"
                    }`}
                  >
                    {c.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-mist">
                    {c.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={dropIn}
          disabled={!ready}
          className="mt-8 w-full rounded-full bg-signal py-3.5 font-display text-sm font-semibold tracking-wide text-ink transition hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Continue →
        </button>

        <p className="mt-6 font-mono text-xs text-mist/70">
          ° 214 drifting right now
        </p>
      </div>
    </main>
  );
}
