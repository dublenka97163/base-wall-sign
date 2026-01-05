export type Point = { x: number; y: number };
export type Stroke = { points: Point[] };

const NORMALIZED_MAX = 4095;

const push16 = (buffer: number[], value: number) => {
  buffer.push((value >> 8) & 0xff, value & 0xff);
};

const read16 = (data: Uint8Array, offset: number) =>
  (data[offset] << 8) | data[offset + 1];

export const encodeSignature = (
  strokes: Stroke[],
  width: number,
  height: number
): Uint8Array => {
  const bytes: number[] = [];
  push16(bytes, strokes.length);

  strokes.forEach((stroke) => {
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
  const strokes: Stroke[] = [];
  const strokeCount = read16(data, cursor);
  cursor += 2;

  for (let s = 0; s < strokeCount; s++) {
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
    strokes.push({ points });
  }

  return strokes;
};
