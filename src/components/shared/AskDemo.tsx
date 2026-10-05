import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import "./AskDemo.css";

const EASE = [0.28, 0.11, 0.32, 1] as const;

/* ── Product demo: a question is typed, then the chart it produces draws in ── */

type DemoKind = "bars" | "line" | "donut";

const DEMOS: { prompt: string; title: string; kind: DemoKind; stat: string; delta: string }[] = [
  { prompt: "Revenue by region last quarter", title: "Revenue by region", kind: "bars", stat: "$4.82M", delta: "+12.4%" },
  { prompt: "Weekly active users this year", title: "Weekly active users", kind: "line", stat: "18,240", delta: "+8.1%" },
  { prompt: "Orders split by channel", title: "Orders by channel", kind: "donut", stat: "62,907", delta: "+3.6%" },
];

const TYPE_MS = 38;
const HOLD_MS = 3600;

export function AskDemo() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(reduce ? DEMOS[0].prompt.length : 0);
  const demo = DEMOS[index];
  const done = typed >= demo.prompt.length;

  useEffect(() => {
    if (reduce) return;
    if (!done) {
      const t = setTimeout(() => setTyped((n) => n + 1), TYPE_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % DEMOS.length);
      setTyped(0);
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [typed, done, reduce]);

  return (
    <div className="demo">
      <div className="demo-ask">
        <Sparkles size={16} className="demo-ask-icon" aria-hidden="true" />
        <span className="demo-ask-text">
          {demo.prompt.slice(0, typed)}
          {!done && <span className="demo-caret" />}
        </span>
        <span className={`demo-ask-send${done ? " is-ready" : ""}`}>
          <ArrowRight size={14} />
        </span>
      </div>

      <div className="demo-card">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key={index}
              className="demo-card-body"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <div className="demo-card-head">
                <div>
                  <p className="demo-card-title">{demo.title}</p>
                  <p className="demo-card-stat">{demo.stat}</p>
                </div>
                <span className="demo-card-delta">{demo.delta}</span>
              </div>
              <div className="demo-chart">
                {demo.kind === "bars" && <DemoBars />}
                {demo.kind === "line" && <DemoLine />}
                {demo.kind === "donut" && <DemoDonut />}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="thinking"
              className="demo-card-body demo-thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className="demo-skeleton demo-skeleton--sm" />
              <span className="demo-skeleton demo-skeleton--md" />
              <span className="demo-skeleton demo-skeleton--chart" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const BAR_VALUES = [0.55, 0.82, 0.46, 0.94, 0.68];
const BAR_LABELS = ["NA", "EU", "LATAM", "APAC", "MEA"];

function DemoBars() {
  return (
    <svg viewBox="0 0 460 150" className="demo-svg">
      {BAR_VALUES.map((v, i) => {
        const h = v * 118;
        return (
          <g key={i}>
            <motion.rect
              x={10 + i * 92}
              y={122 - h}
              width={68}
              height={h}
              rx={10}
              className={i === 3 ? "demo-fill-accent" : "demo-fill"}
              style={{ originY: 1, transformBox: "fill-box" }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.7, delay: 0.08 * i, ease: EASE }}
            />
            <text x={44 + i * 92} y={142} textAnchor="middle" className="demo-axis">
              {BAR_LABELS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const LINE_PATH = "M8 118 C 60 108, 90 92, 130 96 S 200 70, 240 74 S 310 40, 350 46 S 420 22, 452 18";

function DemoLine() {
  return (
    <svg viewBox="0 0 460 150" className="demo-svg">
      {[40, 80, 120].map((y) => (
        <line key={y} x1="0" x2="460" y1={y} y2={y} className="demo-grid" />
      ))}
      <motion.path
        d={`${LINE_PATH} L 452 140 L 8 140 Z`}
        className="demo-area"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
      />
      <motion.path
        d={LINE_PATH}
        className="demo-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: EASE }}
      />
      <motion.circle
        cx="452"
        cy="18"
        r="5"
        className="demo-dot"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.1, type: "spring", stiffness: 400, damping: 18 }}
      />
    </svg>
  );
}

const DONUT = [
  { share: 0.46, cls: "demo-ring-1", label: "Web" },
  { share: 0.32, cls: "demo-ring-2", label: "App" },
  { share: 0.22, cls: "demo-ring-3", label: "Retail" },
];

function DemoDonut() {
  let offset = 0;
  return (
    <div className="demo-donut">
      <svg viewBox="0 0 120 120" className="demo-donut-svg">
        <circle cx="60" cy="60" r="44" className="demo-ring-track" />
        {DONUT.map((s, i) => {
          const start = offset;
          offset += s.share;
          return (
            <motion.circle
              key={i}
              cx="60"
              cy="60"
              r="44"
              className={`demo-ring ${s.cls}`}
              style={{ rotate: -90 + start * 360, transformOrigin: "60px 60px" }}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: s.share - 0.012 }}
              transition={{ duration: 0.8, delay: 0.15 * i, ease: EASE }}
            />
          );
        })}
      </svg>
      <ul className="demo-legend">
        {DONUT.map((s) => (
          <li key={s.label}>
            <span className={`demo-swatch ${s.cls}`} />
            {s.label}
            <span className="demo-legend-value">{Math.round(s.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
