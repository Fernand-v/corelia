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

  const emitParticipantState = useCallback(
    (patch: Partial<typeof localState>, forcedMeetingId?: string | null) => {
      const targetMeetingId = forcedMeetingId ?? activeMeetingRef.current;
      if (!token || !targetMeetingId) {
        return;
      }

      const socket = getRealtimeSocket(token);
      socket.emit("meeting:participant:update-state", {
        meetingId: targetMeetingId,
        ...patch
      });
    },
    [token]
  );

  const ensureLocalMedia = useCallback(async () => {
    if (localMediaRef.current) {
      return localMediaRef.current;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCallWarning("Tu navegador no soporta cámara y micrófono.");
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalMediaStream(stream);
      return stream;
    } catch {
      setCallWarning("No se concedió acceso a cámara/micrófono.");
      return null;
    }
  }, []);

  const handleJoinCall = useCallback(async () => {
    if (!token) {
      setCallError("Debes iniciar sesión para usar videollamadas.");
      return;
    }

    setConnecting(true);
    setCallError(null);
    setCallWarning(null);

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
  }, [emitParticipantState, ensureLocalMedia, meetingId, token]);

  const handleLeaveCall = () => {
    if (token && activeMeetingRef.current) {
      const socket = getRealtimeSocket(token);
      socket.emit("meeting:call:leave", { meetingId: activeMeetingRef.current });
    }

    stopStream(localMediaRef.current);
    stopStream(screenMediaRef.current);
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

  const toggleScreenSharing = async () => {
    if (localState.screenSharing) {
      stopStream(screenMediaRef.current);
      setScreenStream(null);
      setLocalState((current) => ({ ...current, screenSharing: false }));
      emitParticipantState({ screenSharing: false });
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
      setScreenStream(stream);
      setLocalState((current) => ({ ...current, screenSharing: true }));
      emitParticipantState({ screenSharing: true });

      const [track] = stream.getVideoTracks();
      if (track) {
        track.onended = () => {
          stopStream(stream);
          setScreenStream(null);
          setLocalState((current) => ({ ...current, screenSharing: false }));
          emitParticipantState({ screenSharing: false });
        };
      }
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
          muted: false,
          cameraOn: true,
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
    };

    const onParticipantState = (payload: MeetingParticipantState) => {
      if (payload.meetingId !== activeCallMeetingId) {
        return;
      }
      setParticipants((prev) => upsertParticipant(prev, payload));
    };

    const onSignal = (payload: { meetingId: string }) => {
      if (payload.meetingId !== activeCallMeetingId) {
        return;
      }
      setCallWarning((current) => current ?? "Conexión de medios activa.");
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
  }, [activeCallMeetingId, token]);

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
  const me = session.data?.id ?? "";

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

      <div className="mx-auto grid w-full max-w-[1700px] gap-4 p-4 xl:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-3 shadow-xl">
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

          <div className="grid h-full gap-3">
            <div className="min-h-[360px] rounded-2xl border border-slate-700 bg-black p-3">
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
                      className="h-[300px] w-full rounded-xl border border-slate-700 bg-slate-950 object-contain"
                    />
                  ) : (
                    <div className="flex h-[300px] w-full items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 px-4 text-center">
                      <p className="text-sm text-slate-300">
                        Vista de pantalla compartida activa. El stream remoto se muestra cuando el nodo de medios esté disponible.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 px-4 text-center">
                  <p className="text-sm text-slate-400">
                    Sin pantalla compartida. Usa “Compartir pantalla” para mostrar contenido.
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {orderedParticipants.map((participant) => {
                const isMe = participant.userId === me;
                const fullName = memberNameById.get(participant.userId) ?? participant.userId;

                return (
                  <article
                    key={`${participant.meetingId}-${participant.userId}`}
                    className={`rounded-2xl border p-3 ${
                      participant.speaking
                        ? "border-emerald-400 bg-slate-800"
                        : "border-slate-700 bg-slate-800/85"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {fullName}
                        {isMe ? " (Tú)" : ""}
                      </p>
                      <span className="text-[11px] text-slate-200">
                        {participant.leftAt ? "Fuera" : "En llamada"}
                      </span>
                    </div>

                    {isMe && localState.cameraOn && localMediaStream ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="h-28 w-full rounded-lg border border-slate-700 bg-slate-950 object-cover"
                      />
                    ) : (
                      <div className="flex h-28 w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-950">
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

                    <p className="mt-2 text-xs text-slate-200">
                      {participant.cameraOn ? "Cámara encendida" : "Cámara apagada"} ·{" "}
                      {participant.muted ? "Micrófono silenciado" : "Micrófono activo"}
                    </p>
                    <p className="text-xs text-slate-300">
                      {participant.screenSharing ? "Compartiendo pantalla" : "Sin compartir pantalla"} ·{" "}
                      {participant.speaking ? "Hablando" : "En silencio"}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>

          <footer className="mt-4 border-t border-slate-800 pt-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-9 border border-slate-600 bg-slate-800 px-3 text-xs text-slate-50 hover:bg-slate-700"
                onClick={toggleMuted}
                disabled={!connected}
              >
                {localState.muted ? "Activar micrófono" : "Silenciar"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-9 border border-slate-600 bg-slate-800 px-3 text-xs text-slate-50 hover:bg-slate-700"
                onClick={() => {
                  void toggleCamera();
                }}
                disabled={!connected}
              >
                {localState.cameraOn ? "Apagar cámara" : "Encender cámara"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-9 border border-slate-600 bg-slate-800 px-3 text-xs text-slate-50 hover:bg-slate-700"
                onClick={() => {
                  void toggleScreenSharing();
                }}
                disabled={!connected}
              >
                {localState.screenSharing ? "Detener pantalla" : "Compartir pantalla"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-9 border border-slate-600 bg-slate-800 px-3 text-xs text-slate-50 hover:bg-slate-700"
                onClick={toggleSpeaking}
                disabled={!connected}
              >
                {localState.speaking ? "Marcar silencio" : "Marcar hablando"}
              </Button>
            </div>
          </footer>
        </section>

        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Participantes y estado
          </h2>
          <ul className="mt-3 space-y-2">
            {orderedParticipants.map((participant) => {
              const fullName = memberNameById.get(participant.userId) ?? participant.userId;
              const status = projectStatusByUserId.get(participant.userId);

              return (
                <li
                  key={`${participant.meetingId}-${participant.userId}-right`}
                  className="rounded-xl border border-slate-700 bg-slate-800 p-3"
                >
                  <p className="text-sm font-semibold text-white">{fullName}</p>
                  <p className="text-xs text-slate-200">
                    {participant.leftAt ? "Fuera de llamada" : "Conectado"} ·{" "}
                    {participant.speaking ? "Hablando" : "Silencio"}
                  </p>
                  <p className="text-xs text-slate-300">
                    {participant.muted ? "Mic apagado" : "Mic activo"} ·{" "}
                    {participant.cameraOn ? "Cámara activa" : "Cámara apagada"}
                  </p>

                  {status ? (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${availabilityStyle[status.availability]}`}
                      >
                        {availabilityLabel[status.availability]}
                      </span>
                      <span className="text-[11px] text-slate-300">
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
