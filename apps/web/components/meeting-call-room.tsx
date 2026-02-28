"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@corelia/ui";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, useAuthStore } from "@/lib/api";
import { getRealtimeSocket } from "@/lib/realtime";
import { useAuthBootstrap, useSession } from "@/lib/session";

type MeetingDetails = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: "PROGRAMADA" | "EN_CURSO" | "FINALIZADA" | "CANCELADA";
};

type MeetingParticipantState = {
  meetingId: string;
  userId: string;
  muted: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  speaking: boolean;
  joinedAt: string | null;
  leftAt: string | null;
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

type JoinCallAck = {
  ok: boolean;
  message?: string;
  participants?: MeetingParticipantState[];
  media?: {
    available: boolean;
    message: string | null;
  };
};

type ParticipantStateAck = {
  ok: boolean;
  message?: string;
  data?: unknown;
};

type MainSenders = {
  audio: RTCRtpSender;
  video: RTCRtpSender;
};

type MeetingWebRtcSignalPayload = {
  meetingId: string;
  fromUserId: string;
  targetUserId: string | null;
  signalType:
    | "OFFER"
    | "ANSWER"
    | "ICE_CANDIDATE"
    | "SCREEN_SHARE_OFFER"
    | "SCREEN_SHARE_ANSWER"
    | "SCREEN_SHARE_STOP";
  data: Record<string, unknown>;
};

const availabilityLabel: Record<ProjectMemberStatus["availability"], string> = {
  DISPONIBLE: "Disponible",
  OCUPADO: "Ocupado",
  EN_REUNION: "En reunión",
  AUSENTE: "Ausente"
};

const availabilityStyle: Record<ProjectMemberStatus["availability"], string> = {
  DISPONIBLE: "border-emerald-300 bg-emerald-100 text-emerald-900",
  OCUPADO: "border-amber-300 bg-amber-100 text-amber-900",
  EN_REUNION: "border-blue-300 bg-blue-100 text-blue-900",
  AUSENTE: "border-slate-300 bg-slate-200 text-slate-800"
};

const WEBRTC_DEBUG_ENABLED = process.env.NEXT_PUBLIC_WEBRTC_DEBUG === "true";

const upsertParticipant = (
  previous: MeetingParticipantState[],
  payload: MeetingParticipantState
): MeetingParticipantState[] => {
  const index = previous.findIndex((participant) => participant.userId === payload.userId);

  if (index < 0) {
    return [...previous, payload];
  }

  const next = [...previous];
  next[index] = {
    ...next[index],
    ...payload
  };
  return next;
};

const stopStream = (stream: MediaStream | null) => {
  if (!stream) {
    return;
  }
  for (const track of stream.getTracks()) {
    track.stop();
  }
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short"
  });

const findSenderByKind = (
  peerConnection: RTCPeerConnection,
  kind: "audio" | "video"
): RTCRtpSender | undefined =>
  peerConnection.getTransceivers().find((transceiver) => {
    if (transceiver.sender.track?.kind === kind) {
      return true;
    }
    return transceiver.receiver.track?.kind === kind;
  })?.sender ?? peerConnection.getSenders().find((sender) => sender.track?.kind === kind);

const hasLiveVideoTrack = (stream: MediaStream | undefined | null): boolean =>
  Boolean(
    stream?.getVideoTracks().some((track) => track.readyState === "live" && track.enabled !== false)
  );

const logWebRtcDebug = (
  level: "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown>
) => {
  if (!WEBRTC_DEBUG_ENABLED) {
    return;
  }

  const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  logger(`[WebRTC] ${message}`, context);
};

const StreamVideo = ({
  stream,
  muted = false,
  className
}: {
  stream: MediaStream;
  muted?: boolean;
  className: string;
}) => {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    ref.current.srcObject = stream;
    void ref.current.play().catch(() => {
      // Ignorado: el navegador puede bloquear autoplay sin gesto del usuario.
    });
  }, [stream]);

  return <video ref={ref} autoPlay muted={muted} playsInline className={className} />;
};

const StreamAudio = ({ stream }: { stream: MediaStream }) => {
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    ref.current.srcObject = stream;
    void ref.current.play().catch(() => {
      // Ignorado: el navegador puede bloquear autoplay sin gesto del usuario.
    });
  }, [stream]);

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
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeMeetingRef = useRef<string | null>(null);
  const localMediaRef = useRef<MediaStream | null>(null);
  const screenMediaRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const mainSendersRef = useRef<Map<string, MainSenders>>(new Map());
  const screenPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const screenSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingScreenIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const disconnectedTimersRef = useRef<Map<string, number>>(new Map());
  const screenDisconnectedTimersRef = useRef<Map<string, number>>(new Map());
  const autoJoinAttemptedRef = useRef(false);

  const [activeCallMeetingId, setActiveCallMeetingId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<MeetingParticipantState[]>([]);
  const [callError, setCallError] = useState<string | null>(null);
  const [callWarning, setCallWarning] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [localState, setLocalState] = useState({
    muted: false,
    cameraOn: true,
    screenSharing: false,
    speaking: false
  });
  const [localMediaStream, setLocalMediaStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});

  const meetingQuery = useQuery({
    queryKey: ["meeting-details", meetingId],
    queryFn: () => apiRequest<MeetingDetails>(`/meetings/${meetingId}`),
    enabled: Boolean(meetingId && token)
  });

  const projectMembersQuery = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () =>
      apiRequest<{ members: ProjectMember[] }>(`/projects/${projectId}/members`),
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
      apiRequest<ProjectMemberStatus[]>(
        `/tasks/project-members?projectId=${encodeURIComponent(projectId!)}`
      ),
    enabled: Boolean(projectId && token)
  });

  useEffect(() => {
    activeMeetingRef.current = activeCallMeetingId;
  }, [activeCallMeetingId]);

  useEffect(() => {
    localMediaRef.current = localMediaStream;
    const element = localVideoRef.current;
    if (!element) {
      return;
    }
    element.srcObject = localMediaStream;
  }, [localMediaStream]);

  useEffect(() => {
    screenMediaRef.current = screenStream;
    const element = screenVideoRef.current;
    if (!element) {
      return;
    }
    element.srcObject = screenStream;
  }, [screenStream]);

  useEffect(() => {
    return () => {
      const currentMeetingId = activeMeetingRef.current;
      if (token && currentMeetingId) {
        const socket = getRealtimeSocket(token);
        socket.emit("meeting:call:leave", { meetingId: currentMeetingId });
      }
      for (const timerId of disconnectedTimersRef.current.values()) {
        window.clearTimeout(timerId);
      }
      disconnectedTimersRef.current.clear();
      for (const timerId of screenDisconnectedTimersRef.current.values()) {
        window.clearTimeout(timerId);
      }
      screenDisconnectedTimersRef.current.clear();
      for (const peerConnection of peerConnectionsRef.current.values()) {
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.close();
      }
      for (const peerConnection of screenPeerConnectionsRef.current.values()) {
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.close();
      }
      peerConnectionsRef.current.clear();
      mainSendersRef.current.clear();
      screenPeerConnectionsRef.current.clear();
      screenSendersRef.current.clear();
      pendingIceRef.current.clear();
      pendingScreenIceRef.current.clear();
      stopStream(localMediaRef.current);
      stopStream(screenMediaRef.current);
    };
  }, [token]);

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

  const activeParticipants = useMemo(
    () => participants.filter((participant) => !participant.leftAt),
    [participants]
  );

  const me = session.data?.id ?? "";

  const orderedParticipants = useMemo(
    () =>
      [...participants].sort((a, b) => {
        if (a.leftAt && !b.leftAt) {
          return 1;
        }
        if (!a.leftAt && b.leftAt) {
          return -1;
        }
        if (a.speaking && !b.speaking) {
          return -1;
        }
        if (!a.speaking && b.speaking) {
          return 1;
        }
        return (a.joinedAt ?? "").localeCompare(b.joinedAt ?? "");
      }),
    [participants]
  );

  const screenSharingParticipant = useMemo(
    () => activeParticipants.find((participant) => participant.screenSharing) ?? null,
    [activeParticipants]
  );

  const activeStageParticipant = useMemo(() => {
    if (screenSharingParticipant) {
      return screenSharingParticipant;
    }

    const speaking = activeParticipants.find((participant) => participant.speaking);
    if (speaking) {
      return speaking;
    }

    const remoteWithVideo = activeParticipants.find(
      (participant) => participant.userId !== me && hasLiveVideoTrack(remoteStreams[participant.userId])
    );
    if (remoteWithVideo) {
      return remoteWithVideo;
    }

    const remoteWithCamera = activeParticipants.find(
      (participant) => participant.userId !== me && participant.cameraOn
    );
    if (remoteWithCamera) {
      return remoteWithCamera;
    }

    return activeParticipants.find((participant) => participant.userId === me) ?? activeParticipants[0] ?? null;
  }, [activeParticipants, me, remoteStreams, screenSharingParticipant]);

  const clearDisconnectedTimer = useCallback((remoteUserId: string) => {
    const timerId = disconnectedTimersRef.current.get(remoteUserId);
    if (timerId) {
      window.clearTimeout(timerId);
      disconnectedTimersRef.current.delete(remoteUserId);
    }
  }, []);

  const clearScreenDisconnectedTimer = useCallback((remoteUserId: string) => {
    const timerId = screenDisconnectedTimersRef.current.get(remoteUserId);
    if (timerId) {
      window.clearTimeout(timerId);
      screenDisconnectedTimersRef.current.delete(remoteUserId);
    }
  }, []);

  const closePeerConnection = useCallback((remoteUserId: string) => {
    clearDisconnectedTimer(remoteUserId);
    const peerConnection = peerConnectionsRef.current.get(remoteUserId);
    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
      peerConnectionsRef.current.delete(remoteUserId);
    }

    mainSendersRef.current.delete(remoteUserId);
    pendingIceRef.current.delete(remoteUserId);
    setRemoteStreams((current) => {
      if (!current[remoteUserId]) {
        return current;
      }
      const next = { ...current };
      delete next[remoteUserId];
      return next;
    });
  }, [clearDisconnectedTimer]);

  const closeScreenPeerConnection = useCallback((remoteUserId: string) => {
    clearScreenDisconnectedTimer(remoteUserId);
    const peerConnection = screenPeerConnectionsRef.current.get(remoteUserId);
    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
      screenPeerConnectionsRef.current.delete(remoteUserId);
    }

    screenSendersRef.current.delete(remoteUserId);
    pendingScreenIceRef.current.delete(remoteUserId);
    setRemoteScreenStreams((current) => {
      if (!current[remoteUserId]) {
        return current;
      }
      const next = { ...current };
      delete next[remoteUserId];
      return next;
    });
  }, [clearScreenDisconnectedTimer]);

  const closeAllPeerConnections = useCallback(() => {
    for (const timerId of disconnectedTimersRef.current.values()) {
      window.clearTimeout(timerId);
    }
    disconnectedTimersRef.current.clear();
    for (const remoteUserId of peerConnectionsRef.current.keys()) {
      closePeerConnection(remoteUserId);
    }
    peerConnectionsRef.current.clear();
    mainSendersRef.current.clear();
    pendingIceRef.current.clear();
    setRemoteStreams({});
  }, [closePeerConnection]);

  const closeAllScreenPeerConnections = useCallback(() => {
    for (const timerId of screenDisconnectedTimersRef.current.values()) {
      window.clearTimeout(timerId);
    }
    screenDisconnectedTimersRef.current.clear();
    for (const remoteUserId of screenPeerConnectionsRef.current.keys()) {
      closeScreenPeerConnection(remoteUserId);
    }
    screenPeerConnectionsRef.current.clear();
    screenSendersRef.current.clear();
    pendingScreenIceRef.current.clear();
    setRemoteScreenStreams({});
  }, [closeScreenPeerConnection]);

  const sendWebRtcSignal = useCallback(
    (
      input: {
        targetUserId: string;
        signalType:
          | "OFFER"
          | "ANSWER"
          | "ICE_CANDIDATE"
          | "SCREEN_SHARE_OFFER"
          | "SCREEN_SHARE_ANSWER"
          | "SCREEN_SHARE_STOP";
        data: Record<string, unknown>;
      },
      forcedMeetingId?: string
    ) => {
      if (!token) {
        return;
      }

      const socket = getRealtimeSocket(token);
      const channel =
        input.signalType === "ICE_CANDIDATE"
          ? String((input.data.channel as string | undefined) ?? "main")
          : input.signalType.startsWith("SCREEN")
            ? "screen"
            : "main";
      logWebRtcDebug("info", "Emit signal", {
        meetingId: forcedMeetingId ?? activeMeetingRef.current ?? meetingId,
        targetUserId: input.targetUserId,
        signalType: input.signalType,
        channel
      });
      socket.emit("meeting:webrtc:signal", {
        meetingId: forcedMeetingId ?? activeMeetingRef.current ?? meetingId,
        targetUserId: input.targetUserId,
        signalType: input.signalType,
        data: input.data
      });
    },
    [meetingId, token]
  );

  const flushPendingIce = useCallback(
    async (
      pendingMap: Map<string, RTCIceCandidateInit[]>,
      remoteUserId: string,
      peerConnection: RTCPeerConnection
    ) => {
      const pending = pendingMap.get(remoteUserId) ?? [];
      if (pending.length === 0 || !peerConnection.remoteDescription) {
        return;
      }

      for (const candidate of pending) {
        try {
          await peerConnection.addIceCandidate(candidate);
        } catch (error) {
          logWebRtcDebug("warn", "No se pudo agregar ICE pendiente", {
            remoteUserId,
            channel: pendingMap === pendingScreenIceRef.current ? "screen" : "main",
            connectionState: peerConnection.connectionState,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      pendingMap.delete(remoteUserId);
    },
    []
  );

  const attachMainTracksToPeer = useCallback(
    async (remoteUserId: string, peerOverride?: RTCPeerConnection) => {
      const peerConnection = peerOverride ?? peerConnectionsRef.current.get(remoteUserId);
      if (!peerConnection) {
        return;
      }

      const localStream = localMediaRef.current;
      const audioTrack = localStream?.getAudioTracks()[0] ?? null;
      const videoTrack = localStream?.getVideoTracks()[0] ?? null;
      const cachedSenders = mainSendersRef.current.get(remoteUserId);
      const audioSender = cachedSenders?.audio ?? findSenderByKind(peerConnection, "audio");
      const videoSender = cachedSenders?.video ?? findSenderByKind(peerConnection, "video");

      const replacements: Promise<void>[] = [];
      if (audioSender) {
        replacements.push(
          audioSender.replaceTrack(audioTrack).catch((error) => {
            logWebRtcDebug("warn", "Fallo al adjuntar track de audio", {
              remoteUserId,
              channel: "main",
              error: error instanceof Error ? error.message : String(error)
            });
          })
        );
      }
      if (videoSender) {
        replacements.push(
          videoSender.replaceTrack(videoTrack).catch((error) => {
            logWebRtcDebug("warn", "Fallo al adjuntar track de video", {
              remoteUserId,
              channel: "main",
              error: error instanceof Error ? error.message : String(error)
            });
          })
        );
      }
      await Promise.all(replacements);
    },
    []
  );

  const attachScreenTrackToPeer = useCallback(
    async (remoteUserId: string, peerOverride?: RTCPeerConnection) => {
      const peerConnection = peerOverride ?? screenPeerConnectionsRef.current.get(remoteUserId);
      if (!peerConnection) {
        return;
      }

      const screenTrack = screenMediaRef.current?.getVideoTracks()[0] ?? null;
      const videoSender =
        screenSendersRef.current.get(remoteUserId) ?? findSenderByKind(peerConnection, "video");
      if (!videoSender) {
        return;
      }

      await videoSender.replaceTrack(screenTrack).catch((error) => {
        logWebRtcDebug("warn", "Fallo al adjuntar track de pantalla", {
          remoteUserId,
          channel: "screen",
          error: error instanceof Error ? error.message : String(error)
        });
      });
    },
    []
  );

  const createPeerConnection = useCallback(
    (remoteUserId: string): RTCPeerConnection => {
      const existing = peerConnectionsRef.current.get(remoteUserId);
      if (existing) {
        return existing;
      }

      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });

      const audioTransceiver = peerConnection.addTransceiver("audio", { direction: "sendrecv" });
      const videoTransceiver = peerConnection.addTransceiver("video", { direction: "sendrecv" });
      mainSendersRef.current.set(remoteUserId, {
        audio: audioTransceiver.sender,
        video: videoTransceiver.sender
      });

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }
        sendWebRtcSignal({
          targetUserId: remoteUserId,
          signalType: "ICE_CANDIDATE",
          data: {
            channel: "main",
            candidate: event.candidate.toJSON()
          }
        });
      };

      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
        setRemoteStreams((current) => ({
          ...current,
          [remoteUserId]: remoteStream
        }));
      };

      peerConnection.onconnectionstatechange = () => {
        logWebRtcDebug("info", "Main connection state changed", {
          remoteUserId,
          channel: "main",
          state: peerConnection.connectionState
        });
        if (peerConnection.connectionState === "connected") {
          clearDisconnectedTimer(remoteUserId);
          return;
        }

        if (peerConnection.connectionState === "disconnected") {
          clearDisconnectedTimer(remoteUserId);
          const timerId = window.setTimeout(() => {
            const currentPeer = peerConnectionsRef.current.get(remoteUserId);
            if (currentPeer !== peerConnection) {
              return;
            }
            if (currentPeer.connectionState === "disconnected") {
              closePeerConnection(remoteUserId);
            }
          }, 12000);
          disconnectedTimersRef.current.set(remoteUserId, timerId);
          return;
        }

        if (["failed", "closed"].includes(peerConnection.connectionState)) {
          closePeerConnection(remoteUserId);
        }
      };

      peerConnectionsRef.current.set(remoteUserId, peerConnection);
      void attachMainTracksToPeer(remoteUserId, peerConnection);
      return peerConnection;
    },
    [attachMainTracksToPeer, clearDisconnectedTimer, closePeerConnection, sendWebRtcSignal]
  );

  const connectToRemotePeer = useCallback(
    async (remoteUserId: string, forceOffer = false) => {
      const localUserId = session.data?.id;
      if (!localUserId) {
        return;
      }

      const peerConnection = createPeerConnection(remoteUserId);
      const shouldInitiate = localUserId.localeCompare(remoteUserId) < 0;
      if (!forceOffer && (!shouldInitiate || peerConnection.localDescription)) {
        return;
      }

      try {
        await attachMainTracksToPeer(remoteUserId, peerConnection);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        sendWebRtcSignal({
          targetUserId: remoteUserId,
          signalType: "OFFER",
          data: offer as unknown as Record<string, unknown>
        });
      } catch (error) {
        logWebRtcDebug("error", "Error creando oferta main", {
          remoteUserId,
          channel: "main",
          connectionState: peerConnection.connectionState,
          signalingState: peerConnection.signalingState,
          error: error instanceof Error ? error.message : String(error)
        });
        setCallWarning("No se pudo establecer conexión de medios con algunos participantes.");
      }
    },
    [attachMainTracksToPeer, createPeerConnection, sendWebRtcSignal, session.data?.id]
  );

  const createScreenPeerConnection = useCallback(
    (remoteUserId: string): RTCPeerConnection => {
      const existing = screenPeerConnectionsRef.current.get(remoteUserId);
      if (existing) {
        return existing;
      }

      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });

      const screenTransceiver = peerConnection.addTransceiver("video", { direction: "sendrecv" });
      screenSendersRef.current.set(remoteUserId, screenTransceiver.sender);

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }
        sendWebRtcSignal({
          targetUserId: remoteUserId,
          signalType: "ICE_CANDIDATE",
          data: {
            channel: "screen",
            candidate: event.candidate.toJSON()
          }
        });
      };

      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
        setRemoteScreenStreams((current) => ({
          ...current,
          [remoteUserId]: remoteStream
        }));
      };

      peerConnection.onconnectionstatechange = () => {
        logWebRtcDebug("info", "Screen connection state changed", {
          remoteUserId,
          channel: "screen",
          state: peerConnection.connectionState
        });

        if (peerConnection.connectionState === "connected") {
          clearScreenDisconnectedTimer(remoteUserId);
          return;
        }

        if (peerConnection.connectionState === "disconnected") {
          clearScreenDisconnectedTimer(remoteUserId);
          const timerId = window.setTimeout(() => {
            const currentPeer = screenPeerConnectionsRef.current.get(remoteUserId);
            if (currentPeer !== peerConnection) {
              return;
            }
            if (currentPeer.connectionState === "disconnected") {
              closeScreenPeerConnection(remoteUserId);
            }
          }, 10000);
          screenDisconnectedTimersRef.current.set(remoteUserId, timerId);
          return;
        }

        if (["failed", "closed"].includes(peerConnection.connectionState)) {
          closeScreenPeerConnection(remoteUserId);
        }
      };

      screenPeerConnectionsRef.current.set(remoteUserId, peerConnection);
      void attachScreenTrackToPeer(remoteUserId, peerConnection);
      return peerConnection;
    },
    [attachScreenTrackToPeer, clearScreenDisconnectedTimer, closeScreenPeerConnection, sendWebRtcSignal]
  );

  const connectScreenToRemotePeer = useCallback(
    async (remoteUserId: string, forceOffer = false) => {
      const screenTrack = screenMediaRef.current?.getVideoTracks()[0] ?? null;
      if (!screenTrack || (!localState.screenSharing && !forceOffer)) {
        if (forceOffer) {
          logWebRtcDebug("warn", "Se evitó oferta de pantalla sin track local activo", {
            remoteUserId,
            channel: "screen"
          });
        }
        return;
      }

      const peerConnection = createScreenPeerConnection(remoteUserId);
      if (!forceOffer && peerConnection.localDescription) {
        return;
      }

      try {
        await attachScreenTrackToPeer(remoteUserId, peerConnection);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        sendWebRtcSignal({
          targetUserId: remoteUserId,
          signalType: "SCREEN_SHARE_OFFER",
          data: offer as unknown as Record<string, unknown>
        });
      } catch (error) {
        logWebRtcDebug("error", "Error creando oferta screen", {
          remoteUserId,
          channel: "screen",
          connectionState: peerConnection.connectionState,
          signalingState: peerConnection.signalingState,
          error: error instanceof Error ? error.message : String(error)
        });
        setCallWarning("No se pudo establecer la compartición de pantalla con algunos participantes.");
      }
    },
    [attachScreenTrackToPeer, createScreenPeerConnection, localState.screenSharing, sendWebRtcSignal]
  );

  const emitParticipantStateWithAck = useCallback(
    (patch: Partial<typeof localState>, forcedMeetingId?: string | null) => {
      const targetMeetingId = forcedMeetingId ?? activeMeetingRef.current;
      if (!token || !targetMeetingId) {
        return Promise.resolve<ParticipantStateAck>({
          ok: false,
          message: "No hay sesión activa de llamada"
        });
      }

      const socket = getRealtimeSocket(token);
      return new Promise<ParticipantStateAck>((resolve) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          resolve({
            ok: false,
            message: "No hubo respuesta del servidor al actualizar estado de participante"
          });
        }, 6000);

        socket.emit(
          "meeting:participant:update-state",
          {
            meetingId: targetMeetingId,
            ...patch
          },
          (ack: ParticipantStateAck) => {
            if (settled) {
              return;
            }
            settled = true;
            window.clearTimeout(timeoutId);
            resolve(ack);
          }
        );
      });
    },
    [token]
  );

  const emitParticipantState = useCallback(
    (patch: Partial<typeof localState>, forcedMeetingId?: string | null) => {
      void emitParticipantStateWithAck(patch, forcedMeetingId);
    },
    [emitParticipantStateWithAck]
  );

  const ensureLocalMedia = useCallback(async () => {
    if (localMediaRef.current) {
      return localMediaRef.current;
    }

    if (window.isSecureContext === false) {
      setCallWarning("Para usar cámara y micrófono abre Corelia por HTTPS o desde localhost.");
      return null;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCallWarning("No se encontró acceso a mediaDevices/getUserMedia en este navegador.");
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localMediaRef.current = stream;
      setLocalMediaStream(stream);
      for (const remoteUserId of peerConnectionsRef.current.keys()) {
        void attachMainTracksToPeer(remoteUserId);
      }
      return stream;
    } catch {
      setCallWarning("No se concedió acceso a cámara/micrófono.");
      return null;
    }
  }, [attachMainTracksToPeer]);

  const handleJoinCall = useCallback(async () => {
    if (!token) {
      setCallError("Debes iniciar sesión para usar videollamadas.");
      return;
    }

    setConnecting(true);
    setCallError(null);
    setCallWarning(null);
    closeAllPeerConnections();
    closeAllScreenPeerConnections();

    try {
      const socket = getRealtimeSocket(token);

      const ack = await new Promise<JoinCallAck>((resolve) => {
        socket.emit("meeting:call:join", { meetingId }, (result: JoinCallAck) => resolve(result));
      });

      if (!ack.ok) {
        setCallError(ack.message ?? "No se pudo ingresar a la llamada.");
        return;
      }

      setParticipants(ack.participants ?? []);
      setActiveCallMeetingId(meetingId);

      if (!ack.media?.available) {
        setCallWarning(ack.media?.message ?? "Videollamadas en modo degradado.");
      }

      const localStream = await ensureLocalMedia();
      if (!localStream) {
        setLocalState((current) => ({
          ...current,
          muted: true,
          cameraOn: false
        }));
        emitParticipantState({ muted: true, cameraOn: false }, meetingId);
        return;
      }

      localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });

      setLocalState({
        muted: false,
        cameraOn: true,
        screenSharing: false,
        speaking: false
      });
      emitParticipantState({ muted: false, cameraOn: true, screenSharing: false }, meetingId);
    } finally {
      setConnecting(false);
    }
  }, [
    closeAllPeerConnections,
    closeAllScreenPeerConnections,
    emitParticipantState,
    ensureLocalMedia,
    meetingId,
    token
  ]);

  const handleLeaveCall = () => {
    if (token && activeMeetingRef.current) {
      const socket = getRealtimeSocket(token);
      socket.emit("meeting:call:leave", { meetingId: activeMeetingRef.current });
    }

    closeAllPeerConnections();
    closeAllScreenPeerConnections();
    stopStream(localMediaRef.current);
    stopStream(screenMediaRef.current);
    localMediaRef.current = null;
    screenMediaRef.current = null;
    setLocalMediaStream(null);
    setScreenStream(null);
    setParticipants([]);
    setActiveCallMeetingId(null);
    setCallError(null);
    setCallWarning(null);

    const backUrl = projectId ? `/meetings?projectId=${projectId}` : "/meetings";
    if (window.opener) {
      window.close();
      return;
    }
    window.location.href = backUrl;
  };

  const toggleMuted = () => {
    const nextMuted = !localState.muted;
    localMediaRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setLocalState((current) => ({ ...current, muted: nextMuted }));
    emitParticipantState({ muted: nextMuted });
  };

  const toggleCamera = async () => {
    const nextCameraOn = !localState.cameraOn;

    if (nextCameraOn && !localMediaRef.current) {
      const stream = await ensureLocalMedia();
      if (!stream) {
        setLocalState((current) => ({ ...current, cameraOn: false }));
        emitParticipantState({ cameraOn: false });
        return;
      }
      for (const remoteUserId of peerConnectionsRef.current.keys()) {
        void attachMainTracksToPeer(remoteUserId);
      }
    }

    localMediaRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = nextCameraOn;
    });
    setLocalState((current) => ({ ...current, cameraOn: nextCameraOn }));
    emitParticipantState({ cameraOn: nextCameraOn });
  };

  const toggleSpeaking = () => {
    const nextSpeaking = !localState.speaking;
    setLocalState((current) => ({ ...current, speaking: nextSpeaking }));
    emitParticipantState({ speaking: nextSpeaking });
  };

  const resetLocalScreenShareState = useCallback(
    (notifyPeers: boolean) => {
      stopStream(screenMediaRef.current);
      screenMediaRef.current = null;
      setScreenStream(null);
      if (notifyPeers) {
        for (const remoteUserId of peerConnectionsRef.current.keys()) {
          sendWebRtcSignal({
            targetUserId: remoteUserId,
            signalType: "SCREEN_SHARE_STOP",
            data: {}
          });
        }
      }
      closeAllScreenPeerConnections();
      setLocalState((current) => ({ ...current, screenSharing: false }));
    },
    [closeAllScreenPeerConnections, sendWebRtcSignal]
  );

  const toggleScreenSharing = async () => {
    if (localState.screenSharing) {
      resetLocalScreenShareState(true);
      const ack = await emitParticipantStateWithAck({ screenSharing: false });
      if (!ack.ok) {
        setCallWarning(ack.message ?? "No fue posible actualizar el estado de pantalla compartida.");
      }
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setCallWarning("Tu navegador no soporta compartir pantalla.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      const [track] = stream.getVideoTracks();
      if (track) {
        screenMediaRef.current = stream;
        setScreenStream(stream);
        setLocalState((current) => ({ ...current, screenSharing: true }));
        const ack = await emitParticipantStateWithAck({ screenSharing: true });
        if (!ack.ok) {
          resetLocalScreenShareState(false);
          setCallWarning(ack.message ?? "Ya hay una pantalla compartida activa.");
          return;
        }

        for (const remoteUserId of peerConnectionsRef.current.keys()) {
          void connectScreenToRemotePeer(remoteUserId, true);
        }
        track.onended = () => {
          resetLocalScreenShareState(true);
          void emitParticipantStateWithAck({ screenSharing: false }).then((endedAck) => {
            if (!endedAck.ok) {
              setCallWarning(
                endedAck.message ?? "No fue posible actualizar el estado de pantalla compartida."
              );
            }
          });
        };
        return;
      }
      stopStream(stream);
      setCallWarning("No fue posible iniciar la compartición de pantalla.");
    } catch {
      setCallWarning("No fue posible iniciar la compartición de pantalla.");
    }
  };

  useEffect(() => {
    if (!token || !activeCallMeetingId) {
      return;
    }

    const socket = getRealtimeSocket(token);

    const onParticipantJoined = (payload: {
      meetingId: string;
      userId: string;
      joinedAt: string;
    }) => {
      if (payload.meetingId !== activeCallMeetingId) {
        return;
      }

      setParticipants((prev) =>
        upsertParticipant(prev, {
          meetingId: payload.meetingId,
          userId: payload.userId,
          muted: true,
          cameraOn: false,
          screenSharing: false,
          speaking: false,
          joinedAt: payload.joinedAt,
          leftAt: null
        })
      );
    };

    const onParticipantLeft = (payload: { meetingId: string; userId: string; leftAt: string }) => {
      if (payload.meetingId !== activeCallMeetingId) {
        return;
      }

      setParticipants((prev) =>
        upsertParticipant(prev, {
          meetingId: payload.meetingId,
          userId: payload.userId,
          muted: false,
          cameraOn: false,
          screenSharing: false,
          speaking: false,
          joinedAt: null,
          leftAt: payload.leftAt
        })
      );
      closePeerConnection(payload.userId);
      closeScreenPeerConnection(payload.userId);
    };

    const onParticipantState = (payload: MeetingParticipantState) => {
      if (payload.meetingId !== activeCallMeetingId) {
        return;
      }
      setParticipants((prev) => upsertParticipant(prev, payload));
    };

    const onSignal = (payload: MeetingWebRtcSignalPayload) => {
      if (
        payload.meetingId !== activeCallMeetingId ||
        payload.fromUserId === session.data?.id ||
        (payload.targetUserId && payload.targetUserId !== session.data?.id)
      ) {
        return;
      }

      const channel =
        payload.signalType === "ICE_CANDIDATE"
          ? String((payload.data.channel as string | undefined) ?? "main")
          : payload.signalType.startsWith("SCREEN")
            ? "screen"
            : "main";
      logWebRtcDebug("info", "Receive signal", {
        meetingId: payload.meetingId,
        fromUserId: payload.fromUserId,
        targetUserId: payload.targetUserId,
        signalType: payload.signalType,
        channel
      });

      const handleSignal = async () => {
        const remoteUserId = payload.fromUserId;

        if (payload.signalType === "ICE_CANDIDATE") {
          const isScreenChannel = payload.data.channel === "screen";
          const candidate = ((payload.data.candidate as RTCIceCandidateInit | undefined) ??
            (payload.data as unknown as RTCIceCandidateInit)) as RTCIceCandidateInit;
          const peerConnection = isScreenChannel
            ? createScreenPeerConnection(remoteUserId)
            : createPeerConnection(remoteUserId);
          const pendingMap = isScreenChannel ? pendingScreenIceRef : pendingIceRef;

          if (!candidate?.candidate) {
            logWebRtcDebug("warn", "ICE inválido descartado", {
              remoteUserId,
              channel: isScreenChannel ? "screen" : "main"
            });
            return;
          }

          if (!peerConnection.remoteDescription) {
            const pending = pendingMap.current.get(remoteUserId) ?? [];
            pending.push(candidate);
            pendingMap.current.set(remoteUserId, pending);
            return;
          }

          try {
            await peerConnection.addIceCandidate(candidate);
          } catch (error) {
            logWebRtcDebug("warn", "No se pudo agregar ICE", {
              remoteUserId,
              channel: isScreenChannel ? "screen" : "main",
              connectionState: peerConnection.connectionState,
              signalingState: peerConnection.signalingState,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          return;
        }

        if (payload.signalType === "OFFER") {
          const peerConnection = createPeerConnection(remoteUserId);
          if (peerConnection.signalingState !== "stable") {
            await peerConnection.setLocalDescription({ type: "rollback" }).catch((error) => {
              logWebRtcDebug("warn", "Rollback falló antes de OFFER main", {
                remoteUserId,
                channel: "main",
                signalingState: peerConnection.signalingState,
                error: error instanceof Error ? error.message : String(error)
              });
            });
          }
          await peerConnection.setRemoteDescription(
            payload.data as unknown as RTCSessionDescriptionInit
          );
          await attachMainTracksToPeer(remoteUserId, peerConnection);
          await flushPendingIce(pendingIceRef.current, remoteUserId, peerConnection);

          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          sendWebRtcSignal({
            targetUserId: remoteUserId,
            signalType: "ANSWER",
            data: answer as unknown as Record<string, unknown>
          });
          return;
        }

        if (payload.signalType === "ANSWER") {
          const peerConnection = createPeerConnection(remoteUserId);
          if (peerConnection.signalingState !== "have-local-offer") {
            logWebRtcDebug("warn", "ANSWER main ignorado por estado inesperado", {
              remoteUserId,
              channel: "main",
              signalingState: peerConnection.signalingState
            });
            return;
          }
          await peerConnection.setRemoteDescription(
            payload.data as unknown as RTCSessionDescriptionInit
          );
          await attachMainTracksToPeer(remoteUserId, peerConnection);
          await flushPendingIce(pendingIceRef.current, remoteUserId, peerConnection);
          return;
        }

        if (payload.signalType === "SCREEN_SHARE_OFFER") {
          const peerConnection = createScreenPeerConnection(remoteUserId);
          if (peerConnection.signalingState !== "stable") {
            await peerConnection.setLocalDescription({ type: "rollback" }).catch((error) => {
              logWebRtcDebug("warn", "Rollback falló antes de OFFER screen", {
                remoteUserId,
                channel: "screen",
                signalingState: peerConnection.signalingState,
                error: error instanceof Error ? error.message : String(error)
              });
            });
          }
          await peerConnection.setRemoteDescription(
            payload.data as unknown as RTCSessionDescriptionInit
          );
          await flushPendingIce(pendingScreenIceRef.current, remoteUserId, peerConnection);

          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          sendWebRtcSignal({
            targetUserId: remoteUserId,
            signalType: "SCREEN_SHARE_ANSWER",
            data: answer as unknown as Record<string, unknown>
          });
          return;
        }

        if (payload.signalType === "SCREEN_SHARE_ANSWER") {
          const peerConnection = createScreenPeerConnection(remoteUserId);
          if (peerConnection.signalingState !== "have-local-offer") {
            logWebRtcDebug("warn", "ANSWER screen ignorado por estado inesperado", {
              remoteUserId,
              channel: "screen",
              signalingState: peerConnection.signalingState
            });
            return;
          }
          await peerConnection.setRemoteDescription(
            payload.data as unknown as RTCSessionDescriptionInit
          );
          await flushPendingIce(pendingScreenIceRef.current, remoteUserId, peerConnection);
          return;
        }

        if (payload.signalType === "SCREEN_SHARE_STOP") {
          logWebRtcDebug("info", "Remote detuvo pantalla", {
            remoteUserId,
            channel: "screen"
          });
          closeScreenPeerConnection(remoteUserId);
        }
      };

      void handleSignal().catch((error) => {
        logWebRtcDebug("error", "Error en negociación de señal", {
          remoteUserId: payload.fromUserId,
          signalType: payload.signalType,
          channel,
          error: error instanceof Error ? error.message : String(error)
        });
        setCallWarning("No se pudo completar la negociación WebRTC con un participante.");
      });
    };

    socket.on("meeting:participant-joined", onParticipantJoined);
    socket.on("meeting:participant-left", onParticipantLeft);
    socket.on("meeting:participant-state", onParticipantState);
    socket.on("meeting:webrtc:signal", onSignal);

    return () => {
      socket.off("meeting:participant-joined", onParticipantJoined);
      socket.off("meeting:participant-left", onParticipantLeft);
      socket.off("meeting:participant-state", onParticipantState);
      socket.off("meeting:webrtc:signal", onSignal);
    };
  }, [
    activeCallMeetingId,
    attachMainTracksToPeer,
    closePeerConnection,
    closeScreenPeerConnection,
    createPeerConnection,
    createScreenPeerConnection,
    flushPendingIce,
    sendWebRtcSignal,
    session.data?.id,
    token
  ]);

  useEffect(() => {
    const localUserId = session.data?.id;
    if (!token || !activeCallMeetingId || !localUserId) {
      return;
    }

    const activeOtherUserIds = new Set(
      activeParticipants
        .filter((participant) => participant.userId !== localUserId)
        .map((participant) => participant.userId)
    );

    for (const remoteUserId of [...peerConnectionsRef.current.keys()]) {
      if (!activeOtherUserIds.has(remoteUserId)) {
        closePeerConnection(remoteUserId);
      }
    }

    for (const remoteUserId of activeOtherUserIds) {
      void connectToRemotePeer(remoteUserId);
    }
  }, [
    activeCallMeetingId,
    activeParticipants,
    closePeerConnection,
    connectToRemotePeer,
    session.data?.id,
    token
  ]);

  useEffect(() => {
    const localUserId = session.data?.id;
    if (!token || !activeCallMeetingId || !localUserId) {
      return;
    }

    const desiredScreenPeerIds = new Set(
      activeParticipants
        .filter(
          (participant) =>
            participant.userId !== localUserId &&
            (participant.screenSharing || localState.screenSharing)
        )
        .map((participant) => participant.userId)
    );

    for (const remoteUserId of [...screenPeerConnectionsRef.current.keys()]) {
      if (!desiredScreenPeerIds.has(remoteUserId)) {
        closeScreenPeerConnection(remoteUserId);
      }
    }

    for (const remoteUserId of desiredScreenPeerIds) {
      void connectScreenToRemotePeer(remoteUserId);
    }
  }, [
    activeCallMeetingId,
    activeParticipants,
    closeScreenPeerConnection,
    connectScreenToRemotePeer,
    localState.screenSharing,
    session.data?.id,
    token
  ]);

  useEffect(() => {
    if (!hydrated || !token || autoJoinAttemptedRef.current) {
      return;
    }
    autoJoinAttemptedRef.current = true;
    void handleJoinCall();
  }, [handleJoinCall, hydrated, token]);

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
  const connected = activeCallMeetingId === meetingId;
  const activeStageName = activeStageParticipant
    ? memberNameById.get(activeStageParticipant.userId) ?? activeStageParticipant.userId
    : null;
  const activeStageRemoteStream =
    activeStageParticipant && activeStageParticipant.userId !== me
      ? remoteStreams[activeStageParticipant.userId] ?? null
      : null;
  const activeStageHasRemoteVideo = hasLiveVideoTrack(activeStageRemoteStream);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1700px] flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">{title}</h1>
            <p className="text-xs text-slate-300">
              {meetingQuery.data ? formatDateTime(meetingQuery.data.startsAt) : "Conectando..."} ·{" "}
              {connected ? `${activeParticipants.length} participante(s) conectados` : "Sin conexión activa"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!connected ? (
              <Button
                className="h-9 px-3 text-xs"
                disabled={connecting}
                onClick={() => {
                  void handleJoinCall();
                }}
              >
                {connecting ? "Conectando..." : "Reintentar conexión"}
              </Button>
            ) : null}
            <Button type="button" variant="danger" className="h-9 px-3 text-xs" onClick={handleLeaveCall}>
              Salir de llamada
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1700px] gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 pb-24 shadow-xl sm:pb-4">
          {callError ? (
            <p className="mb-3 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-sm text-red-900">
              {callError}
            </p>
          ) : null}
          {callWarning ? (
            <p className="mb-3 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900">
              {callWarning}
            </p>
          ) : null}

          <div className="grid h-full gap-4">
            <div className="min-h-[520px] rounded-2xl border border-slate-700 bg-black p-3">
              {screenSharingParticipant ? (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
                    Pantalla compartida ·{" "}
                    {memberNameById.get(screenSharingParticipant.userId) ??
                      screenSharingParticipant.userId}
                  </p>
                  {screenSharingParticipant.userId === me && screenStream ? (
                    <video
                      ref={screenVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-[460px] w-full rounded-xl border border-slate-700 bg-slate-950 object-contain"
                    />
                  ) : remoteScreenStreams[screenSharingParticipant.userId] ? (
                    <StreamVideo
                      stream={remoteScreenStreams[screenSharingParticipant.userId]!}
                      muted
                      className="h-[460px] w-full rounded-xl border border-slate-700 bg-slate-950 object-contain"
                    />
                  ) : (
                    <div className="flex h-[460px] w-full items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 px-4 text-center">
                      <p className="text-sm text-slate-300">
                        Pantalla compartida activa. Esperando stream remoto...
                      </p>
                    </div>
                  )}
                </>
              ) : activeStageParticipant ? (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                    Vista principal · {activeStageName}
                  </p>
                  {activeStageParticipant.userId === me && localState.cameraOn && localMediaStream ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-[460px] w-full rounded-xl border border-slate-700 bg-slate-950 object-cover [transform:scaleX(-1)]"
                    />
                  ) : activeStageParticipant.userId !== me && activeStageHasRemoteVideo ? (
                    <StreamVideo
                      stream={activeStageRemoteStream!}
                      className="h-[460px] w-full rounded-xl border border-slate-700 bg-slate-950 object-cover"
                    />
                  ) : (
                    <div className="flex h-[460px] items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 px-4 text-center">
                      {activeStageParticipant.userId !== me && activeStageRemoteStream ? (
                        <StreamAudio stream={activeStageRemoteStream} />
                      ) : null}
                      <p className="text-sm text-slate-300">
                        {activeStageParticipant.userId !== me && activeStageRemoteStream
                          ? "Sin video remoto disponible."
                          : activeStageParticipant.cameraOn
                            ? "Esperando video..."
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
                  localState.muted ? "bg-red-600 hover:bg-red-500" : "bg-slate-700 hover:bg-slate-600"
                }`}
                onClick={toggleMuted}
                disabled={!connected}
              >
                {localState.muted ? "Mic on" : "Silenciar"}
              </Button>
              <Button
                type="button"
                className={`h-9 min-w-0 rounded-xl px-2 text-[11px] font-semibold text-white sm:h-10 sm:rounded-full sm:px-4 sm:text-xs ${
                  localState.cameraOn
                    ? "bg-slate-700 hover:bg-slate-600"
                    : "bg-amber-600 hover:bg-amber-500"
                }`}
                onClick={() => {
                  void toggleCamera();
                }}
                disabled={!connected}
              >
                {localState.cameraOn ? "Cam off" : "Cam on"}
              </Button>
              <Button
                type="button"
                className={`h-9 min-w-0 rounded-xl px-2 text-[11px] font-semibold text-white sm:h-10 sm:rounded-full sm:px-4 sm:text-xs ${
                  localState.screenSharing
                    ? "bg-indigo-600 hover:bg-indigo-500"
                    : "bg-slate-700 hover:bg-slate-600"
                }`}
                onClick={() => {
                  void toggleScreenSharing();
                }}
                disabled={!connected}
              >
                {localState.screenSharing ? "Pantalla off" : "Compartir"}
              </Button>
              <Button
                type="button"
                className={`h-9 min-w-0 rounded-xl px-2 text-[11px] font-semibold text-white sm:h-10 sm:rounded-full sm:px-4 sm:text-xs ${
                  localState.speaking
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-slate-700 hover:bg-slate-600"
                }`}
                onClick={toggleSpeaking}
                disabled={!connected}
              >
                {localState.speaking ? "Silencio" : "Hablando"}
              </Button>
            </div>
          </footer>
        </section>

        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Participantes
          </h2>
          <ul className="mt-3 max-h-[calc(100vh-180px)] space-y-2 overflow-y-auto pr-1">
            {orderedParticipants.map((participant) => {
              const isMe = participant.userId === me;
              const fullName = memberNameById.get(participant.userId) ?? participant.userId;
              const remoteStream = remoteStreams[participant.userId];
              const status = projectStatusByUserId.get(participant.userId);

              return (
                <li
                  key={`${participant.meetingId}-${participant.userId}-right`}
                  className={`rounded-xl border p-2 ${
                    participant.speaking
                      ? "border-emerald-400 bg-slate-800"
                      : "border-slate-700 bg-slate-800/80"
                  }`}
                >
                  <div className="mb-2">
                    {isMe && localState.cameraOn && localMediaStream ? (
                      <StreamVideo
                        stream={localMediaStream}
                        muted
                        className="h-24 w-full rounded-lg border border-slate-700 bg-slate-950 object-cover [transform:scaleX(-1)]"
                      />
                    ) : !isMe && hasLiveVideoTrack(remoteStream) ? (
                      <StreamVideo
                        stream={remoteStream!}
                        className="h-24 w-full rounded-lg border border-slate-700 bg-slate-950 object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-950">
                        {!isMe && remoteStream ? <StreamAudio stream={remoteStream} /> : null}
                        <span className="text-sm font-semibold text-slate-200">
                          {fullName
                            .split(" ")
                            .map((value) => value.charAt(0))
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-white">
                    {fullName}
                    {isMe ? " (Tú)" : ""}
                  </p>
                  <p className="text-[11px] text-slate-200">
                    {participant.muted ? "Mic off" : "Mic on"} ·{" "}
                    {participant.cameraOn ? "Cam on" : "Cam off"}
                  </p>

                  {status ? (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${availabilityStyle[status.availability]}`}
                      >
                        {availabilityLabel[status.availability]}
                      </span>
                      <span className="text-[10px] text-slate-300">
                        {status.activeTasks}/{status.maxActiveTasks} tareas
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </main>
  );
};
