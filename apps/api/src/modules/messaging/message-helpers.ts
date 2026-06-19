import type { MessageKind } from "@prisma/client";

// Helpers puros (sin acceso a base de datos) extraídos de MessagingService
// para reducir el tamaño del servicio y poder testearlos de forma aislada.

export const truncatePreview = (input: string, max = 120): string => {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) {
    return trimmed;
  }

  return `${trimmed.slice(0, max - 1)}…`;
};

export const formatUserName = (input: { firstName: string; lastName: string }): string =>
  `${input.firstName} ${input.lastName}`.trim();

export const buildDeepLink = (input: {
  channelId: string;
  messageId: string;
  projectId: string | null;
  teamId: string | null;
}): string => {
  const params = new URLSearchParams({
    channelId: input.channelId,
    messageId: input.messageId
  });

  if (input.projectId) {
    params.set("projectId", input.projectId);
  }

  if (input.teamId) {
    params.set("teamId", input.teamId);
  }

  return `/messaging?${params.toString()}`;
};

export const formatMessagePreview = (input: {
  kind: MessageKind;
  content: string;
  attachmentName?: string | null;
}): string => {
  if (input.kind === "FILE") {
    return input.attachmentName ? `Archivo compartido: ${input.attachmentName}` : "Archivo compartido";
  }

  if (input.kind === "CALL_INVITE") {
    return "Videollamada instantánea iniciada";
  }

  if (input.kind === "NOTA_VOZ") {
    return "Nota de voz";
  }

  if (input.kind === "LLAMADA_PERDIDA") {
    return "Llamada perdida";
  }

  if (input.kind === "LLAMADA_FINALIZADA") {
    return input.content || "Llamada finalizada";
  }

  return truncatePreview(input.content);
};

export const mapPreviewMessage = (
  message: {
    id: string;
    content: string;
    kind: MessageKind;
    createdAt: Date;
    authorId: string;
    attachments?: Array<{ originalName: string }>;
  } | null
) => {
  if (!message) {
    return null;
  }

  return {
    messageId: message.id,
    content: formatMessagePreview({
      kind: message.kind,
      content: message.content,
      attachmentName: message.attachments?.[0]?.originalName ?? null
    }).slice(0, 160),
    kind: message.kind,
    createdAt: message.createdAt.toISOString(),
    authorId: message.authorId
  };
};

export const computeAggregateStatus = (
  receipts: Array<{ status: string }>
): "sent" | "delivered" | "read" => {
  if (receipts.length === 0) return "sent";
  const allRead = receipts.every((r) => r.status === "LEIDO");
  if (allRead) return "read";
  const allDelivered = receipts.every((r) => r.status === "LEIDO" || r.status === "ENTREGADO");
  if (allDelivered) return "delivered";
  return "sent";
};
