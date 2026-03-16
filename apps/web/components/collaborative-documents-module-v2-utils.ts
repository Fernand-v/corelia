import type {
  ExplorerRow,
  ExplorerSort
} from "@/components/collaborative-documents-module-v2-types";

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });

export const initialsFromName = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "??";
  }

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
};

export const toneToFluentAppearance = (tone: string): "filled" | "tint" | "outline" => {
  if (tone.includes("emerald")) {
    return "filled";
  }
  if (tone.includes("red") || tone.includes("amber") || tone.includes("yellow")) {
    return "tint";
  }
  return "outline";
};

export const toneToFluentColor = (
  tone: string
): "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning" => {
  if (tone.includes("emerald")) {
    return "success";
  }
  if (tone.includes("red")) {
    return "danger";
  }
  if (tone.includes("amber") || tone.includes("yellow")) {
    return "warning";
  }
  if (tone.includes("blue")) {
    return "brand";
  }
  return "subtle";
};

export const SORT_OPTIONS: Array<{ value: ExplorerSort; label: string }> = [
  { value: "updatedDesc", label: "Más recientes" },
  { value: "updatedAsc", label: "Más antiguos" },
  { value: "nameAsc", label: "Nombre (A-Z)" },
  { value: "nameDesc", label: "Nombre (Z-A)" }
];

export const compareRows = (left: ExplorerRow, right: ExplorerRow, sort: ExplorerSort) => {
  if (sort === "updatedAsc") {
    return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
  }

  if (sort === "updatedDesc") {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  }

  if (sort === "nameDesc") {
    return right.name.localeCompare(left.name, "es");
  }

  return left.name.localeCompare(right.name, "es");
};
