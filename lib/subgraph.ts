export const WALL_QUERY = `
  query Wall($from: BigInt!, $to: BigInt!) {
    signeds(
      where: { tokenId_gte: $from, tokenId_lte: $to }
      orderBy: tokenId
      orderDirection: asc
    ) {
      tokenId
      signatureData
    }
  }
`;

export async function fetchWallSignatures(from: number, to: number) {
  const res = await fetch(process.env.NEXT_PUBLIC_SUBGRAPH_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: WALL_QUERY,
      variables: {
        from,
        to,
      },
    }),
  });

  if (!res.ok) {
    throw new Error("Subgraph fetch failed");
  }

  const json = await res.json();
  const data = json.data?.signeds;

  if (!Array.isArray(data)) {
    console.error("Invalid subgraph response", json);
    throw new Error("Invalid subgraph data");
  }

  return data;
}
