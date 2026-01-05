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
  if (stroke.points.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  const [first, ...rest] = stroke.points;
  ctx.moveTo(first.x, first.y);

  for (let i = 0; i < rest.length; i++) {
    const current = rest[i];
    const prev = stroke.points[i];
    const mid: Point = {
      x: (prev.x + current.x) / 2,
      y: (prev.y + current.y) / 2,
    };
    ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
  }
  ctx.stroke();
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

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.drawImage(logo, 0, 0, width, height);
  strokes.forEach((stroke) => drawStroke(ctx, stroke));

  ctx.globalAlpha = 0.65;
  ctx.drawImage(logo, 0, 0, width, height);
  ctx.restore();
};
