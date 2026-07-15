"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DriftField from "@/components/DriftField";
import { getSocket } from "@/lib/socket";
import { getSessionId } from "@/lib/session";

const LABELS: Record<string, string> = {
  random: "Random",
  vent: "Going through something",
  talk: "Just want to talk",
  music: "Music",
  sport: "Sport",
  country: "Country",
  religion: "Religion",
};

const NO_MATCH_TIMEOUT_MS = 15000;

function ConnectingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const category = params.get("category") ?? "random";
  const [phase, setPhase] = useState<"searching" | "found" | "timeout">(
    "searching",
  );
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    const nickname = localStorage.getItem("driftroom:nickname");
    if (!nickname) {
      router.replace("/");
      return;
    }

    const sessionId = getSessionId();
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function onMatched({
      roomId,
      partner,
      category: matchedCategory,
      initiator,
    }: {
      roomId: string;
      partner: string;
      category: string;
      initiator: boolean;
    }) {
      if (timeoutId) clearTimeout(timeoutId);
      setPhase("found");
      sessionStorage.setItem("driftroom:roomId", roomId);
      sessionStorage.setItem("driftroom:partner", partner);
      sessionStorage.setItem("driftroom:initiator", String(initiator));
      setTimeout(() => {
        router.push(`/chat?category=${matchedCategory}`);
      }, 700);
    }

    socket.on("matched", onMatched);

    function join() {
      if (hasJoinedRef.current) return;
      hasJoinedRef.current = true;
      socket.emit("join-queue", { nickname, category, sessionId });

      timeoutId = setTimeout(() => {
        setPhase("timeout");
      }, NO_MATCH_TIMEOUT_MS);
    }

    if (socket.connected) {
      join();
    } else {
      socket.once("connect", join);
    }

    return () => {
      socket.off("matched", onMatched);
      socket.off("connect", join);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [category, router]);

  function cancelSearch() {
    getSocket().emit("leave-queue");
    router.push("/");
  }

  function tryRandomInstead() {
    getSocket().emit("leave-queue");
    hasJoinedRef.current = false;
    router.push(`/connecting?category=random`);
  }

  function keepWaiting() {
    setPhase("searching");
    hasJoinedRef.current = false;
    const socket = getSocket();
    const nickname = localStorage.getItem("driftroom:nickname");
    const sessionId = getSessionId();
    if (nickname) {
      hasJoinedRef.current = true;
      socket.emit("join-queue", { nickname, category, sessionId });
      setTimeout(() => setPhase("timeout"), NO_MATCH_TIMEOUT_MS);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-ink px-6">
      <DriftField />

      <div className="relative z-10 flex flex-col items-center text-center">
        {phase !== "timeout" && (
          <div className="relative flex h-40 w-40 items-center justify-center">
            <span className="absolute h-full w-full animate-ping-slow rounded-full border border-signal/30" />
            <span className="absolute h-2/3 w-2/3 animate-ping-slower rounded-full border border-signal/40" />
            <span className="h-3 w-3 rounded-full bg-signal shadow-[0_0_20px_4px] shadow-signal/60" />
          </div>
        )}

        <p className="mt-8 font-mono text-xs uppercase tracking-[0.3em] text-signal">
          {phase === "searching" && "scanning"}
          {phase === "found" && "signal locked"}
          {phase === "timeout" && "no signal"}
        </p>

        <h1 className="mt-3 font-display text-2xl font-semibold text-paper">
          {phase === "searching" &&
            `Finding someone in #${LABELS[category] ?? category}`}
          {phase === "found" && "Connected"}
          {phase === "timeout" && "No one's around right now"}
        </h1>

        <p className="mt-2 max-w-xs text-sm text-mist">
          {phase === "searching" &&
            "hang tight, matching you with someone drifting the same way"}
          {phase === "found" && "pulling you into the conversation..."}
          {phase === "timeout" &&
            `nobody's in #${LABELS[category] ?? category} right now — try again, or switch to Random`}
        </p>

        {phase === "timeout" && (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={keepWaiting}
              className="rounded-full bg-signal px-6 py-3 font-display text-sm font-semibold text-ink transition hover:bg-signal/90"
            >
              Keep waiting
            </button>
            {category !== "random" && (
              <button
                onClick={tryRandomInstead}
                className="rounded-full border border-line px-6 py-3 font-display text-sm font-semibold text-paper transition hover:border-signal/60 hover:text-signal"
              >
                Try Random instead
              </button>
            )}
            <button
              onClick={cancelSearch}
              className="rounded-full border border-line px-6 py-3 font-display text-sm text-mist transition hover:border-coral/50 hover:text-coral"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes ping-slow { 0% { transform: scale(0.6); opacity: .8; } 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes ping-slower { 0% { transform: scale(0.6); opacity: .6; } 100% { transform: scale(1.6); opacity: 0; } }
        .animate-ping-slow { animation: ping-slow 1.8s ease-out infinite; }
        .animate-ping-slower { animation: ping-slower 1.8s ease-out .3s infinite; }
      `}</style>
    </main>
  );
}

export default function Connecting() {
  return (
    <Suspense fallback={null}>
      <ConnectingInner />
    </Suspense>
  );
}
