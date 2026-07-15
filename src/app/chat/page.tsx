"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { createPeerConnection } from "@/lib/webrtc";

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

  const [nickname, setNickname] = useState<string | null>(null);
  const [partner, setPartner] = useState<string | null>(null);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [callStatus, setCallStatus] = useState<
    "connecting" | "live" | "failed"
  >("connecting");
  const [muted, setMuted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedNickname = localStorage.getItem("driftroom:nickname");
    const savedPartner = sessionStorage.getItem("driftroom:partner");
    const roomId = sessionStorage.getItem("driftroom:roomId");
    const initiator = sessionStorage.getItem("driftroom:initiator") === "true";

    if (!savedNickname || !savedPartner || !roomId) {
      router.replace("/");
      return;
    }

    // avoid synchronous setState inside effect to prevent cascading renders
    setTimeout(() => {
      setNickname(savedNickname);
      setPartner(savedPartner);
      setMessages([
        {
          id: "s1",
          author: "system",
          text: `connected to ${savedPartner} · #${LABELS[category] ?? category}`,
          time: timeNow(),
        },
      ]);
    }, 0);

    const socket = getSocket();
    let cancelled = false;

    async function setupCall() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;

        const pc = createPeerConnection();
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0];
          }
          setCallStatus("live");
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("webrtc-ice-candidate", {
              candidate: event.candidate.toJSON(),
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (
            pc.connectionState === "failed" ||
            pc.connectionState === "disconnected"
          ) {
            setCallStatus((prev) => (prev === "live" ? prev : "failed"));
          }
        };

        if (initiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc-offer", { sdp: pc.localDescription });
        }
      } catch (err) {
        console.error("Mic access failed:", err);
        setCallStatus("failed");
      }
    }

    setupCall();

    async function onOffer({ sdp }: { sdp: RTCSessionDescriptionInit }) {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { sdp: pc.localDescription });
    }

    async function onAnswer({ sdp }: { sdp: RTCSessionDescriptionInit }) {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];
    }

    async function onIceCandidate({
      candidate,
    }: {
      candidate: RTCIceCandidateInit;
    }) {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }

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
      setUnread((n) => (chatOpen ? n : n + 1));
    }

    function onPartnerLeft() {
      setPartnerLeft(true);
      setCallStatus("failed");
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

    socket.on("webrtc-offer", onOffer);
    socket.on("webrtc-answer", onAnswer);
    socket.on("webrtc-ice-candidate", onIceCandidate);
    socket.on("message", onMessage);
    socket.on("partner-left", onPartnerLeft);

    return () => {
      cancelled = true;
      socket.off("webrtc-offer", onOffer);
      socket.off("webrtc-answer", onAnswer);
      socket.off("webrtc-ice-candidate", onIceCandidate);
      socket.off("message", onMessage);
      socket.off("partner-left", onPartnerLeft);
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [router, category]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !muted;
    stream.getAudioTracks().forEach((track) => (track.enabled = !nextMuted));
    setMuted(nextMuted);
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    getSocket().emit("send-message", { text });
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), author: "you", text, time: timeNow() },
    ]);
    setDraft("");
  }

  function cleanupCall() {
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function nextMatch() {
    cleanupCall();
    getSocket().emit("leave-room");
    sessionStorage.removeItem("driftroom:roomId");
    sessionStorage.removeItem("driftroom:partner");
    sessionStorage.removeItem("driftroom:initiator");
    router.push(`/connecting?category=${category}`);
  }

  function leave() {
    cleanupCall();
    getSocket().emit("leave-room");
    localStorage.removeItem("driftroom:nickname");
    sessionStorage.removeItem("driftroom:roomId");
    sessionStorage.removeItem("driftroom:partner");
    sessionStorage.removeItem("driftroom:initiator");
    router.push("/");
  }

  function openChat() {
    setChatOpen(true);
    setUnread(0);
  }

  if (!nickname || !partner) return null;

  return (
    <div className="relative flex h-screen flex-col bg-ink text-paper overflow-hidden">
      <audio ref={remoteAudioRef} autoPlay />

      {/* Full-screen call UI */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-signal">
          #{LABELS[category] ?? category}
        </p>

        <div className="relative mt-10 flex h-40 w-40 items-center justify-center">
          {callStatus === "live" && !partnerLeft && (
            <>
              <span className="absolute h-full w-full animate-ping-slow rounded-full border border-signal/30" />
              <span className="absolute h-2/3 w-2/3 animate-ping-slower rounded-full border border-signal/40" />
            </>
          )}
          <div
            className={`flex h-28 w-28 items-center justify-center rounded-full font-display text-3xl font-semibold ${
              callStatus === "live" && !partnerLeft ?
                "bg-signal/15 text-signal"
              : "bg-ink-2 text-mist"
            }`}
          >
            {partner.slice(0, 1).toUpperCase()}
          </div>
        </div>

        <h1 className="mt-6 font-display text-2xl font-semibold">{partner}</h1>
        <p className="mt-2 font-mono text-sm text-mist">
          {partnerLeft && "call ended — partner disconnected"}
          {!partnerLeft && callStatus === "connecting" && "connecting..."}
          {!partnerLeft && callStatus === "live" && "on a call"}
          {!partnerLeft && callStatus === "failed" && "connection failed"}
        </p>

        {/* Call controls */}
        <div className="mt-12 flex items-center gap-4">
          <button
            onClick={toggleMute}
            disabled={partnerLeft}
            className={`flex h-14 w-14 items-center justify-center rounded-full border transition disabled:opacity-30 ${
              muted ?
                "border-coral/60 bg-coral/10 text-coral"
              : "border-line bg-ink-2 text-paper hover:border-signal/60"
            }`}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            <span className="font-mono text-xs">{muted ? "MUTED" : "MIC"}</span>
          </button>

          <button
            onClick={partnerLeft ? nextMatch : leave}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-coral text-ink font-display text-xs font-semibold transition hover:bg-coral/90"
          >
            {partnerLeft ? "NEXT" : "END"}
          </button>

          {!partnerLeft && (
            <button
              onClick={nextMatch}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-ink-2 text-paper transition hover:border-signal/60"
              aria-label="Next"
            >
              <span className="font-mono text-xs">NEXT</span>
            </button>
          )}
        </div>

        {/* Chat toggle */}
        <button
          onClick={openChat}
          className="absolute bottom-6 right-6 flex items-center gap-2 rounded-full border border-line bg-ink-2 px-4 py-2.5 text-sm text-mist transition hover:border-signal/60 hover:text-signal"
        >
          Chat
          {unread > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-signal font-mono text-[10px] font-semibold text-ink">
              {unread}
            </span>
          )}
        </button>
      </div>

      {/* Slide-out chat drawer */}
      <div
        className={`absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-line bg-ink-2 transition-transform duration-300 ${
          chatOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-sm font-semibold">Chat</h2>
          <button
            onClick={() => setChatOpen(false)}
            className="font-mono text-xs text-mist hover:text-paper"
          >
            close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-3">
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
                  className={`flex gap-2 ${m.author === "you" ? "flex-row-reverse text-right" : ""}`}
                >
                  <span className="mt-0.5 shrink-0 font-mono text-[10px] text-mist/50">
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

        <div className="border-t border-line px-5 py-4">
          <div className="flex items-center gap-2 rounded-full border border-line bg-ink px-4 py-2.5 focus-within:border-signal/60">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={partnerLeft ? "call ended" : `message ${partner}...`}
              disabled={partnerLeft}
              className="w-full bg-transparent text-sm outline-none placeholder:text-mist/50 disabled:opacity-40"
            />
            <button
              onClick={sendMessage}
              disabled={!draft.trim() || partnerLeft}
              className="rounded-full bg-signal px-3 py-1 font-display text-xs font-semibold text-ink transition hover:bg-signal/90 disabled:opacity-30"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ping-slow { 0% { transform: scale(0.6); opacity: .8; } 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes ping-slower { 0% { transform: scale(0.6); opacity: .6; } 100% { transform: scale(1.6); opacity: 0; } }
        .animate-ping-slow { animation: ping-slow 1.8s ease-out infinite; }
        .animate-ping-slower { animation: ping-slower 1.8s ease-out .3s infinite; }
      `}</style>
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
