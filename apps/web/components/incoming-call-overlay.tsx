"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/api";
import { getRealtimeSocket } from "@/lib/realtime";
import { useSession } from "@/lib/session";

type IncomingCallPayload = {
  meetingId: string;
  callType: "VIDEO" | "VOZ";
  channelId: string;
  channelName: string;
  callerUserId: string;
  joinUrl: string;
};

const INCOMING_CALL_TIMEOUT_MS = 30_000;

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
};

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.8a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.28-1.28a2 2 0 012.11-.45c.9.35 1.84.59 2.8.72a2 2 0 011.72 2.02z"
    />
  </svg>
);

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <rect x="3" y="6" width="13" height="12" rx="2" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 10l5-3v10l-5-3" />
  </svg>
);

const PhoneDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.5 14.5a18 18 0 0117 0l-.9 2.7a2 2 0 01-2 1.4l-2.4-.3a2 2 0 01-1.7-1.5l-.4-1.8a12 12 0 00-4.2 0l-.4 1.8a2 2 0 01-1.7 1.5l-2.4.3a2 2 0 01-2-1.4l-.9-2.7z"
    />
  </svg>
);

export const IncomingCallOverlay = () => {
  const token = useAuthStore((state) => state.accessToken);
  const session = useSession();
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setIncomingCall(null);
    setElapsed(0);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleReject = useCallback(() => {
    if (!incomingCall || !token) {
      dismiss();
      return;
    }
    const socket = getRealtimeSocket(token);
    socket.emit("call:reject", {
      meetingId: incomingCall.meetingId,
      channelId: incomingCall.channelId
    });
    dismiss();
  }, [dismiss, incomingCall, token]);

  const handleAccept = useCallback(() => {
    if (!incomingCall || !token) {
      dismiss();
      return;
    }
    const socket = getRealtimeSocket(token);
    socket.emit("call:answer", {
      meetingId: incomingCall.meetingId,
      channelId: incomingCall.channelId
    });
    const callUrl = `/call?meetingId=${encodeURIComponent(incomingCall.meetingId)}&callType=${encodeURIComponent(incomingCall.callType)}`;
    window.open(callUrl, "_blank", "noopener,noreferrer");
    dismiss();
  }, [dismiss, incomingCall, token]);

  useEffect(() => {
    if (!token) return;

    const socket = getRealtimeSocket(token);
    const currentUserId = session.data?.id ?? "";

    const onIncomingCall = (payload: IncomingCallPayload) => {
      if (payload.callerUserId === currentUserId) return;

      setIncomingCall(payload);
      setElapsed(0);

      timeoutRef.current = setTimeout(() => {
        setIncomingCall((current) => {
          if (current?.meetingId === payload.meetingId) {
            socket.emit("call:reject", {
              meetingId: payload.meetingId,
              channelId: payload.channelId
            });
            return null;
          }
          return current;
        });
      }, INCOMING_CALL_TIMEOUT_MS);
    };

    const onCallAnswered = (data: { meetingId: string }) => {
      setIncomingCall((current) => (current?.meetingId === data.meetingId ? null : current));
    };

    socket.on("call:incoming", onIncomingCall);
    socket.on("call:answered", onCallAnswered);

    return () => {
      socket.off("call:incoming", onIncomingCall);
      socket.off("call:answered", onCallAnswered);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [session.data?.id, token]);

  useEffect(() => {
    if (!incomingCall) return;
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Date.now() - start);
    }, 100);
    return () => clearInterval(id);
  }, [incomingCall]);

  if (!incomingCall) return null;

  const isVoice = incomingCall.callType === "VOZ";
  const callLabel = isVoice ? "Llamada de voz entrante" : "Videollamada entrante";
  const remainingPct = Math.max(0, 100 - (elapsed / INCOMING_CALL_TIMEOUT_MS) * 100);
  const remainingSec = Math.max(0, Math.ceil((INCOMING_CALL_TIMEOUT_MS - elapsed) / 1000));

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center px-4 pt-6 pointer-events-none">
      <div
        role="dialog"
        aria-live="polite"
        aria-label={callLabel}
        className="animate-in slide-in-from-top fade-in duration-300 pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[rgba(20,22,33,0.94)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <div className="pointer-events-none absolute -left-12 -top-16 h-40 w-40 rounded-full bg-[#6f77ff]/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 -bottom-12 h-36 w-36 rounded-full bg-[#838aff]/15 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-[#6f77ff]/25 animate-ping" />
            <span className="absolute inset-1 rounded-full bg-[#6f77ff]/30 animate-pulse" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#6f77ff] to-[#4a52d4] text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
              {getInitials(incomingCall.channelName)}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-white/60">
              {isVoice ? <PhoneIcon /> : <VideoIcon />}
              <span>{isVoice ? "Voz" : "Video"}</span>
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white">{incomingCall.channelName}</p>
            <p className="text-xs text-white/60">Entrante · {remainingSec}s</p>
          </div>
        </div>

        <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#6f77ff] transition-all duration-100 ease-linear"
            style={{ width: `${remainingPct}%` }}
          />
        </div>

        <div className="relative mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReject}
            className="group flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-2.5 text-sm font-semibold text-red-200 transition-all duration-150 hover:bg-red-500/25 active:scale-[0.98]"
            aria-label="Rechazar"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white transition-transform group-hover:rotate-[135deg]">
              <PhoneDownIcon />
            </span>
            Rechazar
          </button>

          <button
            type="button"
            onClick={handleAccept}
            className="group flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(16,185,129,0.25)] transition-all duration-150 hover:bg-emerald-500/35 active:scale-[0.98]"
            aria-label="Aceptar"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
              {isVoice ? <PhoneIcon /> : <VideoIcon />}
            </span>
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};
