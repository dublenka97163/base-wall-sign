"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  bytesToHex,
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { Providers } from "./providers";
import { useBaseLogo } from "@/lib/useBaseLogo";
import { Stroke, encodeSignature } from "@/lib/signatureEncoding";
import { drawWallLayers } from "@/lib/draw";
import { fetchSignatureEvents } from "@/lib/events";
import { contractAbi } from "@/lib/contract";
import { getChainId, getContractAddress, getRpcUrl } from "@/lib/env";

const CANVAS_SIZE = 820;

type ButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
};

const buttonStyles = {
  base: {
    border: "1px solid var(--border)",
    padding: "14px 18px",
    borderRadius: "14px",
    background: "#f8fafc",
    color: "#0f172a",
    fontWeight: 600,
    transition: "transform 120ms ease, box-shadow 120ms ease",
    boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
    cursor: "pointer",
    minWidth: 140,
  },
  primary: {
    background: "linear-gradient(90deg, #1c72ff, #0b4edb)",
    color: "#ffffff",
    border: "none",
  },
  pressed: {
    transform: "translateY(1px) scale(0.99)",
    boxShadow: "0 3px 12px rgba(0,0,0,0.12)",
  },
  disabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
} as const;

const ActionButton = ({
  label,
  onClick,
  disabled,
  variant = "primary",
}: ButtonProps) => {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      style={{
        ...buttonStyles.base,
        ...(variant === "primary" ? buttonStyles.primary : {}),
        ...(pressed ? buttonStyles.pressed : {}),
        ...(disabled ? buttonStyles.disabled : {}),
      }}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onClick}
    >
      {label}
    </button>
  );
};

const Canvas = () => {
  const logo = useBaseLogo();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);
  const [wallStrokes, setWallStrokes] = useState<Stroke[]>([]);
  const [pendingStrokes, setPendingStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isCasting, setIsCasting] = useState(false);
  const [isLoadingWall, setIsLoadingWall] = useState(false);
  const pointerStroke = useRef<Stroke | null>(null);
  const [draftStroke, setDraftStroke] = useState<Stroke | null>(null);
  const [signing, setSigning] = useState(false);
  const walletClientRef = useRef<ReturnType<typeof createWalletClient> | null>(
    null
  );

  const chainId = getChainId();
  const chain = chainId === base.id ? base : baseSepolia;
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain,
        transport: http(getRpcUrl()),
      }),
    [chain]
  );

  const allStrokes = useMemo(
    () => [
      ...wallStrokes,
      ...pendingStrokes,
      ...localStrokes,
      ...(draftStroke ? [draftStroke] : []),
    ],
    [draftStroke, localStrokes, pendingStrokes, wallStrokes]
  );

  const redraw = useCallback(async () => {
    if (!canvasRef.current || !logo) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    await drawWallLayers(ctx, allStrokes, logo, {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
    });
  }, [allStrokes, logo]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const syncWall = useCallback(async () => {
    setIsLoadingWall(true);
    try {
      const events = await fetchSignatureEvents(CANVAS_SIZE, CANVAS_SIZE);
      const strokes = events.flatMap((event) => event.signature);
      setWallStrokes(strokes);
    } catch (err) {
      console.error(err);
      setStatus("Failed to load wall. Check RPC or contract address.");
    } finally {
      setIsLoadingWall(false);
    }
  }, []);

  useEffect(() => {
    syncWall();
  }, [syncWall]);

  useEffect(() => {
    const sdk = (globalThis as unknown as { miniApp?: { actions?: { ready?: () => Promise<void> } } }).miniApp;
    sdk?.actions?.ready?.().catch((err: unknown) => {
      console.warn("Mini app ready signal failed", err);
    });
  }, []);

  const pointerPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = pointerPoint(event);
    pointerStroke.current = { points: [point] };
    setDraftStroke({ points: [point] });
    setIsDrawing(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !pointerStroke.current) return;
    const point = pointerPoint(event);
    pointerStroke.current.points.push(point);
    setDraftStroke({ points: [...pointerStroke.current.points] });
  };

  const handlePointerUp = () => {
    if (pointerStroke.current) {
      setLocalStrokes((prev) => [...prev, pointerStroke.current!]);
    }
    pointerStroke.current = null;
    setDraftStroke(null);
    setIsDrawing(false);
  };

  const clearLocal = () => {
    setLocalStrokes([]);
    setDraftStroke(null);
    pointerStroke.current = null;
    setStatus(null);
  };

  const onSign = async () => {
    if (!localStrokes.length) {
      setStatus("Draw your signature first.");
      return;
    }
    const eth = typeof window !== "undefined" ? (window as any).ethereum : null;
    if (!eth) {
      setStatus("Wallet not available in this environment.");
      return;
    }
    if (!canvasRef.current) return;

    try {
      setSigning(true);
      const encoded = encodeSignature(localStrokes, CANVAS_SIZE, CANVAS_SIZE);
      if (!walletClientRef.current) {
        walletClientRef.current = createWalletClient({
          chain,
          transport: custom(eth),
        });
      }
      const addresses: string[] = await eth.request({
        method: "eth_requestAccounts",
      });
      const from = addresses[0];

      const currentChainId = await walletClientRef.current.getChainId();
      if (currentChainId !== chain.id) {
        await walletClientRef.current.switchChain({ id: chain.id });
      }

      const hash = await walletClientRef.current.writeContract({
        address: getContractAddress() as `0x${string}`,
        abi: contractAbi,
        functionName: "sign",
        args: [bytesToHex(encoded)],
        chain,
        account: from as `0x${string}`,
      });

      setPendingStrokes((prev) => [...prev, ...localStrokes]);
      setLocalStrokes([]);
      setStatus("Submitting signature...");

      await publicClient.waitForTransactionReceipt({ hash });
      await syncWall();
      setPendingStrokes([]);
      setStatus("Signature confirmed onchain!");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send transaction.";
      setStatus(message);
    } finally {
      setSigning(false);
    }
  };

  const castWall = async () => {
    setIsCasting(true);
    try {
      const url = new URL("/api/wall", window.location.href).toString();
      const composer = new URL("https://warpcast.com/~/compose");
      composer.searchParams.append(
        "text",
        "I signed the Base Wall in the Farcaster mini app."
      );
      composer.searchParams.append("embeds[]", url);
      window.open(composer.toString(), "_blank", "noopener,noreferrer");
      setStatus("Composer opened with wall image attached.");
    } finally {
      setIsCasting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          width: "min(960px, 100%)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>Base Wall Sign</h1>
            <p style={{ margin: "4px 0 0", color: "#475569" }}>
              Draw on the Base logo, submit onchain, and mint your wall NFT.
            </p>
          </div>
        </div>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 18,
            padding: 16,
            background: "#ffffff",
            boxShadow: "var(--shadow)",
          }}
        >
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              style={{
                width: "100%",
                maxWidth: CANVAS_SIZE,
                borderRadius: 18,
                border: "1px solid #e2e8f0",
                touchAction: "none",
                background: "#ffffff",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 16,
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ActionButton
                variant="secondary"
                label="Clear"
                onClick={clearLocal}
                disabled={!localStrokes.length}
              />
              <ActionButton
                variant="primary"
                label={signing ? "Signing..." : "Confirm & Sign"}
                onClick={onSign}
                disabled={signing || !localStrokes.length}
              />
              <ActionButton
                variant="secondary"
                label={isCasting ? "Preparing..." : "Cast Wall"}
                onClick={castWall}
                disabled={isCasting || isLoadingWall}
              />
            </div>
            <div style={{ color: "#475569", fontSize: 14 }}>
              {isLoadingWall
                ? "Rebuilding wall from onchain events..."
                : "Onchain source of truth. Events ordered by block + log index."}
            </div>
          </div>
        </div>

        {status && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              color: "#0f172a",
            }}
          >
            {status}
          </div>
        )}
      </div>
    </div>
  );
};

export default function Page() {
  return (
    <Providers>
      <Canvas />
    </Providers>
  );
}
