"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DriftField from "@/components/DriftField";
import { getSocket } from "@/lib/socket";

const LABELS: Record<string, string> = {
  random: "Random",
  vent: "Going through something",
  talk: "Just want to talk",
  music: "Music",
  sport: "Sport",
  country: "Country",
  religion: "Religion",
};

function ConnectingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const category = params.get("category") ?? "random";
  const [phase, setPhase] = useState<"searching" | "found">("searching");
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    const nickname = localStorage.getItem("driftroom:nickname");
    if (!nickname) {
      router.replace("/");
      return;
    }

    const socket = getSocket();
    if (!socket.connected) socket.connect();

    function onMatched({
      roomId,
      partner,
      category: matchedCategory,
    }: {
      roomId: string;
      partner: string;
      category: string;
    }) {
      setPhase("found");
      sessionStorage.setItem("driftroom:roomId", roomId);
      sessionStorage.setItem("driftroom:partner", partner);
      setTimeout(() => {
        router.push(`/chat?category=${matchedCategory}`);
      }, 700);
    }

    socket.on("matched", onMatched);

    function join() {
      if (hasJoinedRef.current) return;
      hasJoinedRef.current = true;
      socket.emit("join-queue", { nickname, category });
    }

    if (socket.connected) {
      join();
    } else {
      socket.once("connect", join);
    }

    return () => {
      socket.off("matched", onMatched);
      socket.off("connect", join);
    };
  }, [category, router]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-6">
      <DriftField />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="relative flex h-40 w-40 items-center justify-center">
          <span className="absolute h-full w-full animate-ping-slow rounded-full border border-signal/30" />
          <span className="absolute h-2/3 w-2/3 animate-ping-slower rounded-full border border-signal/40" />
          <span className="h-3 w-3 rounded-full bg-signal shadow-[0_0_20px_4px] shadow-signal/60" />
        </div>

        <p className="mt-8 font-mono text-xs uppercase tracking-[0.3em] text-signal">
          {phase === "searching" ? "scanning" : "signal locked"}
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-paper">
          {phase === "searching"
            ? `Finding someone in #${LABELS[category] ?? category}`
            : "Connected"}
        </h1>
        <p className="mt-2 max-w-xs text-sm text-mist">
          {phase === "searching"
            ? "hang tight, matching you with someone drifting the same way"
            : "pulling you into the conversation..."}
        </p>
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