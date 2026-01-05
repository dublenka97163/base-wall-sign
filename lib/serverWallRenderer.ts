import { createCanvas, loadImage } from "canvas";
import { BASE_LOGO_ASSET_PATH } from "./contract";
import { drawWallLayers } from "./draw";
import { Stroke } from "./signatureEncoding";

export const buildWallPng = async (
  strokes: Stroke[],
  width: number,
  height: number
) => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const logo = await loadImage(BASE_LOGO_ASSET_PATH);

  await drawWallLayers(ctx, strokes, logo, { width, height });
  return canvas.toBuffer("image/png");
};
