"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

export const IncomingCallOverlay = () => {
  const router = useRouter();
  const token = useAuthStore((state) => state.accessToken);
  const session = useSession();
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setIncomingCall(null);
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
      // Don't show overlay for our own calls
      if (payload.callerUserId === currentUserId) return;

      setIncomingCall(payload);

      // Auto-reject after timeout
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
      // Someone else answered, dismiss if it's the same call
      setIncomingCall((current) => {
        if (current?.meetingId === data.meetingId) return null;
        return current;
      });
    };

    socket.on("call:incoming", onIncomingCall);
    socket.on("call:answered", onCallAnswered);

    return () => {
      socket.off("call:incoming", onIncomingCall);
      socket.off("call:answered", onCallAnswered);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [session.data?.id, token]);

  if (!incomingCall) return null;

  const callLabel = incomingCall.callType === "VOZ" ? "Llamada de voz" : "Videollamada";
  const callIcon = incomingCall.callType === "VOZ" ? "📞" : "🎥";

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-8">
      <div className="animate-in slide-in-from-top fade-in duration-300 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#128c7e]/10 text-2xl">
            {callIcon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">{callLabel} entrante</p>
            <p className="truncate text-xs text-slate-500">{incomingCall.channelName}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleReject}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-lg text-white shadow-lg transition hover:bg-red-600 active:scale-95"
            title="Rechazar"
          >
            ✕
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-lg text-white shadow-lg transition hover:bg-green-600 active:scale-95"
            title="Aceptar"
          >
            ✓
          </button>
        </div>
      </div>
    </div>
  );
};
