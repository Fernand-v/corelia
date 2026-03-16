type ParsedCell = {
  id: string;
  vertex: boolean;
  edge: boolean;
  source: string;
  target: string;
  value: string;
  style: Record<string, string>;
  x: number;
  y: number;
  w: number;
  h: number;
};

const parseAttrs = (tag: string) => {
  const attrs: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(tag))) {
    attrs[match[1]!] = match[2]!;
  }

  return attrs;
};

const parseStyle = (raw: string): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) {
      result[part.slice(0, eq)] = part.slice(eq + 1);
    } else if (part.trim()) {
      result.shape = part.trim();
    }
  }
  return result;
};

const escapeSvg = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Lightweight renderer: parses mxGraphModel XML and produces a basic SVG preview.
 */
export const diagramXmlToSvg = (xml: string): string | null => {
  try {
    const rootMatch = xml.match(/<root>([\s\S]*?)<\/root>/i);
    if (!rootMatch) {
      return null;
    }

    const cellsXml = rootMatch[1]!;
    const cellRegex = /<mxCell\b[^>]*\/>|<mxCell\b[\s\S]*?<\/mxCell>/gi;
    const cells: ParsedCell[] = [];

    let match: RegExpExecArray | null;
    while ((match = cellRegex.exec(cellsXml))) {
      const full = match[0];
      const attrs = parseAttrs(full);
      const geoMatch = full.match(/<mxGeometry\b([^>]*)/i);
      const geometryAttrs = geoMatch ? parseAttrs(geoMatch[1]!) : {};

      cells.push({
        id: attrs.id ?? "",
        vertex: attrs.vertex === "1",
        edge: attrs.edge === "1",
        source: attrs.source ?? "",
        target: attrs.target ?? "",
        value: (attrs.value ?? "")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/<[^>]*>/g, ""),
        style: parseStyle(attrs.style ?? ""),
        x: Number(geometryAttrs.x) || 0,
        y: Number(geometryAttrs.y) || 0,
        w: Number(geometryAttrs.width) || 0,
        h: Number(geometryAttrs.height) || 0
      });
    }

    const vertices = cells.filter((cell) => cell.vertex && cell.id !== "0" && cell.id !== "1");
    const edges = cells.filter((cell) => cell.edge);
    if (vertices.length === 0) {
      return null;
    }

    const cellById = new Map(cells.map((cell) => [cell.id, cell]));

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const vertex of vertices) {
      minX = Math.min(minX, vertex.x);
      minY = Math.min(minY, vertex.y);
      maxX = Math.max(maxX, vertex.x + vertex.w);
      maxY = Math.max(maxY, vertex.y + vertex.h);
    }

    const pad = 20;
    const vbW = maxX - minX + pad * 2;
    const vbH = maxY - minY + pad * 2;
    const ox = -minX + pad;
    const oy = -minY + pad;

    const parts: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" style="width:100%;height:100%;max-height:60vh">`
    );

    for (const edge of edges) {
      const source = cellById.get(edge.source);
      const target = cellById.get(edge.target);
      if (source && target) {
        const x1 = source.x + source.w / 2 + ox;
        const y1 = source.y + source.h / 2 + oy;
        const x2 = target.x + target.w / 2 + ox;
        const y2 = target.y + target.h / 2 + oy;
        const stroke = edge.style.strokeColor || "#94a3b8";
        const dashed = edge.style.dashed === "1" ? ' stroke-dasharray="6 3"' : "";

        parts.push(
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escapeSvg(
            stroke
          )}" stroke-width="1.5"${dashed} marker-end="url(#arrowhead)"/>`
        );
      }
    }

    for (const vertex of vertices) {
      const vx = vertex.x + ox;
      const vy = vertex.y + oy;
      const fill = vertex.style.fillColor || "#ffffff";
      const stroke = vertex.style.strokeColor || "#64748b";
      const shape = vertex.style.shape ?? "";
      const rounded = vertex.style.rounded === "1";

      if (shape === "umlActor") {
        const cx = vx + vertex.w / 2;
        const headR = Math.min(vertex.w, vertex.h) * 0.15;
        const headCy = vy + headR + 2;
        const bodyTop = headCy + headR;
        const bodyBottom = vy + vertex.h * 0.7;
        const armY = bodyTop + (bodyBottom - bodyTop) * 0.3;
        const legBottom = vy + vertex.h - 4;
        const armSpan = vertex.w * 0.35;
        const legSpan = vertex.w * 0.25;

        parts.push(
          `<circle cx="${cx}" cy="${headCy}" r="${headR}" fill="${escapeSvg(
            fill
          )}" stroke="${escapeSvg(stroke)}" stroke-width="1.5"/>`
        );
        parts.push(
          `<line x1="${cx}" y1="${bodyTop}" x2="${cx}" y2="${bodyBottom}" stroke="${escapeSvg(
            stroke
          )}" stroke-width="1.5"/>`
        );
        parts.push(
          `<line x1="${cx - armSpan}" y1="${armY}" x2="${cx + armSpan}" y2="${armY}" stroke="${escapeSvg(
            stroke
          )}" stroke-width="1.5"/>`
        );
        parts.push(
          `<line x1="${cx}" y1="${bodyBottom}" x2="${cx - legSpan}" y2="${legBottom}" stroke="${escapeSvg(
            stroke
          )}" stroke-width="1.5"/>`
        );
        parts.push(
          `<line x1="${cx}" y1="${bodyBottom}" x2="${cx + legSpan}" y2="${legBottom}" stroke="${escapeSvg(
            stroke
          )}" stroke-width="1.5"/>`
        );
      } else if (shape === "ellipse" || shape === "doubleEllipse") {
        parts.push(
          `<ellipse cx="${vx + vertex.w / 2}" cy="${vy + vertex.h / 2}" rx="${vertex.w / 2}" ry="${
            vertex.h / 2
          }" fill="${escapeSvg(fill)}" stroke="${escapeSvg(stroke)}" stroke-width="1.5"/>`
        );
      } else if (shape === "rhombus") {
        const cx = vx + vertex.w / 2;
        const cy = vy + vertex.h / 2;
        parts.push(
          `<polygon points="${cx},${vy} ${vx + vertex.w},${cy} ${cx},${vy + vertex.h} ${vx},${cy}" fill="${escapeSvg(
            fill
          )}" stroke="${escapeSvg(stroke)}" stroke-width="1.5"/>`
        );
      } else if (shape === "hexagon") {
        const dx = vertex.w * 0.25;
        parts.push(
          `<polygon points="${vx + dx},${vy} ${vx + vertex.w - dx},${vy} ${vx + vertex.w},${
            vy + vertex.h / 2
          } ${vx + vertex.w - dx},${vy + vertex.h} ${vx + dx},${vy + vertex.h} ${vx},${
            vy + vertex.h / 2
          }" fill="${escapeSvg(fill)}" stroke="${escapeSvg(stroke)}" stroke-width="1.5"/>`
        );
      } else if (shape === "cylinder") {
        const ry = Math.min(vertex.h * 0.15, 12);
        parts.push(
          `<path d="M${vx},${vy + ry} L${vx},${vy + vertex.h - ry} A${vertex.w / 2},${ry} 0 0,0 ${
            vx + vertex.w
          },${vy + vertex.h - ry} L${vx + vertex.w},${vy + ry}" fill="${escapeSvg(fill)}" stroke="${escapeSvg(
            stroke
          )}" stroke-width="1.5"/>`
        );
        parts.push(
          `<ellipse cx="${vx + vertex.w / 2}" cy="${vy + ry}" rx="${vertex.w / 2}" ry="${ry}" fill="${escapeSvg(
            fill
          )}" stroke="${escapeSvg(stroke)}" stroke-width="1.5"/>`
        );
      } else if (shape === "triangle") {
        parts.push(
          `<polygon points="${vx + vertex.w / 2},${vy} ${vx + vertex.w},${vy + vertex.h} ${vx},${
            vy + vertex.h
          }" fill="${escapeSvg(fill)}" stroke="${escapeSvg(stroke)}" stroke-width="1.5"/>`
        );
      } else {
        const rx = rounded ? 6 : 0;
        parts.push(
          `<rect x="${vx}" y="${vy}" width="${vertex.w}" height="${vertex.h}" rx="${rx}" fill="${escapeSvg(
            fill
          )}" stroke="${escapeSvg(stroke)}" stroke-width="1.5"/>`
        );
      }

      if (vertex.value) {
        const label = vertex.value.length > 30 ? `${vertex.value.slice(0, 27)}...` : vertex.value;
        const fontSize = Math.max(9, Math.min(12, vertex.w / 8));
        const labelY = shape === "umlActor" ? vy + vertex.h - 2 : vy + vertex.h / 2;

        parts.push(
          `<text x="${vx + vertex.w / 2}" y="${labelY}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-family="system-ui, sans-serif" fill="#1e293b">${escapeSvg(
            label
          )}</text>`
        );
      }
    }

    parts.push(
      '<defs><marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#94a3b8"/></marker></defs>'
    );
    parts.push("</svg>");

    return parts.join("\n");
  } catch {
    return null;
  }
};
