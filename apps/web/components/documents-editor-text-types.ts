export type Member = {
  id: string;
  name: string;
  color: string;
};

export type ActiveCollaborator = {
  userId: string;
  name: string;
  color: string;
  cursorLabel?: string | null;
  lastSeenAt?: string;
};

export type MentionSuggestionItem = {
  id: string;
  label: string;
  color: string;
};

export const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];
export const RIBBON_TABS = ["INICIO", "INSERTAR", "REVISAR"] as const;
export type RibbonTab = (typeof RIBBON_TABS)[number];
