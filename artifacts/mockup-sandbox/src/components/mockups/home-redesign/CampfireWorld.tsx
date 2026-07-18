import { useEffect, useRef, useState } from "react";
import "./_group.css";

const NUM_STARS = 60;

function generateStars() {
  return Array.from({ length: NUM_STARS }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 62,
    size: Math.random() * 1.8 + 0.6,
    delay: Math.random() * 4,
    dur: 2.5 + Math.random() * 3,
    opacity: 0.4 + Math.random() * 0.6,
  }));
}

const STARS = generateStars();

const CONSTELLATION = [
  { x: 68, y: 12 }, { x: 72, y: 18 }, { x: 78, y: 14 },
  { x: 75, y: 22 }, { x: 82, y: 20 }, { x: 70, y: 26 },
];
const LINES = [[0,1],[1,2],[1,3],[3,4],[3,5]];

function FireParticle({ x, delay }: { x: number; delay: number }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "100%",
        left: `${x}%`,
        width: 3,
        height: 3,
        borderRadius: "50%",
        background: "rgba(255,160,40,0.9)",
        animation: `rise ${1.2 + Math.random() * 0.8}s ease-out ${delay}s infinite`,
        pointerEvents: "none",
      }}
    />
  );
}

export function CampfireWorld() {
  const [_tick, setTick] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current++;
      setTick(tickRef.current);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      width: 390, height: 844,
      background: "linear-gradient(180deg, #030610 0%, #080B1E 30%, #0E1128 55%, #1A140A 80%, #251608 100%)",
      position: "relative", overflow: "hidden", fontFamily: "'Inter', sans-serif",
    }}>
      <style>{`
        @keyframes twinkle {
          0%,100% { opacity: var(--op); transform: scale(1); }
          50% { opacity: calc(var(--op) * 0.25); transform: scale(0.7); }
        }
        @keyframes rise {
          0%   { opacity: 0.9; transform: translateY(0) translateX(0) scale(1); }
          100% { opacity: 0; transform: translateY(-38px) translateX(${Math.random()>0.5?6:-6}px) scale(0.3); }
        }
        @keyframes flicker {
          0%,100% { transform: scaleX(1) scaleY(1); opacity: 1; }
          25%      { transform: scaleX(0.92) scaleY(1.06); opacity: 0.95; }
          50%      { transform: scaleX(1.06) scaleY(0.94); opacity: 0.98; }
          75%      { transform: scaleX(0.96) scaleY(1.04); opacity: 0.96; }
        }
        @keyframes glow-pulse {
          0%,100% { opacity: 0.22; transform: scale(1); }
          50%      { opacity: 0.36; transform: scale(1.06); }
        }
        @keyframes float-text {
          0%,100% { transform: translateY(0px); opacity: 1; }
          50%      { transform: translateY(-4px); opacity: 0.92; }
        }
        @keyframes float-badge {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes drift {
          0%,100% { transform: translateX(0px) translateY(0px); }
          33%      { transform: translateX(3px) translateY(-2px); }
          66%      { transform: translateX(-2px) translateY(1px); }
        }
        @keyframes friend-glow {
          0%,100% { box-shadow: 0 0 6px 2px rgba(200,168,75,0.45); }
          50%      { box-shadow: 0 0 12px 4px rgba(200,168,75,0.7); }
        }
        @keyframes smoke {
          0%   { opacity: 0.18; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-28px) scale(1.6); }
        }
      `}</style>

      {/* ── Stars ── */}
      {STARS.map(s => (
        <div key={s.id} style={{
          position: "absolute",
          left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size,
          borderRadius: "50%",
          background: "#fff",
          "--op": s.opacity,
          opacity: s.opacity,
          animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any} />
      ))}

      {/* ── Constellation top-right ── */}
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "62%", pointerEvents: "none" }}>
        {LINES.map(([a,b],i) => (
          <line key={i}
            x1={`${CONSTELLATION[a].x}%`} y1={`${CONSTELLATION[a].y}%`}
            x2={`${CONSTELLATION[b].x}%`} y2={`${CONSTELLATION[b].y}%`}
            stroke="rgba(200,184,248,0.22)" strokeWidth="0.8"
          />
        ))}
        {CONSTELLATION.map((pt, i) => (
          <circle key={i}
            cx={`${pt.x}%`} cy={`${pt.y}%`}
            r={i === 0 ? 3.5 : 2}
            fill={i === 0 ? "#C8A84B" : "rgba(200,184,248,0.7)"}
            style={{ filter: i === 0 ? "drop-shadow(0 0 3px #C8A84B)" : "none" }}
          />
        ))}
      </svg>

      {/* ── Season label top-center ── */}
      <div style={{
        position: "absolute", top: 28, left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 6,
        padding: "4px 12px", borderRadius: 20,
        border: "1px solid rgba(244,160,192,0.25)",
        background: "rgba(244,160,192,0.06)",
        animation: "float-badge 4s ease-in-out infinite",
      }}>
        <span style={{ fontSize: 11 }}>🌸</span>
        <span style={{ fontSize: 10, color: "#F4A0C0", letterSpacing: "0.12em", fontWeight: 600 }}>SPRING SEASON</span>
      </div>

      {/* ── Player name ── */}
      <div style={{
        position: "absolute", top: 68, left: "50%", transform: "translateX(-50%)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "rgba(242,234,255,0.94)", letterSpacing: -0.5 }}>Lyra</div>
        <div style={{ fontSize: 11, color: "rgba(200,184,232,0.38)", marginTop: 2, letterSpacing: "0.05em" }}>Dreamwalker</div>
      </div>

      {/* ── Floating narrative text ── */}
      <div style={{
        position: "absolute", top: 154, left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        animation: "float-text 5s ease-in-out infinite",
        padding: "0 24px",
      }}>
        <div style={{
          fontSize: 13.5, color: "rgba(200,184,232,0.62)",
          fontStyle: "italic", textAlign: "center", lineHeight: 1.6,
          letterSpacing: 0.1,
        }}>
          ✦ Three souls carried your chapter tonight
        </div>
        <div style={{
          fontSize: 12, color: "rgba(200,168,75,0.55)",
          textAlign: "center", letterSpacing: 0.05,
        }}>
          You wrote 4 nights in a row
        </div>
      </div>

      {/* ── Ground ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 220,
        background: "linear-gradient(180deg, transparent 0%, #120C04 35%, #1C1208 100%)",
        borderTopLeftRadius: 80, borderTopRightRadius: 80,
      }} />

      {/* ── Fire glow on ground ── */}
      <div style={{
        position: "absolute", bottom: 140, left: "50%", transform: "translateX(-50%)",
        width: 200, height: 90,
        background: "radial-gradient(ellipse at 50% 80%, rgba(255,120,20,0.35) 0%, rgba(200,80,10,0.18) 45%, transparent 75%)",
        animation: "glow-pulse 2s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* ── Campfire ── */}
      <div style={{
        position: "absolute", bottom: 168, left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        {/* Smoke wisps */}
        {[0,1,2].map(i => (
          <div key={i} style={{
            position: "absolute", bottom: "100%",
            left: `${35 + i*15}%`, width: 4, height: 4,
            borderRadius: "50%", background: "rgba(160,140,120,0.4)",
            animation: `smoke 2s ease-out ${i * 0.6}s infinite`,
          }} />
        ))}

        {/* Flame */}
        <div style={{
          width: 28, height: 38, marginBottom: -2,
          background: "linear-gradient(180deg, #fff5c0 0%, #FFB830 25%, #FF6010 65%, transparent 100%)",
          clipPath: "polygon(50% 0%, 90% 60%, 75% 100%, 25% 100%, 10% 60%)",
          animation: "flicker 0.8s ease-in-out infinite",
          filter: "blur(0.5px)",
        }} />
        <div style={{
          width: 20, height: 28, marginBottom: -6, marginTop: -10,
          background: "linear-gradient(180deg, #fff 0%, #FFD080 30%, #FF8020 80%, transparent 100%)",
          clipPath: "polygon(50% 0%, 85% 55%, 70% 100%, 30% 100%, 15% 55%)",
          animation: "flicker 0.65s ease-in-out 0.1s infinite",
          filter: "blur(0.3px)",
        }} />

        {/* Fire particles */}
        <div style={{ position: "relative", width: 30 }}>
          {[15,40,65,80].map((x,i) => <FireParticle key={i} x={x} delay={i*0.3} />)}
        </div>

        {/* Log base */}
        <div style={{
          width: 48, height: 8, borderRadius: 4,
          background: "linear-gradient(90deg, #3D2210, #5C3318, #3D2210)",
          boxShadow: "0 2px 8px rgba(200,80,10,0.5)",
        }} />
      </div>

      {/* ── Your character (silhouette) ── */}
      <div style={{
        position: "absolute", bottom: 152, left: "50%",
        transform: "translateX(-80px)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "radial-gradient(circle at 35% 35%, rgba(107,91,149,0.9), rgba(40,32,72,0.95))",
          border: "1.5px solid rgba(200,184,232,0.5)",
          boxShadow: "0 0 10px rgba(200,168,75,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13,
        }}>🌙</div>
        <div style={{ width: 12, height: 24, background: "rgba(40,32,72,0.8)", borderRadius: "0 0 4px 4px", marginTop: -2 }} />
        <div style={{ fontSize: 8, color: "rgba(200,184,232,0.45)", marginTop: 2, letterSpacing: "0.08em" }}>you</div>
      </div>

      {/* ── Friend 1 ── */}
      <div style={{
        position: "absolute", bottom: 158, left: "50%",
        transform: "translateX(40px)",
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%",
          background: "radial-gradient(circle at 35% 35%, rgba(244,160,192,0.8), rgba(120,60,80,0.9))",
          border: "1px solid rgba(244,160,192,0.4)",
          animation: "friend-glow 3s ease-in-out 0.5s infinite",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11,
        }}>✿</div>
        <div style={{ fontSize: 7, color: "rgba(244,160,192,0.4)", textAlign: "center", marginTop: 3, letterSpacing: "0.05em" }}>Sol</div>
      </div>

      {/* ── Friend 2 ── */}
      <div style={{
        position: "absolute", bottom: 155, left: "50%",
        transform: "translateX(68px)",
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: "50%",
          background: "radial-gradient(circle at 35% 35%, rgba(120,180,220,0.8), rgba(40,80,120,0.9))",
          border: "1px solid rgba(120,180,220,0.4)",
          animation: "friend-glow 3s ease-in-out 1.2s infinite",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9,
        }}>◑</div>
        <div style={{ fontSize: 7, color: "rgba(120,180,220,0.4)", textAlign: "center", marginTop: 3, letterSpacing: "0.05em" }}>Aeli</div>
      </div>

      {/* ── Lumi companion ── */}
      <div style={{
        position: "absolute", top: 118, right: 32,
        animation: "drift 7s ease-in-out infinite",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "radial-gradient(circle at 38% 35%, rgba(255,240,180,0.95), rgba(200,168,75,0.8))",
          boxShadow: "0 0 14px 4px rgba(200,168,75,0.45), 0 0 32px 8px rgba(200,168,75,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>✦</div>
        <div style={{ fontSize: 8, color: "rgba(200,168,75,0.6)", textAlign: "center", marginTop: 4, letterSpacing: "0.08em" }}>Lumi</div>
      </div>

      {/* ── Reward path pill ── */}
      <div style={{
        position: "absolute", bottom: 272, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 6, alignItems: "center",
      }}>
        {[true,false,false,false,false].map((earned,i) => (
          <div key={i} style={{
            width: earned ? 10 : 8, height: earned ? 10 : 8,
            borderRadius: "50%",
            background: earned ? "#C8A84B" : "rgba(200,184,232,0.15)",
            border: earned ? "none" : "1px solid rgba(200,184,232,0.2)",
            boxShadow: earned ? "0 0 6px 2px rgba(200,168,75,0.5)" : "none",
          }} />
        ))}
      </div>
      <div style={{
        position: "absolute", bottom: 256, left: "50%", transform: "translateX(-50%)",
        fontSize: 9, color: "rgba(200,184,232,0.32)", letterSpacing: "0.1em", whiteSpace: "nowrap",
      }}>SPRING JOURNEY · 1 of 5 STARS</div>

      {/* ── Write tonight button ── */}
      <div style={{
        position: "absolute", bottom: 106, left: "50%", transform: "translateX(-50%)",
        padding: "10px 28px",
        borderRadius: 24,
        background: "rgba(107,91,149,0.22)",
        border: "1px solid rgba(200,184,232,0.18)",
        backdropFilter: "blur(8px)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}>
        <span style={{ fontSize: 13, color: "rgba(220,210,255,0.82)", fontWeight: 500, letterSpacing: 0.2 }}>
          ✦ Open your journal
        </span>
      </div>

      {/* ── Tab bar ── */}
      <div style={{
        position: "absolute", bottom: 20, left: 20, right: 20, height: 52,
        borderRadius: 26,
        background: "rgba(16,10,28,0.82)",
        border: "1px solid rgba(200,184,232,0.1)",
        backdropFilter: "blur(16px)",
        display: "flex", alignItems: "center", justifyContent: "space-around",
        padding: "0 12px",
      }}>
        {[["🏠","Home"],["📖","Journal"],["✦",""],["🔭","Discover"],["👤","Profile"]].map(([icon,label],i) => (
          <div key={i} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            opacity: i === 0 ? 1 : 0.4,
          }}>
            {i === 2 ? (
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "linear-gradient(135deg, #8B6BB8, #6B5B95)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 14px rgba(107,91,149,0.55)",
                marginBottom: 2, marginTop: -14,
                fontSize: 16, color: "#fff",
              }}>{icon}</div>
            ) : (
              <>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontSize: 8, color: i === 0 ? "#C8B8E8" : "rgba(200,184,232,0.4)", letterSpacing: "0.06em" }}>{label}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
