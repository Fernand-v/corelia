import * as React from "react";
import { cn } from "./utils.js";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizeStyles: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg"
};

// Swiss: monocromo. Sin paleta de colores; tinta sobre hairline (o invertido).
const PALETTE = [
  "bg-line text-ink",
  "bg-ink text-paper"
];

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return (parts[0]?.slice(0, 2) ?? "").toUpperCase();
  }
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
};

const getColorIndex = (name: string): number => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + (name.charCodeAt(i) || 0)) & 0xffffffff;
  }
  return Math.abs(hash) % PALETTE.length;
};

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  src?: string;
  size?: AvatarSize;
}

export const Avatar = ({ name, src, size = "md", className, ...props }: AvatarProps) => {
  const [imgError, setImgError] = React.useState(false);
  const colorClass = PALETTE[getColorIndex(name)] ?? PALETTE[0]!;
  const initials = getInitials(name);
  const showImg = src && !imgError;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
        sizeStyles[size],
        showImg ? "" : colorClass,
        className
      )}
      title={name}
      aria-label={name}
      {...props}
    >
      {showImg ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
};
