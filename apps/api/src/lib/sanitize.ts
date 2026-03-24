/**
 * Utilidades de sanitización compartidas entre módulos.
 * Centralizar aquí evita duplicación y asegura comportamiento uniforme.
 */

export const stripControlChars = (input: string): string =>
  Array.from(input)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");

export const sanitizeFileName = (value: string): string => {
  const normalized = value.trim().replace(/\s+/g, " ");

  const safe = stripControlChars(normalized)
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ");

  return safe.length > 0 ? safe.slice(0, 255) : "archivo";
};
