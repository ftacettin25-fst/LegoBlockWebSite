import { useEffect, useState } from "react";
import {
  Check,
  Loader2,
  Upload,
  Sparkles,
  LayoutGrid,
  Ruler,
  Box,
  Blocks,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

const STEPS: { icon: LucideIcon; label: string }[] = [
  { icon: Upload, label: "Uploading photo" },
  { icon: Sparkles, label: "AI appearance analysis" },
  { icon: LayoutGrid, label: "Generating 4 views in parallel" },
  { icon: Ruler, label: "Analyzing grid perspective" },
  { icon: Box, label: "Building 3D space matrix" },
  { icon: Blocks, label: "Assembling bricks" },
  { icon: CheckCircle2, label: "Finalizing" },
];

const BRICK_COLORS = [
  "#460050",
  "#3b3091",
  "#a3123a",
  "#1f6b3a",
  "#c89a2a",
  "#460050",
  "#3b3091",
  "#a3123a",
];

export function BuildOverlay({
  open,
  onDone,
  durationMs = 4200,
}: {
  open: boolean;
  onDone?: () => void;
  durationMs?: number;
}) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!open) {
      setActiveStep(0);
      return;
    }
    const stepTime = durationMs / STEPS.length;
    const id = setInterval(() => {
      setActiveStep((s) => {
        if (s >= STEPS.length - 1) {
          clearInterval(id);
          setTimeout(() => onDone?.(), 350);
          return s;
        }
        return s + 1;
      });
    }, stepTime);
    return () => clearInterval(id);
  }, [open, durationMs, onDone]);

  if (!open) return null;

  const progress = ((activeStep + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 px-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border bg-card p-8 shadow-elegant animate-scale-in">
        {/* Brick stack animation */}
        <div className="mx-auto mb-6 flex h-24 w-24 flex-wrap content-end justify-center gap-1">
          {BRICK_COLORS.map((c, i) => (
            <div
              key={i}
              className="h-5 w-5 rounded-sm shadow-sm"
              style={{
                backgroundColor: c,
                animation: `brick-pop 1.2s ease-in-out ${i * 0.12}s infinite`,
              }}
            />
          ))}
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight">Building your BrickHead…</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This takes a moment. Please don't close this page.
          </p>
        </div>

        {/* Progress bar */}
        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-gradient-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <ul className="mt-6 space-y-2">
          {STEPS.map((s, i) => {
            const done = i < activeStep;
            const active = i === activeStep;
            const Icon = s.icon;
            return (
              <li
                key={s.label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                  active
                    ? "border border-primary/20 bg-primary/10 text-foreground font-semibold"
                    : done
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {done ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Icon className="h-4 w-4 text-muted-foreground/50" />
                  )}
                </span>
                <span>{s.label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <style>{`
        @keyframes brick-pop {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
