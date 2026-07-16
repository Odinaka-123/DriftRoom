"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DriftField from "@/components/DriftField";
import { getSocket } from "@/lib/socket";

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [drifting, setDrifting] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    function onPresence({ count }: { count: number }) {
      setDrifting(count);
    }

    socket.on("presence-count", onPresence);

    return () => {
      socket.off("presence-count", onPresence);
    };
  }, []);

  function dropIn() {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    localStorage.setItem("driftroom:nickname", trimmed);
    router.push("/connecting?category=random");
  }

  return (
    <main className="relative flex min-h-screen min-h-dvh items-center justify-center overflow-hidden bg-ink px-6">
      <DriftField />

      <div className="relative z-10 w-full max-w-sm text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-signal">
          signal found
        </p>

        <h1 className="mt-4 font-display text-6xl font-semibold tracking-tight text-paper">
          Driftroom
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-mist">
          pick a name. we&apos;ll find someone.
          <br />
          let fate decide.
        </p>

        <div className="mt-10">
          <label htmlFor="nickname" className="sr-only">
            Nickname
          </label>
          <div className="flex items-center gap-3 rounded-full border border-line bg-ink-2 px-5 py-4 transition focus-within:border-signal/60">
            <span className="h-2 w-2 shrink-0 rounded-full bg-signal animate-pulse-line" />
            <input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && dropIn()}
              placeholder="your nickname"
              maxLength={20}
              autoFocus
              className="w-full bg-transparent font-mono text-sm text-paper placeholder:text-mist/60 outline-none"
            />
          </div>

          <button
            onClick={dropIn}
            disabled={!nickname.trim()}
            className="mt-4 w-full rounded-full bg-signal py-4 font-display text-sm font-semibold tracking-wide text-ink transition hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Continue →
          </button>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          <p className="font-mono text-xs text-mist/70">
            {drifting === null ?
              "connecting..."
            : `${drifting} drifting right now`}
          </p>
        </div>
      </div>
    </main>
  );
}
