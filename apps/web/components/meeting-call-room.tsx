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
import { getRealtimeBaseUrl, getRealtimePath, getRealtimeSocket } from "@/lib/realtime";
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
  remoteScreenSharing: boolean;
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
  <header className="teams-call-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 backdrop-blur-xl">
    <div className="min-w-0">
      <h1 className="truncate text-base font-semibold tracking-tight text-[--teams-call-text] sm:text-lg">{title}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[--teams-call-muted]">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-70 ${connected ? "animate-ping bg-emerald-400" : "bg-amber-400"}`}
            />
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`}
            />
          </span>
          {connected ? `En vivo · ${participantCount} ${participantCount === 1 ? "participante" : "participantes"}` : "Sin conexión"}
        </span>
        <span className="text-white/30">·</span>
        <span>{startsAtLabel}</span>
        <span className="teams-call-pill">{meetingStatusLabel}</span>
      </p>
    </div>

    <div className="flex items-center gap-2">
      {!connected ? (
        <Button
          type="button"
          className="h-9 rounded-xl bg-[--teams-call-accent] px-3 text-xs font-medium text-white shadow-sm transition-all hover:bg-[--teams-call-accent-hover] active:scale-[0.98]"
          disabled={connecting}
          onClick={onReconnect}
        >
          {connecting ? "Conectando…" : "Reintentar"}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="danger"
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#c4314b] px-3 text-xs font-medium text-white shadow-sm transition-all hover:bg-[#b42a43] active:scale-[0.98]"
        onClick={onLeave}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 14.5a18 18 0 0117 0l-.9 2.7a2 2 0 01-2 1.4l-2.4-.3a2 2 0 01-1.7-1.5l-.4-1.8a12 12 0 00-4.2 0l-.4 1.8a2 2 0 01-1.7 1.5l-2.4.3a2 2 0 01-2-1.4l-.9-2.7z" />
        </svg>
        Salir
      </Button>
    </div>
  </header>
);

const StageSurface = ({ participant, participantName }: StageSurfaceProps) => {
  if (!participant || !participantName) {
    return (
      <div className="teams-call-stage-surface relative flex min-h-[260px] items-center justify-center text-sm text-[--teams-call-muted] sm:min-h-[380px] xl:min-h-[520px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-[--teams-call-border] animate-pulse" />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-[--teams-call-muted]">
              <rect x="3" y="6" width="13" height="12" rx="2" strokeLinejoin="round" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 10l5-3v10l-5-3" />
            </svg>
          </div>
          <p className="text-sm text-[--teams-call-muted]">Conéctate para iniciar la videollamada.</p>
        </div>
      </div>
    );
  }

  const canRenderVideo = Boolean(participant.stream && (participant.hasLiveVideo || participant.screenSharing));
  const header = participant.screenSharing ? "Pantalla compartida" : "Vista principal";

  return (
    <div className="teams-call-stage-surface relative">
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
            <div className="relative flex h-24 w-24 items-center justify-center">
              {participant.hasLiveAudio ? (
                <>
                  <span className="absolute inset-0 rounded-full bg-[--teams-call-accent]/25 animate-ping" />
                  <span className="absolute -inset-2 rounded-full border-2 border-[--teams-call-accent]/40" />
                </>
              ) : null}
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[--teams-call-accent] to-[--teams-call-accent-soft] text-2xl font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_30px_rgba(0,0,0,0.3)]">
                {getInitials(participantName)}
              </div>
            </div>
            <p className="text-sm text-[--teams-call-muted]">
              {participant.videoOn ? "Esperando video…" : `${participantName} tiene la cámara apagada`}
            </p>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-md">
        {participant.screenSharing ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3">
            <rect x="3" y="4" width="18" height="12" rx="2" strokeLinejoin="round" />
            <path strokeLinecap="round" d="M8 20h8M12 16v4" />
          </svg>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-[--teams-call-accent]" />
        )}
        <span>{header}</span>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 inline-flex max-w-[70%] items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${participant.hasLiveAudio ? "bg-emerald-400" : "bg-white/40"}`} />
        <span className="truncate">{participantName}</span>
      </div>
    </div>
  );
};

const ParticipantRail = ({
  participants,
  memberNameById,
  projectStatusByUserId
}: ParticipantRailProps) => (
  <aside className="teams-call-panel flex min-h-[260px] flex-col rounded-2xl p-3 backdrop-blur-xl sm:min-h-[320px]">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[--teams-call-muted]">
        Participantes
      </h2>
      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium tabular-nums text-[--teams-call-muted]">
        {participants.length}
      </span>
    </div>
    {participants.length === 0 ? (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[--teams-call-border] px-3 py-8 text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-[--teams-call-muted] opacity-60">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <p className="text-xs text-[--teams-call-muted]">Sin participantes conectados.</p>
      </div>
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
              className="group rounded-xl border border-[--teams-call-border] bg-[--teams-call-surface-2] p-2 transition-colors duration-150 hover:border-white/20"
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
                  <div className="flex h-24 w-full items-center justify-center bg-gradient-to-br from-[#1b1f2c] to-[#121621]">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-all ${
                        participant.hasLiveAudio
                          ? "bg-gradient-to-br from-[--teams-call-accent] to-[--teams-call-accent-hover] ring-2 ring-[--teams-call-accent]/50"
                          : "bg-[--teams-call-accent-soft]"
                      }`}
                    >
                      {getInitials(fullName)}
                    </div>
                  </div>
                )}

                <div className="pointer-events-none absolute bottom-1 right-1 flex items-center gap-1">
                  {participant.screenSharing ? (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-black/60 text-[--teams-call-accent] backdrop-blur-sm" title="Compartiendo">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                        <rect x="3" y="4" width="18" height="12" rx="2" />
                      </svg>
                    </span>
                  ) : null}
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-md backdrop-blur-sm ${
                      participant.audioOn ? "bg-black/60 text-white" : "bg-red-500/80 text-white"
                    }`}
                    title={participant.audioOn ? "Micrófono activado" : "Silenciado"}
                  >
                    {participant.audioOn ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                        <rect x="9" y="3" width="6" height="12" rx="3" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3 w-3">
                        <path strokeLinecap="round" d="M3 3l18 18" />
                        <path d="M9 7v4a3 3 0 005.12 2.12M15 12V6a3 3 0 00-5.6-1.5" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-md backdrop-blur-sm ${
                      participant.videoOn ? "bg-black/60 text-white" : "bg-white/15 text-white/50"
                    }`}
                    title={participant.videoOn ? "Cámara activada" : "Cámara apagada"}
                  >
                    {participant.videoOn ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                        <rect x="3" y="6" width="13" height="12" rx="2" />
                        <path d="M16 10l5-3v10l-5-3" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3 w-3">
                        <path strokeLinecap="round" d="M3 3l18 18" />
                        <path d="M16 10l5-3v10l-1-0.6" />
                      </svg>
                    )}
                  </span>
                </div>

                {participant.isLocal ? (
                  <span className="pointer-events-none absolute left-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/80 backdrop-blur-sm">
                    Tú
                  </span>
                ) : null}
              </div>

              <div className="mt-2 space-y-0.5">
                <p className="truncate text-xs font-medium text-[--teams-call-text]">{fullName}</p>
                {status ? (
                  <p className="truncate text-[10px] text-[--teams-call-muted]">
                    {status.availability} · {status.activeTasks}/{status.maxActiveTasks}
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

const MicOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path strokeLinecap="round" d="M5 11a7 7 0 0014 0M12 18v3" />
  </svg>
);

const MicOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <path strokeLinecap="round" d="M3 3l18 18" />
    <path d="M9 7v4a3 3 0 005.12 2.12M15 12V6a3 3 0 00-5.6-1.5" />
    <path strokeLinecap="round" d="M5 11a7 7 0 001.56 4.4M19 11a7 7 0 01-2 4.85M12 18v3" />
  </svg>
);

const CamOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <rect x="3" y="6" width="13" height="12" rx="2" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 10l5-3v10l-5-3" />
  </svg>
);

const CamOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <path strokeLinecap="round" d="M3 3l18 18" />
    <path strokeLinejoin="round" d="M16 10l5-3v10l-1-0.6M14 18H5a2 2 0 01-2-2V8a2 2 0 012-2h1" />
  </svg>
);

const ScreenShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <rect x="3" y="4" width="18" height="12" rx="2" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 20h8M12 16v4M9 11l3-3 3 3M12 8v5" />
  </svg>
);

const HangUpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.5 14.5a18 18 0 0117 0l-.9 2.7a2 2 0 01-2 1.4l-2.4-.3a2 2 0 01-1.7-1.5l-.4-1.8a12 12 0 00-4.2 0l-.4 1.8a2 2 0 01-1.7 1.5l-2.4.3a2 2 0 01-2-1.4l-.9-2.7z"
    />
  </svg>
);

type DockButtonProps = {
  icon: React.ReactNode;
  label: string;
  tone: "active" | "warn" | "accent" | "danger" | "disabled";
  disabled?: boolean;
  onClick?: () => void;
  pressed?: boolean;
  title?: string;
  stateText?: string;
};

const DockButton = ({ icon, label, tone, disabled, onClick, pressed, title, stateText }: DockButtonProps) => {
  const toneClass: Record<DockButtonProps["tone"], string> = {
    active: "border-white/10 bg-white/[0.06] hover:bg-white/[0.12] text-white",
    warn: "border-amber-400/40 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100",
    accent: "border-[color:var(--teams-call-accent)]/60 bg-[color:var(--teams-call-accent)]/30 hover:bg-[color:var(--teams-call-accent)]/45 text-white",
    danger: "border-red-400/40 bg-red-500/80 hover:bg-red-500 text-white",
    disabled: "border-white/5 bg-white/[0.03] text-white/35"
  };
  return (
    <button
      type="button"
      className={`group relative inline-flex min-h-[44px] min-w-[52px] items-center justify-center rounded-xl border px-3 py-2 transition-all duration-150 active:translate-y-[1px] disabled:cursor-not-allowed ${toneClass[tone]} sm:min-w-[60px]`}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      title={title ?? label}
    >
      {icon}
      {stateText ? (
        <span className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-white/55">
          {stateText}
        </span>
      ) : null}
    </button>
  );
};

const ControlDock = ({
  connected,
  localAudioOn,
  localVideoOn,
  localScreenSharing,
  remoteScreenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeave
}: ControlDockProps) => {
  const screenShareDisabled = !connected || (remoteScreenSharing && !localScreenSharing);
  const screenShareTone: DockButtonProps["tone"] = localScreenSharing
    ? "accent"
    : screenShareDisabled
      ? "disabled"
      : "active";

  return (
    <footer className="pointer-events-none fixed inset-x-3 bottom-4 z-40 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-black/55 px-3 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:gap-3 sm:px-4">
        <DockButton
          icon={localAudioOn ? <MicOnIcon /> : <MicOffIcon />}
          label={localAudioOn ? "Silenciar micrófono" : "Activar micrófono"}
          tone={localAudioOn ? "active" : "warn"}
          disabled={!connected}
          onClick={onToggleAudio}
          pressed={localAudioOn}
        />
        <DockButton
          icon={localVideoOn ? <CamOnIcon /> : <CamOffIcon />}
          label={localVideoOn ? "Apagar cámara" : "Encender cámara"}
          tone={localVideoOn ? "active" : "warn"}
          disabled={!connected}
          onClick={onToggleVideo}
          pressed={localVideoOn}
        />
        <DockButton
          icon={<ScreenShareIcon />}
          label={localScreenSharing ? "Detener compartir" : "Compartir pantalla"}
          tone={screenShareTone}
          disabled={screenShareDisabled}
          onClick={onToggleScreenShare}
          pressed={localScreenSharing}
          {...(remoteScreenSharing && !localScreenSharing
            ? { title: "Otro participante está compartiendo pantalla", stateText: "Ocupado" }
            : {})}
        />
        <span className="mx-1 h-6 w-px bg-white/10" aria-hidden />
        <DockButton icon={<HangUpIcon />} label="Salir de la llamada" tone="danger" onClick={onLeave} />
      </div>
    </footer>
  );
};

export const MeetingCallRoom = ({
  meetingId,
  projectId,
  callType = "VIDEO"
}: {
  meetingId: string;
  projectId?: string;
  callType?: "VIDEO" | "VOZ";
}) => {
  const isVoiceOnly = callType === "VOZ";
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
      video: !isVoiceOnly,
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
  const remoteScreenSharing = remoteParticipants.some((p) => p.screenSharing);
  const activeStageName = activeStageParticipant
    ? memberNameById.get(activeStageParticipant.userId) ?? activeStageParticipant.userId
    : null;

  const notifyScreenShareState = useCallback(
    (sharing: boolean) => {
      if (!token || !meetingId) return;
      try {
        const sock = getRealtimeSocket(token);
        sock.emit("meeting:participant:update-state", {
          meetingId,
          screenSharing: sharing
        });
      } catch {
        // best-effort notification
      }
    },
    [token, meetingId]
  );

  // Sync screen share state with API when it changes (covers browser "stop sharing" button)
  const prevScreenSharingRef = useRef(false);
  useEffect(() => {
    const prev = prevScreenSharingRef.current;
    prevScreenSharingRef.current = localScreenSharing;
    if (prev && !localScreenSharing) {
      notifyScreenShareState(false);
    }
  }, [localScreenSharing, notifyScreenShareState]);

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

            {isVoiceOnly ? (
              <div className="relative flex min-h-[300px] flex-wrap items-center justify-center gap-8 overflow-hidden rounded-2xl bg-gradient-to-br from-[--teams-call-surface-2] to-[#0f1320] p-8 sm:min-h-[400px]">
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[--teams-call-accent]/10 blur-3xl" />
                {visualParticipants.length === 0 ? (
                  <div className="relative flex flex-col items-center gap-3 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[--teams-call-border] bg-white/5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-[--teams-call-muted]">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.8a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.28-1.28a2 2 0 012.11-.45c.9.35 1.84.59 2.8.72a2 2 0 011.72 2.02z" />
                      </svg>
                    </div>
                    <p className="text-sm text-[--teams-call-muted]">Esperando participantes…</p>
                  </div>
                ) : (
                  visualParticipants.map((participant) => {
                    const fullName = memberNameById.get(participant.userId) ?? participant.userId;
                    return (
                      <div key={participant.userId} className="relative flex flex-col items-center gap-2">
                        <div className="relative flex h-24 w-24 items-center justify-center">
                          {participant.hasLiveAudio ? (
                            <>
                              <span className="absolute inset-0 rounded-full bg-[--teams-call-accent]/25 animate-ping" />
                              <span className="absolute -inset-1 rounded-full border-2 border-[--teams-call-accent]/50" />
                            </>
                          ) : null}
                          <div
                            className={`relative flex h-20 w-20 items-center justify-center rounded-full text-xl font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_30px_rgba(0,0,0,0.35)] transition-all ${
                              participant.hasLiveAudio
                                ? "bg-gradient-to-br from-[--teams-call-accent] to-[--teams-call-accent-hover]"
                                : "bg-gradient-to-br from-[--teams-call-accent-soft] to-[rgba(111,119,255,0.15)]"
                            }`}
                          >
                            {getInitials(fullName)}
                          </div>
                        </div>
                        <p className="text-sm font-medium text-[--teams-call-text]">
                          {fullName}
                          {participant.isLocal ? <span className="ml-1 text-[--teams-call-muted]">(Tú)</span> : null}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            participant.hasLiveAudio
                              ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                              : "border-white/10 bg-white/5 text-[--teams-call-muted]"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${participant.hasLiveAudio ? "bg-emerald-400" : "bg-white/40"}`} />
                          {participant.hasLiveAudio ? "Hablando" : "En silencio"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <>
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
              </>
            )}
          </section>

          <ParticipantRail
            participants={participantRail}
            memberNameById={memberNameById}
            projectStatusByUserId={projectStatusByUserId}
          />
        </div>
      </div>

      {isVoiceOnly ? (
        <footer className="pointer-events-none fixed inset-x-3 bottom-4 z-40 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-black/55 px-3 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <DockButton
              icon={localAudioOn ? <MicOnIcon /> : <MicOffIcon />}
              label={localAudioOn ? "Silenciar micrófono" : "Activar micrófono"}
              tone={localAudioOn ? "active" : "warn"}
              disabled={!connected}
              onClick={() => toggleAudio(!localAudioOn)}
              pressed={localAudioOn}
            />
            <span className="mx-1 h-6 w-px bg-white/10" aria-hidden />
            <DockButton
              icon={<HangUpIcon />}
              label="Salir de la llamada"
              tone="danger"
              onClick={() => void handleLeaveCall()}
            />
          </div>
        </footer>
      ) : (
        <ControlDock
          connected={connected}
          localAudioOn={localAudioOn}
          localVideoOn={localVideoOn}
          localScreenSharing={localScreenSharing}
          remoteScreenSharing={remoteScreenSharing}
          onToggleAudio={() => toggleAudio(!localAudioOn)}
          onToggleVideo={() => toggleVideo(!localVideoOn)}
          onToggleScreenShare={() => {
            if (localScreenSharing) {
              void stopScreenShare()
                .then(() => notifyScreenShareState(false))
                .catch((stopError) => {
                  notifyScreenShareState(false);
                  const msg = stopError instanceof Error ? stopError.message : String(stopError);
                  if (msg.includes("cannot replace track") || msg.includes("Close called")) {
                    logWebRtcDebug("screen-share-stop-track-error-suppressed", { message: msg });
                    return;
                  }
                  setCallWarning(msg);
                });
              return;
            }
            void startScreenShare()
              .then(() => notifyScreenShareState(true))
              .catch((shareError) => {
                const message =
                  shareError instanceof Error ? shareError.message : "No se pudo iniciar la pantalla compartida.";
                setCallWarning(message);
              });
          }}
          onLeave={() => void handleLeaveCall()}
        />
      )}
    </main>
  );
};
