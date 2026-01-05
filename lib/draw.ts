import { Point, Stroke } from "./signatureEncoding";

export type RenderOptions = {
  width: number;
  height: number;
};

/**
 * Keep strokes semi-transparent so the Base logo can’t be fully obscured.
 * (UI limits are in page.tsx, this is the rendering safety net.)
 */
const STROKE_ALPHA = 0.75;
const STROKE_WIDTH = 3.5;

/**
 * Watermark overlay (logo on top) but subtle, so it doesn't "erase" strokes.
 */
const LOGO_OVERLAY_ALPHA = 0.18;

function getImageSize(img: CanvasImageSource): { w: number; h: number } | null {
  // HTMLImageElement (most common)
  const anyImg = img as any;
  if (typeof anyImg?.naturalWidth === "number" && typeof anyImg?.naturalHeight === "number") {
    const w = anyImg.naturalWidth;
    const h = anyImg.naturalHeight;
    if (w > 0 && h > 0) return { w, h };
  }

  // ImageBitmap
  if (typeof anyImg?.width === "number" && typeof anyImg?.height === "number") {
    const w = anyImg.width;
    const h = anyImg.height;
    if (w > 0 && h > 0) return { w, h };
  }

  return null;
}

function drawLogoContained(
  ctx: CanvasRenderingContext2D,
  logo: CanvasImageSource,
  width: number,
  height: number
) {
  const size = getImageSize(logo);
  if (!size) {
    // Fallback: old behavior (still better than nothing)
    ctx.drawImage(logo, 0, 0, width, height);
    return;
  }

  const { w: iw, h: ih } = size;

  // "contain" fit
  const scale = Math.min(width / iw, height / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (width - dw) / 2;
  const dy = (height - dh) / 2;

  ctx.drawImage(logo, dx, dy, dw, dh);
}

export const drawStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  color = "#0f172a"
) => {
  // hard guards so we never crash on bad data
  if (!stroke || !Array.isArray((stroke as any).points)) return;
  if (stroke.points.length < 2) return;

  ctx.save();

  ctx.globalAlpha = STROKE_ALPHA;
  ctx.strokeStyle = color;
  ctx.lineWidth = STROKE_WIDTH;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  const [first, ...rest] = stroke.points;
  if (!first) {
    ctx.restore();
    return;
  }

  ctx.moveTo(first.x, first.y);

  for (let i = 0; i < rest.length; i++) {
    const current = rest[i];
    const prev = stroke.points[i];
    if (!current || !prev) continue;

    const mid: Point = {
      x: (prev.x + current.x) / 2,
      y: (prev.y + current.y) / 2,
    };
    ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
  }

  ctx.stroke();
  ctx.restore();
};

export const drawWallLayers = (
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  logo: CanvasImageSource,
  options: RenderOptions
) => {
  const { width, height } = options;

  ctx.save();

  // Clear + white background (explicit, always)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Base logo (background), aspect-correct
  drawLogoContained(ctx, logo, width, height);

  // Strokes on top
  if (Array.isArray(strokes)) {
    for (const stroke of strokes) drawStroke(ctx, stroke);
  }

  // Subtle logo watermark overlay so logo stays readable,
  // but does NOT wipe strokes visually.
  ctx.save();
  ctx.globalAlpha = LOGO_OVERLAY_ALPHA;
  ctx.globalCompositeOperation = "multiply";
  drawLogoContained(ctx, logo, width, height);
  ctx.restore();

  ctx.restore();
};
