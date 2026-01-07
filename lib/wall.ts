import { MAX_SIGNATURES_PER_WALL } from "./constants";

export function getWallRange(latestTokenId: number) {
  const wallIndex = Math.floor((latestTokenId - 1) / MAX_SIGNATURES_PER_WALL);

  const from =
    wallIndex * MAX_SIGNATURES_PER_WALL + 1;

  const to =
    (wallIndex + 1) * MAX_SIGNATURES_PER_WALL;

  return { wallIndex, from, to };
}
