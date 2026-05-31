import { useEffect, useRef } from "react";
import "./_group.css";

const BIG_STARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 70,
  size: Math.random() * 1.6 + 0.5,
  delay: Math.random() * 5,
  dur: 2 + Math.random() * 4,
  opacity: 0.3 + Math.random() * 0.7,
}));

const CONST_NODES = [
  { x: 52, y: 32, earned: true,  key: "dawn"    },
  { x: 58, y: 24, earned: true,  key: "ember"   },
  { x: 65, y: 28, earned: false, key: "tide"    },
  { x: 48, y: 22, earned: false, key: "veil"    },
  { x: 55, y: 16, earned: false, key: "zenith"  },
];
const CONST_LINES = [[0,1],[1,2],[0,3],[1,4]];

export function ConstellationSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let raf: number;

    function draw() {
      frame++;
      ctx!.clearRect(0, 0, el!.width, el!.height);

      // Shooting star every ~200 frames
      if (frame % 220 < 3) {
        const progress = (frame % 220) / 3;
        const sx = 0.3 + Math.random() * 0.4;
        const sy = 0.05 + Math.random() * 0.2;
        ctx!.save();
        ctx!.globalAlpha = 1 - progress;
        ctx!.strokeStyle = "#fff";
        ctx!.lineWidth = 1.2;
        ctx!.beginPath();
        ctx!.moveTo(sx * el!.width, sy * el!.height);
        ctx!.lineTo((sx + 0.06 * progress) * el!.width, (sy + 0.02 * progress) * el!.height);
        ctx!.stroke();
        ctx!.restore();
      }

      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{
      width: 390, height: 844,
      background: "linear-gradient(175deg, #020410 0%, #060B20 25%, #0C1030 50%, #14082C 70%, #1C0E34 100%)",
      position: "relative", overflow: "hidden", fontFamily: "'Inter', sans-serif",
    }}>
      <style>{`
        @keyframes twinkle {
          0%,100% { opacity: var(--op); }
          50%      { opacity: calc(var(--op) * 0.2); }
        }
        @keyframes aurora {
          0%,100% { transform: translateX(0) scaleX(1); opacity: 0.12; }
          50%      { transform: translateX(20px) scaleX(1.06); opacity: 0.2; }
        }
        @keyframes float-card {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-5px); }
        }
        @keyframes node-pulse {
          0%,100% { r: 5; opacity: 1; }
          50%      { r: 7; opacity: 0.8; }
        }
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(14px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(14px) rotate(-360deg); }
        }
        @keyframes shimmer {
          0%,100% { opacity: 0.15; }
          50%      { opacity: 0.3; }
        }
        @keyframes lumi-drift {
          0%,100% { transform: translateX(0) translateY(0) rotate(0deg); }
          33%      { transform: translateX(8px) translateY(-6px) rotate(5deg); }
          66%      { transform: translateX(-5px) translateY(4px) rotate(-3deg); }
        }
      `}</style>

      {/* Stars */}
      {BIG_STARS.map(s => (
        <div key={s.id} style={{
          position: "absolute",
          left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size,
          borderRadius: "50%",
          background: s.y < 30 ? "#E8E0FF" : "#fff",
          "--op": s.opacity,
          opacity: s.opacity,
          animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
        } as any} />
      ))}

      {/* Aurora bands */}
      <div style={{
        position: "absolute", top: "15%", left: "-20%", right: "-20%", height: 120,
        background: "linear-gradient(180deg, transparent 0%, rgba(107,91,149,0.18) 40%, rgba(200,184,232,0.12) 60%, transparent 100%)",
        borderRadius: "50%",
        animation: "aurora 8s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "25%", left: "-30%", right: "-30%", height: 80,
        background: "linear-gradient(180deg, transparent 0%, rgba(78,120,200,0.1) 50%, transparent 100%)",
        borderRadius: "50%",
        animation: "aurora 11s ease-in-out 2s infinite",
        pointerEvents: "none",
      }} />

      {/* Shooting star canvas */}
      <canvas ref={canvasRef} width={390} height={580}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", opacity: 0.7 }} />

      {/* ── Header bar ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "52px 24px 0",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(200,184,232,0.38)", letterSpacing: "0.12em", marginBottom: 4 }}>YOUR SKY</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "rgba(242,234,255,0.96)", letterSpacing: -0.8, lineHeight: 1.1 }}>Lyra</div>
          <div style={{ fontSize: 11, color: "rgba(200,184,232,0.42)", marginTop: 2, letterSpacing: "0.04em" }}>Dreamwalker · @lyra</div>
        </div>

        {/* Avatar + Lumi */}
        <div style={{ position: "relative" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "radial-gradient(circle at 38% 35%, rgba(152,120,216,0.9), rgba(40,28,72,0.95))",
            border: "2px solid rgba(200,184,232,0.35)",
            boxShadow: "0 0 20px rgba(107,91,149,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
          }}>🌙</div>
          {/* Lumi orbital companion */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            marginTop: -6, marginLeft: -6,
            animation: "orbit 4s linear infinite",
          }}>
            <div style={{
              width: 12, height: 12, borderRadius: "50%",
              background: "radial-gradient(circle, #FFF5C0, #C8A84B)",
              boxShadow: "0 0 6px 2px rgba(200,168,75,0.7)",
              fontSize: 7, display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(200,168,75,0.4)",
            }}>✦</div>
          </div>
        </div>
      </div>

      {/* ── Season banner ── */}
      <div style={{
        position: "absolute", top: 148, left: 24, right: 24,
        padding: "10px 16px",
        borderRadius: 16,
        border: "1px solid rgba(244,160,192,0.2)",
        background: "rgba(244,160,192,0.06)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 16 }}>🌸</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "#F4A0C0", fontWeight: 600, letterSpacing: "0.08em" }}>SPRING JOURNEY</div>
          <div style={{ fontSize: 10, color: "rgba(200,184,232,0.45)", marginTop: 1 }}>Cherry blossom season · 18 days left</div>
        </div>
        <div style={{
          padding: "3px 8px", borderRadius: 10,
          background: "rgba(244,160,192,0.12)",
          fontSize: 10, color: "#F4A0C0", fontWeight: 600,
        }}>New rewards</div>
      </div>

      {/* ── Constellation map centrepiece ── */}
      <div style={{
        position: "absolute", top: 210, left: 0, right: 0, height: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width={300} height={180} style={{ overflow: "visible" }}>
          {/* Outer glow */}
          <ellipse cx={150} cy={90} rx={120} ry={80}
            fill="none" stroke="rgba(200,184,248,0.06)" strokeWidth={60} />

          {/* Connector lines */}
          {CONST_LINES.map(([a,b],i) => {
            const na = CONST_NODES[a], nb = CONST_NODES[b];
            const xa = (na.x - 38) / (70-38) * 300;
            const ya = (na.y - 14) / (34-14) * 180;
            const xb = (nb.x - 38) / (70-38) * 300;
            const yb = (nb.y - 14) / (34-14) * 180;
            return (
              <line key={i} x1={xa} y1={ya} x2={xb} y2={yb}
                stroke="rgba(200,184,248,0.28)" strokeWidth="1.2"
                strokeDasharray="4 3" />
            );
          })}

          {/* Star nodes */}
          {CONST_NODES.map((node, i) => {
            const x = (node.x - 38) / (70-38) * 300;
            const y = (node.y - 14) / (34-14) * 180;
            return (
              <g key={i}>
                {node.earned && (
                  <>
                    <circle cx={x} cy={y} r={14} fill="rgba(200,168,75,0.08)" />
                    <circle cx={x} cy={y} r={9}  fill="rgba(200,168,75,0.12)" />
                  </>
                )}
                <circle cx={x} cy={y} r={node.earned ? 5.5 : 3.5}
                  fill={node.earned ? "#C8A84B" : "rgba(200,184,248,0.35)"}
                  style={{ filter: node.earned ? "drop-shadow(0 0 4px #C8A84B)" : "none" }}
                />
                {node.earned && (
                  <text x={x} y={y+18} textAnchor="middle"
                    fill="rgba(200,168,75,0.6)" fontSize={8} fontStyle="italic">
                    {node.key}
                  </text>
                )}
                {!node.earned && (
                  <circle cx={x} cy={y} r={5.5}
                    fill="none" stroke="rgba(200,184,248,0.2)" strokeWidth="1"
                    strokeDasharray="2 2" />
                )}
              </g>
            );
          })}
        </svg>

        {/* Caption */}
        <div style={{
          position: "absolute", bottom: 4, left: 0, right: 0,
          textAlign: "center", fontSize: 9,
          color: "rgba(200,184,232,0.28)", letterSpacing: "0.12em",
        }}>
          2 of 5 STARS UNLOCKED · TAP TO EXPLORE
        </div>
      </div>

      {/* ── Story whisper card ── */}
      <div style={{
        position: "absolute", top: 435, left: 24, right: 24,
        padding: "14px 16px",
        borderRadius: 18,
        border: "1px solid rgba(200,184,232,0.1)",
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(8px)",
        animation: "float-card 6s ease-in-out infinite",
      }}>
        <div style={{ fontSize: 9, color: "rgba(200,184,232,0.35)", letterSpacing: "0.12em", marginBottom: 6 }}>MOST RECENT CHAPTER</div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "rgba(242,234,255,0.85)", letterSpacing: -0.2, marginBottom: 4 }}>The Rain That Stayed</div>
        <div style={{ fontSize: 11.5, color: "rgba(200,184,232,0.48)", lineHeight: 1.55, fontStyle: "italic" }}>
          "She didn't know why she kept the window open. Maybe she liked the feeling of being almost somewhere else."
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          {[["👁","12 witnessed"],["✦","4 stickers"],["🔖","3 saved"]].map(([icon,label],i) => (
            <div key={i} style={{ fontSize: 10, color: "rgba(200,184,232,0.38)", display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 11 }}>{icon}</span>{label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Write prompt ── */}
      <div style={{
        position: "absolute", top: 570, left: 24, right: 24,
        padding: "12px 18px",
        borderRadius: 18,
        border: "1px dashed rgba(200,184,232,0.15)",
        background: "rgba(107,91,149,0.07)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>🪶</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "rgba(200,184,232,0.55)", fontStyle: "italic" }}>
            What stayed with you today?
          </div>
        </div>
        <div style={{
          padding: "5px 12px", borderRadius: 14,
          background: "rgba(107,91,149,0.35)",
          border: "1px solid rgba(200,184,232,0.2)",
          fontSize: 11, color: "rgba(220,210,255,0.8)", fontWeight: 500,
        }}>Write</div>
      </div>

      {/* ── Ambient friends row ── */}
      <div style={{
        position: "absolute", top: 658, left: 24, right: 24,
        display: "flex", alignItems: "center", gap: 0,
      }}>
        {[
          { emoji: "✿", color: "#F4A0C0", name: "Sol" },
          { emoji: "◑", color: "#78B4DC", name: "Aeli" },
          { emoji: "⋆", color: "#C8A84B", name: "Rue" },
        ].map((f, i) => (
          <div key={i} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, ${f.color}99, ${f.color}33)`,
              border: `1.5px solid ${f.color}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, boxShadow: `0 0 8px ${f.color}33`,
            }}>{f.emoji}</div>
          </div>
        ))}
        <div style={{ fontSize: 10.5, color: "rgba(200,184,232,0.38)", marginLeft: 10 }}>
          Sol, Aeli + 1 are in the sky
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{
        position: "absolute", bottom: 20, left: 20, right: 20, height: 52,
        borderRadius: 26,
        background: "rgba(8,6,18,0.88)",
        border: "1px solid rgba(200,184,232,0.09)",
        backdropFilter: "blur(20px)",
        display: "flex", alignItems: "center", justifyContent: "space-around",
        padding: "0 12px",
      }}>
        {[["🏠","Home"],["📖","Journal"],["✦",""],["🔭","Discover"],["👤","Profile"]].map(([icon,label],i) => (
          <div key={i} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            opacity: i === 0 ? 1 : 0.38,
          }}>
            {i === 2 ? (
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "linear-gradient(135deg, #8B6BB8, #5B4585)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 16px rgba(107,91,149,0.6)",
                marginBottom: 2, marginTop: -14,
                fontSize: 16, color: "#fff",
              }}>{icon}</div>
            ) : (
              <>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontSize: 8, color: i === 0 ? "#C8B8E8" : "rgba(200,184,232,0.35)", letterSpacing: "0.06em" }}>{label}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
