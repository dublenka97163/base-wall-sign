export type Point = { x: number; y: number };
export type Stroke = {
  points: Point[];
  color?: string; // HEX, например "#fc401f"
};

const NORMALIZED_MAX = 4095;

// версии формата
const FORMAT_V1 = 1; // без цвета
const FORMAT_V2 = 2; // с цветом

const push8 = (buffer: number[], value: number) => {
  buffer.push(value & 0xff);
};

const push16 = (buffer: number[], value: number) => {
  buffer.push((value >> 8) & 0xff, value & 0xff);
};

const read8 = (data: Uint8Array, offset: number) => data[offset];

const read16 = (data: Uint8Array, offset: number) =>
  (data[offset] << 8) | data[offset + 1];

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

export const encodeSignature = (
  strokes: Stroke[],
  width: number,
  height: number
): Uint8Array => {
  const bytes: number[] = [];

  // всегда пишем новую версию
  push8(bytes, FORMAT_V2);

  push16(bytes, strokes.length);

  strokes.forEach((stroke) => {
    const color = stroke.color ?? "#0a0b0d";
    const [r, g, b] = hexToRgb(color);

    // цвет stroke (RGB)
    push8(bytes, r);
    push8(bytes, g);
    push8(bytes, b);

    push16(bytes, stroke.points.length);

    let lastX = 0;
    let lastY = 0;

    stroke.points.forEach((point, idx) => {
      const normalizedX = Math.round((point.x / width) * NORMALIZED_MAX);
      const normalizedY = Math.round((point.y / height) * NORMALIZED_MAX);

      if (idx === 0) {
        push16(bytes, normalizedX);
        push16(bytes, normalizedY);
      } else {
        const dx = normalizedX - lastX;
        const dy = normalizedY - lastY;
        push16(bytes, dx & 0xffff);
        push16(bytes, dy & 0xffff);
      }

      lastX = normalizedX;
      lastY = normalizedY;
    });
  });

  const result = Uint8Array.from(bytes);
  if (result.byteLength > 4096) {
    throw new Error("Signature exceeds max encoded size (4096 bytes)");
  }

  return result;
};

export const decodeSignature = (
  data: Uint8Array,
  width: number,
  height: number
): Stroke[] => {
  let cursor = 0;

  // определяем версию
  const possibleVersion = read8(data, cursor);
  const isV2 = possibleVersion === FORMAT_V2;

  let version = FORMAT_V1;
  if (isV2) {
    version = FORMAT_V2;
    cursor += 1;
  }

  const strokes: Stroke[] = [];
  const strokeCount = read16(data, cursor);
  cursor += 2;

  for (let s = 0; s < strokeCount; s++) {
    let color = "#0a0b0d";

    if (version === FORMAT_V2) {
      const r = read8(data, cursor++);
      const g = read8(data, cursor++);
      const b = read8(data, cursor++);
      color = rgbToHex(r, g, b);
    }

    const points: Point[] = [];
    const pointCount = read16(data, cursor);
    cursor += 2;

    let lastX = 0;
    let lastY = 0;

    for (let p = 0; p < pointCount; p++) {
      if (p === 0) {
        lastX = read16(data, cursor);
        cursor += 2;
        lastY = read16(data, cursor);
        cursor += 2;
      } else {
        const dx = read16(data, cursor);
        cursor += 2;
        const dy = read16(data, cursor);
        cursor += 2;
        lastX = (lastX + ((dx << 16) >> 16)) & 0xffff;
        lastY = (lastY + ((dy << 16) >> 16)) & 0xffff;
      }

      points.push({
        x: (lastX / NORMALIZED_MAX) * width,
        y: (lastY / NORMALIZED_MAX) * height,
      });
    }

    strokes.push({ points, color });
  }

  return strokes;
};
