"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@corelia/ui";
import { useVideoCall, type PeersCaller } from "@sawport/peers-caller";
import { apiRequest, useAuthStore } from "@/lib/api";
import { getRealtimeBaseUrl, getRealtimePath } from "@/lib/realtime";
import { useAuthBootstrap, useSession } from "@/lib/session";

type MeetingDetails = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: "PROGRAMADA" | "EN_CURSO" | "FINALIZADA" | "CANCELADA";
};

type ProjectMember = {
  userId: string;
  fullName: string;
};

type ProjectMemberStatus = {
  userId: string;
  fullName: string;
  initials: string;
  availability: "DISPONIBLE" | "OCUPADO" | "EN_REUNION" | "AUSENTE";
  activeTasks: number;
  maxActiveTasks: number;
  overloaded: boolean;
  role: string;
};

type DirectoryUser = {
  userId: string;
  fullName: string;
};

type UiParticipant = {
  userId: string;
  stream: MediaStream | undefined;
  videoOn: boolean;
  audioOn: boolean;
  screenSharing: boolean;
  isLocal: boolean;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short"
  });

const getInitials = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "--";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
};

const hasLiveVideoTrack = (stream?: MediaStream): boolean =>
  Boolean(stream?.getVideoTracks().some((track) => track.readyState === "live" && track.enabled));

const hasLiveAudioTrack = (stream?: MediaStream): boolean =>
  Boolean(stream?.getAudioTracks().some((track) => track.readyState === "live" && track.enabled));

const WEBRTC_DEBUG = process.env.NEXT_PUBLIC_WEBRTC_DEBUG === "true";

const logWebRtcDebug = (...args: unknown[]) => {
  if (!WEBRTC_DEBUG) {
    return;
  }

  console.info("[webrtc-call-room]", ...args);
};

const extractPlaybackErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "El navegador bloqueó la reproducción de audio remota.";
};

const StreamVideo = ({
  stream,
  muted = false,
  className,
  mirror = false
}: {
  stream: MediaStream;
  muted?: boolean;
  className: string;
  mirror?: boolean;
}) => {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    ref.current.srcObject = stream;
    void ref.current.play().catch(() => {
      // Autoplay puede ser bloqueado por el navegador.
    });
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      muted={muted}
      playsInline
      className={className}
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    />
  );
};

const StreamAudio = ({
  stream,
  playNonce,
  onPlaybackStarted,
  onPlaybackBlocked
}: {
  stream: MediaStream;
  playNonce: number;
  onPlaybackStarted?: () => void;
  onPlaybackBlocked?: (reason: string) => void;
}) => {
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    ref.current.srcObject = stream;
    const playPromise = ref.current.play();
    if (playPromise && typeof playPromise.then === "function") {
      void playPromise
        .then(() => {
          onPlaybackStarted?.();
        })
        .catch((playError) => {
          onPlaybackBlocked?.(extractPlaybackErrorMessage(playError));
        });
      return;
    }

    onPlaybackStarted?.();
  }, [onPlaybackBlocked, onPlaybackStarted, playNonce, stream]);

  return <audio ref={ref} autoPlay playsInline />;
};

export const MeetingCallRoom = ({
  meetingId,
  projectId
}: {
  meetingId: string;
  projectId?: string;
}) => {
  const hydrated = useAuthBootstrap();
  const token = useAuthStore((state) => state.accessToken);
  const session = useSession();

  const autoJoinAttemptedRef = useRef(false);
  const lastAudibleRemoteStreamByUserRef = useRef<Map<string, MediaStream>>(new Map());
  const blockedRemoteAudioUsersRef = useRef<Set<string>>(new Set());
  const peersCallerRef = useRef<PeersCaller | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callWarning, setCallWarning] = useState<string | null>(null);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [audioPlayNonce, setAudioPlayNonce] = useState(0);

  const meetingQuery = useQuery({
    queryKey: ["meeting-details", meetingId],
    queryFn: () => apiRequest<MeetingDetails>(`/meetings/${meetingId}`),
    enabled: Boolean(meetingId && token)
  });

  const projectMembersQuery = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => apiRequest<{ members: ProjectMember[] }>(`/projects/${projectId}/members`),
    enabled: Boolean(projectId && token)
  });

  const directoryQuery = useQuery({
    queryKey: ["identity-directory", "call-room"],
    queryFn: () => apiRequest<DirectoryUser[]>("/identity/directory"),
    enabled: Boolean(token)
  });

  const projectStatusQuery = useQuery({
    queryKey: ["project-members-status", projectId, "call-room"],
    queryFn: () =>
      apiRequest<ProjectMemberStatus[]>(`/tasks/project-members?projectId=${encodeURIComponent(projectId!)}`),
    enabled: Boolean(projectId && token)
  });

  const me = session.data?.id ?? "";

  const peersCallbacks = useMemo(
    () => ({
      onError: (errorCode: string, message: string) => {
        const normalized = `${errorCode} ${message}`.toLowerCase();
        if (normalized.includes("nexttick")) {
          setCallWarning(
            "Se detectó un error interno del motor de videollamada. Recarga la página para reconectar."
          );
          logWebRtcDebug("peers-caller-nexttick-runtime-error", {
            errorCode,
            message
          });
          return;
        }

        setCallWarning(message);
      }
    }),
    []
  );

  const socketUrl = useMemo(() => {
    const base = getRealtimeBaseUrl();
    if (base) {
      return base;
    }

    if (typeof window !== "undefined") {
      if (window.location.port === "3000") {
        return `${window.location.protocol}//${window.location.hostname}:4000`;
      }
      return window.location.origin;
    }

    return "http://localhost:4000";
  }, []);

  const {
    initialize,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    participants: libParticipants,
    localParticipant,
    isConnected,
    error,
    cleanup,
    peersCaller
  } = useVideoCall({
    conversationId: meetingId,
    userId: me || "pending-user",
    token: token ?? "",
    socketUrl,
    socketPath: getRealtimePath(),
    maxParticipants: 4,
    mediaConfig: {
      video: true,
      audio: true
    },
    callbacks: peersCallbacks,
    debug: process.env.NEXT_PUBLIC_WEBRTC_DEBUG === "true",
    autoInitialize: false
  });

  useEffect(() => {
    peersCallerRef.current = peersCaller;
  }, [peersCaller]);

  useEffect(() => {
    if (!error) {
      return;
    }

    if (error.toLowerCase().includes("nexttick")) {
      setCallWarning("Se detectó un error interno del motor de videollamada. Recarga la página para reconectar.");
      logWebRtcDebug("hook-error-nexttick", { error });
      return;
    }

    setCallWarning(error);
  }, [error]);

  useEffect(() => {
    setConnected(isConnected);
  }, [isConnected]);

  const handleJoinCall = useCallback(async () => {
    if (!token) {
      setCallError("Debes iniciar sesión para usar videollamadas.");
      return;
    }

    if (!me) {
      setCallError("No se encontró usuario de sesión para iniciar la llamada.");
      return;
    }

    setConnecting(true);
    setCallError(null);
    setCallWarning(null);

    try {
      await initialize();

      let caller = peersCallerRef.current;
      if (!caller) {
        for (let attempt = 0; attempt < 10; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 80));
          caller = peersCallerRef.current;
          if (caller) {
            break;
          }
        }
      }

      if (!caller) {
        throw new Error("No se pudo inicializar el cliente de videollamada.");
      }

      let hasActiveCall = false;
      try {
        const status = await caller.checkCallStatus();
        hasActiveCall = status.hasActiveCall;
        logWebRtcDebug("call-status", {
          meetingId,
          userId: me,
          hasActiveCall: status.hasActiveCall,
          participantCount: status.participantCount,
          canJoin: status.canJoin,
          status: status.status
        });
      } catch (statusError) {
        logWebRtcDebug("call-status-failed-fallback-start", {
          meetingId,
          userId: me,
          error: statusError instanceof Error ? statusError.message : String(statusError)
        });
        setCallWarning("No se pudo validar el estado actual. Intentando iniciar la llamada...");
      }

      const mediaConfig = {
        video: true,
        audio: true
      } as const;

      if (hasActiveCall) {
        logWebRtcDebug("join-call", { meetingId, userId: me });
        await caller.joinCall(mediaConfig);
      } else {
        logWebRtcDebug("start-call", { meetingId, userId: me });
        await caller.startCall(mediaConfig);
      }

      setConnected(true);
    } catch (joinError) {
      const message = joinError instanceof Error ? joinError.message : "No se pudo conectar a la llamada.";
      if (message.toLowerCase().includes("nexttick")) {
        setCallWarning("Se detectó un error interno del motor de videollamada. Recarga la página para reconectar.");
        logWebRtcDebug("join-call-nexttick-error", { meetingId, userId: me, message });
      }
      setCallError(message);
      logWebRtcDebug("join-call-error", { meetingId, userId: me, message });
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [initialize, meetingId, me, token]);

  const handleLeaveCall = useCallback(async () => {
    try {
      if (peersCaller) {
        await peersCaller.leaveCall();
      }
    } catch {
      // Si falla la salida con ack del servidor, continuamos con cleanup local.
    } finally {
      cleanup();
      setConnected(false);
    }

    const backUrl = projectId ? `/meetings?projectId=${projectId}` : "/meetings";
    if (window.opener) {
      window.close();
      return;
    }
    window.location.href = backUrl;
  }, [cleanup, peersCaller, projectId]);

  useEffect(() => {
    if (!hydrated || !token || autoJoinAttemptedRef.current) {
      return;
    }

    if (!meetingId || !me) {
      return;
    }

    autoJoinAttemptedRef.current = true;
    void handleJoinCall();
  }, [handleJoinCall, hydrated, meetingId, me, token]);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();

    for (const member of projectMembersQuery.data?.members ?? []) {
      map.set(member.userId, member.fullName);
    }

    for (const person of directoryQuery.data ?? []) {
      if (!map.has(person.userId)) {
        map.set(person.userId, person.fullName);
      }
    }

    return map;
  }, [directoryQuery.data, projectMembersQuery.data?.members]);

  const projectStatusByUserId = useMemo(
    () => new Map((projectStatusQuery.data ?? []).map((member) => [member.userId, member])),
    [projectStatusQuery.data]
  );

  const remoteParticipants = useMemo<UiParticipant[]>(
    () =>
      libParticipants
        .filter((participant) => participant.userId !== me)
        .map((participant) => ({
          userId: participant.userId,
          stream: participant.stream,
          videoOn: participant.videoOn,
          audioOn: participant.audioOn,
          screenSharing: participant.screenSharing,
          isLocal: false
        })),
    [libParticipants, me]
  );

  useEffect(() => {
    const activeRemoteUsers = new Set(remoteParticipants.map((participant) => participant.userId));

    for (const participant of remoteParticipants) {
      if (hasLiveAudioTrack(participant.stream)) {
        lastAudibleRemoteStreamByUserRef.current.set(participant.userId, participant.stream!);
      }

      if (WEBRTC_DEBUG) {
        const audioTracks = participant.stream?.getAudioTracks().length ?? 0;
        const videoTracks = participant.stream?.getVideoTracks().length ?? 0;
        logWebRtcDebug("participant-tracks", {
          userId: participant.userId,
          audioOn: participant.audioOn,
          videoOn: participant.videoOn,
          streamAudioTracks: audioTracks,
          streamVideoTracks: videoTracks,
          liveAudio: hasLiveAudioTrack(participant.stream),
          liveVideo: hasLiveVideoTrack(participant.stream)
        });
      }
    }

    for (const [userId] of lastAudibleRemoteStreamByUserRef.current) {
      if (!activeRemoteUsers.has(userId)) {
        lastAudibleRemoteStreamByUserRef.current.delete(userId);
      }
    }
  }, [remoteParticipants]);

  const localUiParticipant = useMemo<UiParticipant | null>(() => {
    if (!localParticipant || !me) {
      return null;
    }

    return {
      userId: me,
      stream: localParticipant.stream,
      videoOn: localParticipant.videoOn,
      audioOn: localParticipant.audioOn,
      screenSharing: localParticipant.screenSharing,
      isLocal: true
    };
  }, [localParticipant, me]);

  const allParticipants = useMemo(() => {
    const participants: UiParticipant[] = [];
    if (localUiParticipant) {
      participants.push(localUiParticipant);
    }
    participants.push(...remoteParticipants);
    return participants;
  }, [localUiParticipant, remoteParticipants]);

  const screenSharingParticipant = useMemo(
    () => allParticipants.find((participant) => participant.screenSharing) ?? null,
    [allParticipants]
  );

  const activeStageParticipant = useMemo(() => {
    if (screenSharingParticipant) {
      return screenSharingParticipant;
    }

    const remoteWithVideo = remoteParticipants.find((participant) => hasLiveVideoTrack(participant.stream));
    if (remoteWithVideo) {
      return remoteWithVideo;
    }

    const remoteWithAudio = remoteParticipants.find((participant) => hasLiveAudioTrack(participant.stream));
    if (remoteWithAudio) {
      return remoteWithAudio;
    }

    return localUiParticipant ?? remoteParticipants[0] ?? null;
  }, [localUiParticipant, remoteParticipants, screenSharingParticipant]);

  const remoteAudioSinks = useMemo(
    () =>
      remoteParticipants
        .map((participant) => {
          if (hasLiveAudioTrack(participant.stream)) {
            return {
              userId: participant.userId,
              stream: participant.stream!
            };
          }

          const fallback = lastAudibleRemoteStreamByUserRef.current.get(participant.userId);
          if (fallback && hasLiveAudioTrack(fallback)) {
            return {
              userId: participant.userId,
              stream: fallback
            };
          }

          return null;
        })
        .filter((item): item is { userId: string; stream: MediaStream } => Boolean(item)),
    [remoteParticipants]
  );

  const handleRemoteAudioPlaybackBlocked = useCallback((userId: string, reason: string) => {
    blockedRemoteAudioUsersRef.current.add(userId);
    setAudioPlaybackBlocked(true);
    setCallWarning((current) => current ?? "El navegador bloqueó audio remoto. Presiona \"Activar audio\".");
    logWebRtcDebug("audio-playback-blocked", {
      userId,
      reason
    });
  }, []);

  const handleRemoteAudioPlaybackStarted = useCallback((userId: string) => {
    if (!blockedRemoteAudioUsersRef.current.delete(userId)) {
      return;
    }

    setAudioPlaybackBlocked(blockedRemoteAudioUsersRef.current.size > 0);
    logWebRtcDebug("audio-playback-started", { userId });
  }, []);

  const handleUnlockAudioPlayback = useCallback(() => {
    setAudioPlayNonce((current) => current + 1);
    logWebRtcDebug("audio-playback-retry", {
      sinkCount: remoteAudioSinks.length
    });
  }, [remoteAudioSinks.length]);

  useEffect(() => {
    const activeUsers = new Set(remoteAudioSinks.map((sink) => sink.userId));
    for (const userId of blockedRemoteAudioUsersRef.current) {
      if (!activeUsers.has(userId)) {
        blockedRemoteAudioUsersRef.current.delete(userId);
      }
    }

    setAudioPlaybackBlocked(blockedRemoteAudioUsersRef.current.size > 0);
  }, [remoteAudioSinks]);

  useEffect(() => {
    if (connected) {
      return;
    }

    blockedRemoteAudioUsersRef.current.clear();
    setAudioPlaybackBlocked(false);
  }, [connected]);

  useEffect(() => {
    if (!WEBRTC_DEBUG) {
      return;
    }

    logWebRtcDebug("stage-selection", {
      stageUserId: activeStageParticipant?.userId ?? null,
      hasScreenShare: Boolean(screenSharingParticipant),
      remoteCount: remoteParticipants.length,
      sinkCount: remoteAudioSinks.length
    });
  }, [activeStageParticipant, remoteAudioSinks.length, remoteParticipants.length, screenSharingParticipant]);

  const localAudioOn = localUiParticipant?.audioOn ?? false;
  const localVideoOn = localUiParticipant?.videoOn ?? false;
  const localScreenSharing = localUiParticipant?.screenSharing ?? false;

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <p className="text-sm">Cargando llamada...</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-center">
          <p className="text-sm">Sesión no válida. Inicia sesión de nuevo para entrar a la llamada.</p>
          <Button className="mt-3 h-9 px-3 text-xs" onClick={() => (window.location.href = "/login")}>
            Ir a login
          </Button>
        </div>
      </main>
    );
  }

  const title = meetingQuery.data?.title ?? `Reunión ${meetingId.slice(0, 8)}`;
  const activeStageName = activeStageParticipant
    ? memberNameById.get(activeStageParticipant.userId) ?? activeStageParticipant.userId
    : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1700px] flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">{title}</h1>
            <p className="text-xs text-slate-300">
              {meetingQuery.data ? formatDateTime(meetingQuery.data.startsAt) : "Conectando..."} ·{" "}
              {isConnected ? `${allParticipants.length} participante(s) conectados` : "Sin conexión activa"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!connected ? (
              <Button className="h-9 px-3 text-xs" disabled={connecting} onClick={() => void handleJoinCall()}>
                {connecting ? "Conectando..." : "Reintentar conexión"}
              </Button>
            ) : null}
            <Button type="button" variant="danger" className="h-9 px-3 text-xs" onClick={() => void handleLeaveCall()}>
              Salir de llamada
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1700px] gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 pb-24 shadow-xl sm:pb-4">
          {callError ? (
            <p className="mb-3 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-sm text-red-900">{callError}</p>
          ) : null}
          {callWarning ? (
            <p className="mb-3 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900">
              {callWarning}
            </p>
          ) : null}
          {audioPlaybackBlocked ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-300 bg-blue-100 px-3 py-2">
              <p className="text-xs text-blue-900">El navegador bloqueó audio remoto. Presiona para activarlo.</p>
              <Button type="button" className="h-8 bg-blue-700 px-3 text-xs text-white hover:bg-blue-600" onClick={handleUnlockAudioPlayback}>
                Activar audio
              </Button>
            </div>
          ) : null}

          <div className="grid h-full gap-4">
            <div className="hidden">
              {remoteAudioSinks.map((sink) => (
                <StreamAudio
                  key={`${sink.userId}-${sink.stream.id}`}
                  stream={sink.stream}
                  playNonce={audioPlayNonce}
                  onPlaybackBlocked={(reason) => handleRemoteAudioPlaybackBlocked(sink.userId, reason)}
                  onPlaybackStarted={() => handleRemoteAudioPlaybackStarted(sink.userId)}
                />
              ))}
            </div>
            <div className="min-h-[520px] rounded-2xl border border-slate-700 bg-black p-3">
              {activeStageParticipant ? (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                    {screenSharingParticipant ? "Pantalla compartida" : "Vista principal"} · {activeStageName}
                  </p>
                  {activeStageParticipant.stream ? (
                    <StreamVideo
                      stream={activeStageParticipant.stream}
                      muted
                      mirror={activeStageParticipant.isLocal && !activeStageParticipant.screenSharing}
                      className="h-[460px] w-full rounded-xl border border-slate-700 bg-slate-950 object-cover"
                    />
                  ) : (
                    <div className="flex h-[460px] items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 px-4 text-center">
                      <p className="text-sm text-slate-300">
                        {activeStageParticipant.videoOn
                          ? "Esperando stream de video..."
                          : `${activeStageName} tiene la cámara apagada`}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-[460px] items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 px-4 text-center">
                  <p className="text-sm text-slate-400">Conéctate para iniciar la videollamada.</p>
                </div>
              )}
            </div>
          </div>

          <footer className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-slate-700 bg-slate-950/95 px-3 py-2 backdrop-blur sm:static sm:inset-auto sm:bottom-auto sm:z-auto sm:mt-4 sm:rounded-full sm:bg-slate-950/90">
            <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center">
              <Button
                type="button"
                className={`h-9 min-w-0 rounded-xl px-2 text-[11px] font-semibold text-white sm:h-10 sm:rounded-full sm:px-4 sm:text-xs ${
                  localAudioOn ? "bg-slate-700 hover:bg-slate-600" : "bg-red-600 hover:bg-red-500"
                }`}
                onClick={() => toggleAudio(!localAudioOn)}
                disabled={!connected}
              >
                {localAudioOn ? "Silenciar" : "Mic on"}
              </Button>
              <Button
                type="button"
                className={`h-9 min-w-0 rounded-xl px-2 text-[11px] font-semibold text-white sm:h-10 sm:rounded-full sm:px-4 sm:text-xs ${
                  localVideoOn ? "bg-slate-700 hover:bg-slate-600" : "bg-amber-600 hover:bg-amber-500"
                }`}
                onClick={() => toggleVideo(!localVideoOn)}
                disabled={!connected}
              >
                {localVideoOn ? "Cam off" : "Cam on"}
              </Button>
              <Button
                type="button"
                className={`h-9 min-w-0 rounded-xl px-2 text-[11px] font-semibold text-white sm:h-10 sm:rounded-full sm:px-4 sm:text-xs ${
                  localScreenSharing ? "bg-indigo-600 hover:bg-indigo-500" : "bg-slate-700 hover:bg-slate-600"
                }`}
                onClick={() => {
                  if (localScreenSharing) {
                    void stopScreenShare();
                    return;
                  }
                  void startScreenShare().catch((shareError) => {
                    const message =
                      shareError instanceof Error
                        ? shareError.message
                        : "No se pudo iniciar la pantalla compartida.";
                    setCallWarning(message);
                  });
                }}
                disabled={!connected}
              >
                {localScreenSharing ? "Pantalla off" : "Compartir"}
              </Button>
              <Button
                type="button"
                className="h-9 min-w-0 rounded-xl bg-slate-700 px-2 text-[11px] font-semibold text-white hover:bg-slate-600 sm:h-10 sm:rounded-full sm:px-4 sm:text-xs"
                onClick={() => toggleAudio(localAudioOn)}
                disabled
              >
                Hablando
              </Button>
            </div>
          </footer>
        </section>

        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">Participantes</h2>
          <div className="space-y-3">
            {allParticipants.map((participant) => {
              const fullName = memberNameById.get(participant.userId) ?? participant.userId;
              const status = projectStatusByUserId.get(participant.userId);
              const hasVideo = hasLiveVideoTrack(participant.stream);

              return (
                <article key={participant.userId} className="rounded-xl border border-slate-700 bg-slate-800/60 p-2">
                  <div className="relative overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                    {participant.stream && hasVideo ? (
                      <StreamVideo
                        stream={participant.stream}
                        muted
                        mirror={participant.isLocal && !participant.screenSharing}
                        className="h-28 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-28 w-full items-center justify-center bg-slate-950 text-lg font-semibold text-slate-200">
                        {getInitials(fullName)}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {fullName}
                      {participant.isLocal ? " (Tú)" : ""}
                    </p>
                    <p className="text-xs text-slate-300">
                      Mic {participant.audioOn ? "on" : "off"} · Cam {participant.videoOn ? "on" : "off"}
                      {participant.screenSharing ? " · Compartiendo" : ""}
                    </p>
                    {status ? (
                      <p className="text-xs text-slate-400">
                        {status.availability} · {status.activeTasks}/{status.maxActiveTasks} tareas
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}

            {allParticipants.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 px-3 py-6 text-center text-sm text-slate-400">
                Sin participantes conectados.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
};
