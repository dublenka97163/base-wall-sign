export const WALL_QUERY = `
  query Wall {
    wallSignatures(orderBy: tokenId, orderDirection: asc) {
      tokenId
      signatureData
    }
  }
`;

export async function fetchWallSignatures() {
  const res = await fetch(process.env.NEXT_PUBLIC_SUBGRAPH_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: WALL_QUERY,
    }),
  });

  if (!res.ok) {
    throw new Error("Subgraph fetch failed");
  }

  const json = await res.json();
  return json.data.wallSignatures;
}
