import { Point, Stroke } from "./signatureEncoding";

export type RenderOptions = {
  width: number;
  height: number;
};

export const drawStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  color = "#0f172a"
) => {
  if (
    !stroke ||
    !Array.isArray(stroke.points) ||
    stroke.points.length === 0
  ) {
    return;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();

  const [first, ...rest] = stroke.points;
  ctx.moveTo(first.x, first.y);

  // FIX: stroke из одной точки (dot)
  if (rest.length === 0) {
    ctx.globalAlpha = 0.75;
    ctx.lineTo(first.x + 0.01, first.y + 0.01);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }

  for (let i = 0; i < rest.length; i++) {
    const current = rest[i];
    const prev = stroke.points[i];

    const mid: Point = {
      x: (prev.x + current.x) / 2,
      y: (prev.y + current.y) / 2,
    };

    ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
  }

  ctx.globalAlpha = 0.75;
  ctx.stroke();
  ctx.globalAlpha = 1;
};

export const drawWallLayers = (
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  logo: CanvasImageSource,
  options: RenderOptions
) => {
  const { width, height } = options;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // 1. Фон (брендовый светло-серый)
  ctx.fillStyle = "#eef0f3";
  ctx.fillRect(0, 0, width, height);

  // 2. Strokes
  strokes.forEach((stroke) => {
    drawStroke(ctx, stroke);
  });

  // 3. Logo (всегда читаемое)
  if (logo) {
    const logoWidth = (logo as any).width;
    const logoHeight = (logo as any).height;

    if (logoWidth && logoHeight) {
      const maxLogoWidth = width * 0.7;
      const maxLogoHeight = height * 0.6;

      const scale = Math.min(
        maxLogoWidth / logoWidth,
        maxLogoHeight / logoHeight
      );

      const drawWidth = logoWidth * scale;
      const drawHeight = logoHeight * scale;

      const x = (width - drawWidth) / 2;
      const y = (height - drawHeight) / 2;

      ctx.globalAlpha = 0.30;
      ctx.drawImage(logo, x, y, drawWidth, drawHeight);
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
};
