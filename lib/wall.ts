import { MAX_SIGNATURES_PER_WALL, WALL_OFFSET } from "./constants";

export function getWallRange(latestTokenId: number) {
  
  if (!latestTokenId || latestTokenId <= WALL_OFFSET) {
    return {
      wallIndex: 0,
      from: WALL_OFFSET + 1,
      to: WALL_OFFSET + MAX_SIGNATURES_PER_WALL,
    };
  }

  
  const effectiveTokenId = latestTokenId - WALL_OFFSET;

  
  const wallIndex = Math.floor(
    (effectiveTokenId - 1) / MAX_SIGNATURES_PER_WALL
  );

  const from =
    WALL_OFFSET + wallIndex * MAX_SIGNATURES_PER_WALL + 1;

  const to =
    WALL_OFFSET + (wallIndex + 1) * MAX_SIGNATURES_PER_WALL;

  return {
    wallIndex,
    from,
    to,
  };
}
