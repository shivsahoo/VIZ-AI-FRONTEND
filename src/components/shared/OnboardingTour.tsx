/**
 * OnboardingTour.tsx
 *
 * Guided onboarding tour powered by Driver.js.
 * Replaces the previous React Joyride implementation.
 *
 * Public API:
 *   <OnboardingTour run={boolean} onTourEnd={(outcome) => void} />
 *
 * outcome: "finished" | "skipped"
 */

import React, { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { driver, type Driver, type PopoverDOM } from "driver.js";
import "driver.js/dist/driver.css";
import { Sparkles, BarChart3, LayoutDashboard } from "lucide-react";
import { PopupCard } from "./PopupCard";
import { Button } from "../ui/button";
import { GradientButton } from "./GradientButton";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
export type TourOutcome = "finished" | "skipped";

interface OnboardingTourProps {
  /** When true the tour starts; when toggled false the tour is destroyed. */
  run: boolean;
  /** Called when the tour ends with how it ended. */
  onTourEnd: (outcome: TourOutcome) => void;
}

/* ------------------------------------------------------------------ */
/*  Step metadata                                                       */
/* ------------------------------------------------------------------ */
interface TourStepMeta {
  target: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const TOUR_STEPS: TourStepMeta[] = [
  {
    target: '[data-tour-target="enrich-datasource-btn"]',
    icon: <Sparkles />,
    title: "Enrich Datasource",
    description:
      "Enhance your data with intelligent insights — detect relationships, enrich metadata, and improve context automatically.",
  },
  {
    target: "#tour-sidebar-charts",
    icon: <BarChart3 />,
    title: "Charts",
    description:
      "Generate beautiful charts from your data — bar, line, pie, and more. Pin your favorites to Home for quick access.",
  },
  {
    target: "#tour-sidebar-dashboard",
    icon: <LayoutDashboard />,
    title: "Dashboards",
    description:
      "Build custom dashboards by arranging charts side by side. Share with your team or keep them private for personal analytics.",
  },
];

/* ------------------------------------------------------------------ */
/*  Popover content renderer                                            */
/* ------------------------------------------------------------------ */

/**
 * Renders our custom PopupCard into the Driver.js popover wrapper.
 *
 * BUG FIX — always creates a FRESH root each step.
 * Reusing a root from a prior step fails because Driver.js builds a brand-new
 * popover DOM on every navigation. The old root is mounted in the now-detached
 * previous wrapper, so root.render() on it never reaches the live DOM.
 * We unmount the old root (if any) before creating the new one.
 *
 * BUG FIX — sets explicit minWidth/minHeight on the wrapper BEFORE React
 * renders. Driver.js measures the wrapper's bounding box synchronously to
 * decide placement. If the box is 0×0 (all native content hidden, React not
 * yet rendered), placement is computed wrong and the card clips the viewport.
 */
function renderPopoverContent(
  popover: PopoverDOM,
  stepIndex: number,
  isLastStep: boolean,
  onSkip: () => void,
  onNext: () => void,
  onFinish: () => void,
  previousRoot: Root | null  // only used for cleanup; never reused as mount
): Root {
  const meta = TOUR_STEPS[stepIndex];

  // Unmount the previous step's root before we take over the wrapper
  if (previousRoot) {
    try { previousRoot.unmount(); } catch { /* ignore */ }
  }

  // Hide all native Driver.js chrome — we supply our own UI via PopupCard
  const { title, description, footer, closeButton, progress } = popover;
  title.style.display = "none";
  description.style.display = "none";
  footer.style.display = "none";
  closeButton.style.display = "none";
  if (progress) progress.style.display = "none";

  // Strip visual styling from the wrapper so our PopupCard controls appearance
  const wrapper = popover.wrapper;
  wrapper.style.background = "transparent";
  wrapper.style.padding = "0";
  wrapper.style.boxShadow = "none";
  wrapper.style.border = "none";
  wrapper.style.borderRadius = "0";

  // ── BUG 1 FIX ────────────────────────────────────────────────────────────
  // Pre-size the wrapper so Driver.js has a realistic bounding box when it
  // calculates the popover position. Without this the wrapper is 0×0 (native
  // elements are already hidden) and placement is computed for a 0-height box;
  // React then expands the wrapper, pushing the card outside the viewport.
  wrapper.style.minWidth = "320px";
  wrapper.style.minHeight = "180px";
  // ─────────────────────────────────────────────────────────────────────────

  // ── BUG 2 FIX ────────────────────────────────────────────────────────────
  // Always create a fresh mount node + root. Driver.js creates a new wrapper
  // element for every step, so we cannot reuse a root from the prior step.
  const mountNode = document.createElement("div");
  mountNode.setAttribute("data-tour-react-root", "true");
  wrapper.appendChild(mountNode);
  const root = createRoot(mountNode);
  // ─────────────────────────────────────────────────────────────────────────

  root.render(
    <PopupCard
      icon={meta.icon}
      title={meta.title}
      description={meta.description}
      leftButton={
        !isLastStep ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
          >
            Skip tour
          </Button>
        ) : (
          <span />
        )
      }
      rightButton={
        <GradientButton
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            if (isLastStep) {
              onFinish();
            } else {
              onNext();
            }
          }}
        >
          {isLastStep ? "Finish" : "Next ➔"}
        </GradientButton>
      }
    />
  );

  return root;
}

/* ------------------------------------------------------------------ */
/*  OnboardingTour component                                            */
/* ------------------------------------------------------------------ */
export function OnboardingTour({ run, onTourEnd }: OnboardingTourProps) {
  // Stable ref to the current onTourEnd callback to avoid stale closures
  const onTourEndRef = useRef(onTourEnd);
  useEffect(() => {
    onTourEndRef.current = onTourEnd;
  }, [onTourEnd]);

  // Refs for Driver instance and React roots
  const driverRef = useRef<Driver | null>(null);
  const reactRootsRef = useRef<(Root | null)[]>([]);

  // Tracks whether the tour ended programmatically (skip / finish)
  // vs. being destroyed externally (run → false, unmount).
  const outcomeRef = useRef<TourOutcome | null>(null);

  /** Tear down Driver.js and unmount all React roots. */
  const teardown = () => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
    // Unmount React popover roots
    reactRootsRef.current.forEach((root) => {
      try {
        root?.unmount();
      } catch {
        // ignore unmount errors during teardown
      }
    });
    reactRootsRef.current = [];
  };

  useEffect(() => {
    if (!run) {
      // Caller toggled run off → destroy any active tour silently
      teardown();
      outcomeRef.current = null;
      return;
    }

    // Prevent duplicate instances
    if (driverRef.current?.isActive()) {
      return;
    }

    outcomeRef.current = null;

    // Mutable root ref used by onPopoverRender (replaced each step)
    let currentRoot: Root | null = null;

    /** Called when Skip is clicked inside our React card. */
    const handleSkip = () => {
      outcomeRef.current = "skipped";
      teardown();
      onTourEndRef.current("skipped");
    };

    /** Called when Finish is clicked on the last step. */
    const handleFinish = () => {
      outcomeRef.current = "finished";
      teardown();
      onTourEndRef.current("finished");
    };

    /** Called when Next is clicked (non-last steps). */
    const handleNext = () => {
      driverRef.current?.moveNext();
    };

    const driverInstance = driver({
      // ── Overlay / UX options ──────────────────────────────────────
      overlayColor: "rgba(0, 0, 0, 0.55)",
      overlayOpacity: 1,
      smoothScroll: true,
      allowClose: false, // disable overlay-click dismiss
      showProgress: false,
      stagePadding: 8,
      stageRadius: 8,
      disableActiveInteraction: false,

      // ── Steps ─────────────────────────────────────────────────────
      // BUG 1 FIX: per-step side/align matched to each target's screen position.
      //   Step 1 — "Enrich Datasource" button sits at the top-right of the
      //            dialog. side:"bottom" tried to place the card below, but the
      //            dialog is near the top of the viewport so the card clipped.
      //            side:"left" places it to the left of the button where there
      //            is ample room.
      //   Steps 2-3 — sidebar items are on the left edge; side:"right" keeps
      //            the card in the centre of the viewport.
      steps: [
        {
          element: TOUR_STEPS[0].target,
          popover: {
            title: TOUR_STEPS[0].title,
            description: TOUR_STEPS[0].description,
            side: "left" as const,
            align: "start" as const,
          },
        },
        {
          element: TOUR_STEPS[1].target,
          popover: {
            title: TOUR_STEPS[1].title,
            description: TOUR_STEPS[1].description,
            side: "right" as const,
            align: "start" as const,
          },
        },
        {
          element: TOUR_STEPS[2].target,
          popover: {
            title: TOUR_STEPS[2].title,
            description: TOUR_STEPS[2].description,
            side: "right" as const,
            align: "start" as const,
          },
        },
      ],

      // ── Custom popover rendering ───────────────────────────────────
      onPopoverRender: (popover: PopoverDOM) => {
        const activeIndex = driverInstance.getActiveIndex() ?? 0;
        const isLastStep = activeIndex === TOUR_STEPS.length - 1;

        // Pass currentRoot only for cleanup (unmount). renderPopoverContent
        // always creates a fresh root — it never reuses currentRoot as a mount.
        currentRoot = renderPopoverContent(
          popover,
          activeIndex,
          isLastStep,
          handleSkip,
          handleNext,
          handleFinish,
          currentRoot   // previousRoot — consumed for cleanup only
        );

        // Track only the latest root; prior roots are already unmounted
        reactRootsRef.current = [currentRoot];
      },

      // ── Lifecycle hooks ────────────────────────────────────────────
      onDestroyed: () => {
        // If the tour was destroyed without an explicit outcome (e.g. the
        // user closed the parent dialog), treat it as a skip so the parent
        // can clean up correctly.  If outcome is already set, do nothing.
        if (!outcomeRef.current) {
          onTourEndRef.current("skipped");
        }
      },
    });

    driverRef.current = driverInstance;
    driverInstance.drive();

    // Cleanup on unmount or when run changes
    return () => {
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  // This component renders nothing into the React tree —
  // Driver.js manages its own DOM overlay.
  return null;
}
