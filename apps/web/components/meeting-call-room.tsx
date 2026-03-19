"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@corelia/ui";
import { useVideoCall, type PeersCaller } from "@sawport/peers-caller";
import { apiRequest, useAuthStore } from "@/lib/api";
import { withDashboardContext } from "@/lib/context";
import {
  buildParticipantRail,
  selectGalleryParticipants,
  selectStageParticipant,
  type CallVisualParticipant
} from "@/components/meeting-call-room-state";
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
  hasLiveVideo: boolean;
  hasLiveAudio: boolean;
};

type MeetingTopBarProps = {
  title: string;
  startsAtLabel: string;
  meetingStatusLabel: string;
  connected: boolean;
  participantCount: number;
  connecting: boolean;
  onReconnect: () => void;
  onLeave: () => void;
};

type StageSurfaceProps = {
  participant: UiParticipant | null;
  participantName: string | null;
};

type ParticipantRailProps = {
  participants: UiParticipant[];
  memberNameById: Map<string, string>;
  projectStatusByUserId: Map<string, ProjectMemberStatus>;
};

type ControlDockProps = {
  connected: boolean;
  localAudioOn: boolean;
  localVideoOn: boolean;
  localScreenSharing: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short"
  });

const formatMeetingStatus = (status: MeetingDetails["status"] | undefined) => {
  if (!status) {
    return "Conectando";
  }

  switch (status) {
    case "PROGRAMADA":
      return "Programada";
    case "EN_CURSO":
      return "En curso";
    case "FINALIZADA":
      return "Finalizada";
    case "CANCELADA":
      return "Cancelada";
    default:
      return status;
  }
};

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

const MeetingTopBar = ({
  title,
  startsAtLabel,
  meetingStatusLabel,
  connected,
  participantCount,
  connecting,
  onReconnect,
  onLeave
}: MeetingTopBarProps) => (
  <header className="teams-call-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
    <div className="min-w-0">
      <h1 className="truncate text-base font-semibold text-[--teams-call-text] sm:text-lg">{title}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[--teams-call-muted]">
        <span>{startsAtLabel}</span>
        <span className="teams-call-pill">{meetingStatusLabel}</span>
        <span className={connected ? "teams-call-pill teams-call-pill--success" : "teams-call-pill"}>
          {connected ? `${participantCount} participante(s)` : "Sin conexión"}
        </span>
      </p>
    </div>

    <div className="flex items-center gap-2">
      {!connected ? (
        <Button
          type="button"
          className="h-9 rounded-xl bg-[--teams-call-accent] px-3 text-xs text-white hover:bg-[--teams-call-accent-hover]"
          disabled={connecting}
          onClick={onReconnect}
        >
          {connecting ? "Conectando..." : "Reintentar"}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="danger"
        className="h-9 rounded-xl bg-[#c4314b] px-3 text-xs text-white hover:bg-[#b42a43]"
        onClick={onLeave}
      >
        Salir
      </Button>
    </div>
  </header>
);

const StageSurface = ({ participant, participantName }: StageSurfaceProps) => {
  if (!participant || !participantName) {
    return (
      <div className="teams-call-stage-surface flex min-h-[260px] items-center justify-center text-sm text-[--teams-call-muted] sm:min-h-[380px] xl:min-h-[520px]">
        Conéctate para iniciar la videollamada.
      </div>
    );
  }

  const canRenderVideo = Boolean(participant.stream && (participant.hasLiveVideo || participant.screenSharing));
  const header = participant.screenSharing ? "Pantalla compartida" : "Vista principal";

  return (
    <div className="teams-call-stage-surface">
      <div className="flex items-center justify-between gap-2 border-b border-[--teams-call-border-soft] px-3 py-2 text-xs text-[--teams-call-muted]">
        <span>{header}</span>
        <span className="truncate text-[--teams-call-text]">{participantName}</span>
      </div>
      <div className="flex min-h-[240px] items-center justify-center bg-[#11131a] sm:min-h-[360px] xl:min-h-[500px]">
        {canRenderVideo && participant.stream ? (
          <StreamVideo
            stream={participant.stream}
            muted
            mirror={participant.isLocal && !participant.screenSharing}
            className="h-full max-h-[500px] w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[--teams-call-accent-soft] text-2xl font-semibold text-white">
              {getInitials(participantName)}
            </div>
            <p className="text-sm text-[--teams-call-muted]">
              {participant.videoOn ? "Esperando video..." : `${participantName} tiene la cámara apagada`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const ParticipantRail = ({
  participants,
  memberNameById,
  projectStatusByUserId
}: ParticipantRailProps) => (
  <aside className="teams-call-panel flex min-h-[260px] flex-col rounded-2xl p-3 sm:min-h-[320px]">
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[--teams-call-muted]">
      Participantes
    </h2>
    {participants.length === 0 ? (
      <p className="flex-1 rounded-xl border border-dashed border-[--teams-call-border] px-3 py-8 text-center text-sm text-[--teams-call-muted]">
        Sin participantes conectados.
      </p>
    ) : (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
        {participants.map((participant) => {
          const fullName = memberNameById.get(participant.userId) ?? participant.userId;
          const status = projectStatusByUserId.get(participant.userId);
          const canRenderVideo = Boolean(
            participant.stream && (participant.hasLiveVideo || participant.screenSharing)
          );

          return (
            <article
              key={participant.userId}
              className="rounded-xl border border-[--teams-call-border] bg-[--teams-call-surface-2] p-2"
            >
              <div className="relative overflow-hidden rounded-lg border border-[--teams-call-border-soft] bg-[#161a24]">
                {canRenderVideo && participant.stream ? (
                  <StreamVideo
                    stream={participant.stream}
                    muted
                    mirror={participant.isLocal && !participant.screenSharing}
                    className="h-24 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-full items-center justify-center bg-[#161a24] text-base font-semibold text-[--teams-call-text]">
                    {getInitials(fullName)}
                  </div>
                )}
              </div>

              <div className="mt-2 space-y-1">
                <p className="truncate text-sm font-medium text-[--teams-call-text]">
                  {fullName}
                  {participant.isLocal ? " (Tú)" : ""}
                </p>
                <p className="text-[11px] text-[--teams-call-muted]">
                  Mic {participant.audioOn ? "on" : "off"} · Cam {participant.videoOn ? "on" : "off"}
                  {participant.screenSharing ? " · Compartiendo" : ""}
                </p>
                {status ? (
                  <p className="text-[11px] text-[--teams-call-muted]">
                    {status.availability} · {status.activeTasks}/{status.maxActiveTasks} tareas
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    )}
  </aside>
);

const ControlDock = ({
  connected,
  localAudioOn,
  localVideoOn,
  localScreenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeave
}: ControlDockProps) => (
  <footer className="pointer-events-none fixed inset-x-3 bottom-4 z-40 flex justify-center">
    <div className="pointer-events-auto flex w-full max-w-[640px] items-center justify-center gap-2 rounded-2xl border border-[--teams-call-border] bg-[--teams-call-panel]/95 px-2 py-2 shadow-[var(--teams-call-shadow-strong)] backdrop-blur-xl sm:gap-3 sm:px-3">
      <button
        type="button"
        className={`teams-call-dock-btn ${localAudioOn ? "teams-call-dock-btn--active" : "teams-call-dock-btn--warn"}`}
        disabled={!connected}
        onClick={onToggleAudio}
        aria-pressed={localAudioOn}
      >
        <span className="teams-call-dock-btn__label">Mic</span>
        <span className="teams-call-dock-btn__state">{localAudioOn ? "On" : "Off"}</span>
      </button>
      <button
        type="button"
        className={`teams-call-dock-btn ${localVideoOn ? "teams-call-dock-btn--active" : "teams-call-dock-btn--warn"}`}
        disabled={!connected}
        onClick={onToggleVideo}
        aria-pressed={localVideoOn}
      >
        <span className="teams-call-dock-btn__label">Cam</span>
        <span className="teams-call-dock-btn__state">{localVideoOn ? "On" : "Off"}</span>
      </button>
      <button
        type="button"
        className={`teams-call-dock-btn ${localScreenSharing ? "teams-call-dock-btn--accent" : "teams-call-dock-btn--active"}`}
        disabled={!connected}
        onClick={onToggleScreenShare}
        aria-pressed={localScreenSharing}
      >
        <span className="teams-call-dock-btn__label">Pantalla</span>
        <span className="teams-call-dock-btn__state">{localScreenSharing ? "On" : "Off"}</span>
      </button>
      <button type="button" className="teams-call-dock-btn teams-call-dock-btn--danger" onClick={onLeave}>
        <span className="teams-call-dock-btn__label">Salir</span>
        <span className="teams-call-dock-btn__state">Llamada</span>
      </button>
    </div>
  </footer>
);

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

    const backUrl = projectId
      ? withDashboardContext("/meetings", {
          projectId,
          teamId: null
        })
      : "/meetings";
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

    if (meetingQuery.isLoading || meetingQuery.error) {
      return;
    }

    if (!meetingId || !me) {
      return;
    }

    autoJoinAttemptedRef.current = true;
    void handleJoinCall();
  }, [handleJoinCall, hydrated, meetingId, me, meetingQuery.error, meetingQuery.isLoading, token]);

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
          isLocal: false,
          hasLiveVideo: hasLiveVideoTrack(participant.stream),
          hasLiveAudio: hasLiveAudioTrack(participant.stream)
        })),
    [libParticipants, me]
  );

  useEffect(() => {
    const activeRemoteUsers = new Set(remoteParticipants.map((participant) => participant.userId));

    for (const participant of remoteParticipants) {
      if (participant.stream && participant.hasLiveAudio) {
        lastAudibleRemoteStreamByUserRef.current.set(participant.userId, participant.stream);
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
          liveAudio: participant.hasLiveAudio,
          liveVideo: participant.hasLiveVideo
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
      isLocal: true,
      hasLiveVideo: hasLiveVideoTrack(localParticipant.stream),
      hasLiveAudio: hasLiveAudioTrack(localParticipant.stream)
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

  const visualParticipants = useMemo<CallVisualParticipant[]>(
    () =>
      allParticipants.map((participant) => ({
        userId: participant.userId,
        isLocal: participant.isLocal,
        screenSharing: participant.screenSharing,
        hasLiveVideo: participant.hasLiveVideo,
        hasLiveAudio: participant.hasLiveAudio
      })),
    [allParticipants]
  );

  const participantsById = useMemo(
    () => new Map(allParticipants.map((participant) => [participant.userId, participant])),
    [allParticipants]
  );

  const activeStageVisual = useMemo(
    () => selectStageParticipant(visualParticipants),
    [visualParticipants]
  );

  const activeStageParticipant = useMemo(
    () => (activeStageVisual ? participantsById.get(activeStageVisual.userId) ?? null : null),
    [activeStageVisual, participantsById]
  );

  const galleryParticipants = useMemo(
    () =>
      selectGalleryParticipants(visualParticipants, activeStageVisual?.userId ?? null, 6)
        .map((participant) => participantsById.get(participant.userId))
        .filter((participant): participant is UiParticipant => Boolean(participant)),
    [activeStageVisual?.userId, participantsById, visualParticipants]
  );

  const participantRail = useMemo(
    () =>
      buildParticipantRail(visualParticipants, activeStageVisual?.userId ?? null)
        .map((participant) => participantsById.get(participant.userId))
        .filter((participant): participant is UiParticipant => Boolean(participant)),
    [activeStageVisual?.userId, participantsById, visualParticipants]
  );

  const remoteAudioSinks = useMemo(
    () =>
      remoteParticipants
        .map((participant) => {
          if (participant.stream && participant.hasLiveAudio) {
            return {
              userId: participant.userId,
              stream: participant.stream
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
      remoteCount: remoteParticipants.length,
      sinkCount: remoteAudioSinks.length
    });
  }, [activeStageParticipant?.userId, remoteAudioSinks.length, remoteParticipants.length]);

  const localAudioOn = localUiParticipant?.audioOn ?? false;
  const localVideoOn = localUiParticipant?.videoOn ?? false;
  const localScreenSharing = localUiParticipant?.screenSharing ?? false;
  const activeStageName = activeStageParticipant
    ? memberNameById.get(activeStageParticipant.userId) ?? activeStageParticipant.userId
    : null;

  if (!hydrated) {
    return (
      <main className="teams-call flex min-h-screen items-center justify-center px-4 text-[--teams-call-text]">
        <p className="text-sm text-[--teams-call-muted]">Cargando llamada...</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="teams-call flex min-h-screen items-center justify-center px-4">
        <div className="teams-call-panel max-w-md rounded-2xl p-5 text-center">
          <p className="text-sm text-[--teams-call-text]">
            Sesión no válida. Inicia sesión de nuevo para entrar a la llamada.
          </p>
          <Button
            className="mt-3 h-9 rounded-xl bg-[--teams-call-accent] px-3 text-xs text-white hover:bg-[--teams-call-accent-hover]"
            onClick={() => (window.location.href = "/login")}
          >
            Ir a login
          </Button>
        </div>
      </main>
    );
  }

  if (meetingQuery.error) {
    return (
      <main className="teams-call flex min-h-screen items-center justify-center px-4">
        <div className="teams-call-panel max-w-md rounded-2xl p-5 text-center">
          <p className="text-sm text-[--teams-call-text]">{meetingQuery.error.message}</p>
          <Button
            className="mt-3 h-9 rounded-xl bg-[--teams-call-accent] px-3 text-xs text-white hover:bg-[--teams-call-accent-hover]"
            onClick={() => {
              window.location.href = projectId
                ? withDashboardContext("/meetings", {
                    projectId,
                    teamId: null
                  })
                : "/meetings";
            }}
          >
            Volver a reuniones
          </Button>
        </div>
      </main>
    );
  }

  const title = meetingQuery.data?.title ?? `Reunión ${meetingId.slice(0, 8)}`;

  return (
    <main className="teams-call min-h-screen px-3 py-3 text-[--teams-call-text] sm:px-4 lg:px-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1820px] flex-col pb-28">
        <MeetingTopBar
          title={title}
          startsAtLabel={meetingQuery.data ? formatDateTime(meetingQuery.data.startsAt) : "Conectando..."}
          meetingStatusLabel={formatMeetingStatus(meetingQuery.data?.status)}
          connected={connected}
          participantCount={allParticipants.length}
          connecting={connecting}
          onReconnect={() => void handleJoinCall()}
          onLeave={() => void handleLeaveCall()}
        />

        <div className="mt-3 grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="teams-call-panel flex min-h-[420px] flex-col gap-3 rounded-2xl p-3 sm:p-4">
            {callError ? (
              <p className="rounded-xl border border-[#6f2a35] bg-[#4b1f29] px-3 py-2 text-sm text-[#ffd9df]">
                {callError}
              </p>
            ) : null}
            {callWarning ? (
              <p className="rounded-xl border border-[#7d6835] bg-[#463b1d] px-3 py-2 text-sm text-[#f7e8b0]">
                {callWarning}
              </p>
            ) : null}
            {audioPlaybackBlocked ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#3c4f7a] bg-[#1c263b] px-3 py-2">
                <p className="text-xs text-[#c9d5ff]">
                  El navegador bloqueó audio remoto. Presiona para activarlo.
                </p>
                <Button
                  type="button"
                  className="h-8 rounded-lg bg-[--teams-call-accent] px-3 text-xs text-white hover:bg-[--teams-call-accent-hover]"
                  onClick={handleUnlockAudioPlayback}
                >
                  Activar audio
                </Button>
              </div>
            ) : null}

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

            <StageSurface participant={activeStageParticipant} participantName={activeStageName} />

            {galleryParticipants.length > 0 ? (
              <div className="teams-call-gallery">
                {galleryParticipants.map((participant) => {
                  const fullName = memberNameById.get(participant.userId) ?? participant.userId;
                  const canRenderVideo = Boolean(
                    participant.stream && (participant.hasLiveVideo || participant.screenSharing)
                  );

                  return (
                    <article
                      key={participant.userId}
                      className="teams-call-gallery-tile rounded-xl border border-[--teams-call-border] bg-[--teams-call-surface-2] p-2"
                    >
                      <div className="overflow-hidden rounded-lg border border-[--teams-call-border-soft] bg-[#121621]">
                        {canRenderVideo && participant.stream ? (
                          <StreamVideo
                            stream={participant.stream}
                            muted
                            mirror={participant.isLocal && !participant.screenSharing}
                            className="h-20 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-20 w-full items-center justify-center bg-[#121621] text-sm font-semibold text-[--teams-call-text]">
                            {getInitials(fullName)}
                          </div>
                        )}
                      </div>
                      <p className="mt-2 truncate text-xs text-[--teams-call-muted]">
                        {fullName}
                        {participant.isLocal ? " (Tú)" : ""}
                      </p>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>

          <ParticipantRail
            participants={participantRail}
            memberNameById={memberNameById}
            projectStatusByUserId={projectStatusByUserId}
          />
        </div>
      </div>

      <ControlDock
        connected={connected}
        localAudioOn={localAudioOn}
        localVideoOn={localVideoOn}
        localScreenSharing={localScreenSharing}
        onToggleAudio={() => toggleAudio(!localAudioOn)}
        onToggleVideo={() => toggleVideo(!localVideoOn)}
        onToggleScreenShare={() => {
          if (localScreenSharing) {
            void stopScreenShare();
            return;
          }
          void startScreenShare().catch((shareError) => {
            const message =
              shareError instanceof Error ? shareError.message : "No se pudo iniciar la pantalla compartida.";
            setCallWarning(message);
          });
        }}
        onLeave={() => void handleLeaveCall()}
      />
    </main>
  );
};
