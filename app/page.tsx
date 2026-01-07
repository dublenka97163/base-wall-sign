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
  hexToBytes,
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from "viem";
import { sdk } from "@farcaster/miniapp-sdk";
import { base, baseSepolia } from "viem/chains";
import { Providers } from "./providers";
import { useBaseLogo } from "@/lib/useBaseLogo";
import { Stroke, encodeSignature, decodeSignature } from "@/lib/signatureEncoding";
import { drawWallLayers } from "@/lib/draw";
import { fetchWallSignatures } from "@/lib/subgraph";
import { contractAbi } from "@/lib/contract";
import { getChainId, getContractAddress, getRpcUrl } from "@/lib/env";
import { getWallRange } from "@/lib/wall";

const CANVAS_SIZE = 820;
const MAX_POINTS_PER_STROKE = 120;
const MAX_POINTS_TOTAL = 600;

const SIGN_COLORS = [
  "#0000ff",
  "#ffd12f",
  "#66c800",
  "#0a0b0d",
  "#fc401f",
] as const;

type ButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  buttonStyle?: React.CSSProperties;
};

const buttonStyles = {
  base: {
    border: "1px solid var(--border)",
    padding: "14px 18px",
    borderRadius: "14px",
    background: "#f8fafc",
    color: "#0f172a",
    fontWeight: 600,
    transition: "transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease",
    boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
    cursor: "pointer",
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
  buttonStyle = {},
}: ButtonProps) => {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <button
      style={{
        ...buttonStyles.base,
        flex: "1 1 220px",
        minWidth: "140px",
        boxSizing: "border-box",
        ...buttonStyle,
        ...(hovered && !disabled
          ? {
              transform: "translateY(-2px)",
              boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
            }
          : {}),
        ...(pressed ? buttonStyles.pressed : {}),
        ...(disabled ? buttonStyles.disabled : {}),
      }}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {label}
    </button>
  );
};

const Canvas = () => {
  const logo = useBaseLogo();
  useEffect(() => {
    sdk.actions.ready();
   }, []); 
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);
  const [wallStrokes, setWallStrokes] = useState<Stroke[]>([]);
  const [pendingStrokes, setPendingStrokes] = useState<Stroke[]>([]);
  const [draftStroke, setDraftStroke] = useState<Stroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawLocked, setDrawLocked] = useState(false);
  const drawLockedRef = useRef(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isCasting, setIsCasting] = useState(false);
  const [signing, setSigning] = useState(false);
  const [currentColor, setCurrentColor] = useState<string>("#0a0b0d");
  const [showTerms, setShowTerms] = useState(false);
  const pointerStroke = useRef<Stroke | null>(null);
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

  const redraw = useCallback(() => {
    if (!canvasRef.current || !logo) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    drawWallLayers(ctx, allStrokes, logo, {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
    });
  }, [allStrokes, logo]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  async function fetchLatestTokenId() {
    const res = await fetch(process.env.NEXT_PUBLIC_SUBGRAPH_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query {
            signeds(orderBy: tokenId, orderDirection: desc, first: 1) {
              tokenId
            }
          }
        `,
      }),
    });
    if (!res.ok) {
      throw new Error("Subgraph fetch failed");
    }
    const json = await res.json();
    return Number(json?.data?.signeds?.[0]?.tokenId ?? 0);
  }

  const loadWall = useCallback(async () => {
    try {
      setStatus("Syncing wall...");
      const latestTokenId = await fetchLatestTokenId();
      if (!latestTokenId) {
        setWallStrokes([]);
        setStatus(null);
        return;
      }
      const { from, to } = getWallRange(latestTokenId);
      const signatures = await fetchWallSignatures(from, to);
      const inRange = signatures.filter((s: any) => {
        const id = Number(s?.tokenId ?? 0);
        return id >= from && id <= to;
      });
      const strokes = inRange.map((s: any) => {
        const data =
          typeof s.signatureData === "string"
            ? hexToBytes(s.signatureData)
            : Uint8Array.from(s.signatureData);
        return decodeSignature(data, CANVAS_SIZE, CANVAS_SIZE);
      });
      setWallStrokes(strokes.flat());
      setStatus(null);
    } catch (e) {
      console.error(e);
      setStatus("Failed to load wall");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (cancelled) return;
      await loadWall();
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [loadWall]);

  const pointerPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (drawLockedRef.current || drawLocked) {
      setStatus("Limit reached. Clear or Confirm & Sign.");
      return;
    }
    const point = pointerPoint(event);
    pointerStroke.current = {
      points: [point],
      color: currentColor,
    };
    setDraftStroke({
      points: [point],
      color: currentColor,
    });
    setIsDrawing(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !pointerStroke.current) return;
    if (drawLockedRef.current || drawLocked) return;
    const total =
      localStrokes.reduce((sum, s) => sum + s.points.length, 0) +
      pointerStroke.current.points.length;
    if (total >= MAX_POINTS_TOTAL) {
      drawLockedRef.current = true;
      setDrawLocked(true);
      setStatus("Limit reached. Clear or Confirm & Sign.");
      return;
    }
    if (pointerStroke.current.points.length >= MAX_POINTS_PER_STROKE) return;
    const point = pointerPoint(event);
    pointerStroke.current.points.push(point);
    setDraftStroke({
      points: [...pointerStroke.current.points],
      color: pointerStroke.current.color,
    });
  };

  const handlePointerUp = () => {
    const stroke = pointerStroke.current;
    if (stroke && stroke.points.length) {
      setLocalStrokes((prev) => [...prev, stroke]);
    }
    pointerStroke.current = null;
    setDraftStroke(null);
    setIsDrawing(false);
  };

  const clearLocal = () => {
    setLocalStrokes([]);
    setDraftStroke(null);
    pointerStroke.current = null;
    drawLockedRef.current = false;
    setDrawLocked(false);
    setStatus(null);
  };

  const onSign = async () => {
    if (!localStrokes.length) {
      setStatus("Draw your signature first.");
      return;
    }
    const eth =
      typeof window !== "undefined" ? (window as any).ethereum : null;
    if (!eth) {
      setStatus("Wallet not available in this environment.");
      return;
    }
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
      drawLockedRef.current = false;
      setDrawLocked(false);
      setStatus("Submitting signature...");
      await publicClient.waitForTransactionReceipt({ hash });
      await loadWall();
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
    if (!canvasRef.current) return;
    setIsCasting(true);
    try {
      const blob: Blob | null = await new Promise((resolve) =>
        canvasRef.current!.toBlob(resolve, "image/png")
      );
      if (!blob) {
        setStatus("Failed to prepare wall image.");
        return;
      }
      const file = new File([blob], "base-wall.png", { type: "image/png" });
      const url = URL.createObjectURL(file);
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
          gap: 32,
          position: "relative",
        }}
      >
        {/* Шапка по центру */}
        <div style={{ textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em" }}>
            Base Wall Sign
          </h1>
          <span style={{ display: "block", marginTop: "8px", fontSize: "16px", color: "#475569" }}>
            Leave your mark onchain
          </span>
        </div>

        {/* Wallet connected — сверху справа */}
        <div style={{ position: "absolute", top: 16, right: 16 }}>
          <button
            disabled
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              color: "#0f172a",
              fontSize: "14px",
              fontWeight: 600,
              opacity: 0.7,
            }}
          >
            Wallet connected
          </button>
        </div>

        {/* Палитра цветов */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          {SIGN_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setCurrentColor(c)}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: c,
                border: currentColor === c ? "4px solid #0f172a" : "2px solid #cbd5e5",
                cursor: "pointer",
              }}
            />
          ))}
        </div>

        {/* Canvas */}
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
            alignSelf: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        {/* Основные кнопки */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <ActionButton
            label="Clear"
            onClick={clearLocal}
            disabled={!localStrokes.length}
            buttonStyle={{ background: "#ffffff", flex: "0 1 auto", minWidth: "120px" }}
          />
          <ActionButton
            label={signing ? "Signing..." : "Confirm & Sign"}
            onClick={onSign}
            disabled={signing || !localStrokes.length}
            buttonStyle={{ background: "#0000ff", color: "#ffffff" }}
          />
          <ActionButton
            label={isCasting ? "Preparing..." : "Cast Wall"}
            onClick={castWall}
            disabled={isCasting}
            buttonStyle={{ background: "#8A63D2", color: "#ffffff", border: "none" }}
          />
        </div>

        {/* Статус */}
        {status && (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              textAlign: "center",
              fontSize: "14px",
            }}
          >
            {status}
          </div>
        )}

        {/* Terms снизу */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => setShowTerms(true)}
            style={{
              fontSize: "14px",
              color: "#64748b",
              background: "none",
              border: "none",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Terms
          </button>
        </div>
      </div>

      {/* Модальное окно Terms */}
      {showTerms && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowTerms(false)}
        >
          <div
            style={{
              background: "#ffffff",
              padding: "32px",
              borderRadius: "16px",
              maxWidth: "420px",
              width: "90%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowTerms(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "none",
                border: "none",
                fontSize: "28px",
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              ×
            </button>
            <h1 style={{ fontSize: "24px", margin: "0 0 20px 0" }}>Terms of Service</h1>
            <p style={{ margin: "12px 0", lineHeight: "1.5" }}>
              This application allows users to create onchain signatures.
              All actions are irreversible and recorded onchain.
            </p>
            <p style={{ margin: "12px 0", lineHeight: "1.5" }}>
              The app is provided as-is without guarantees.
            </p>
          </div>
        </div>
      )}
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
