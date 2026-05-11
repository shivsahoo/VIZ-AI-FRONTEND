import React, { useCallback } from "react";
import {
  Joyride,
  type Step,
  type TooltipRenderProps,
  EVENTS,
  STATUS,
} from "react-joyride";
import { Sparkles, BarChart3, LayoutDashboard } from "lucide-react";
import { PopupCard } from "./PopupCard";
import { Button } from "../ui/button";
import { GradientButton } from "./GradientButton";

/* ------------------------------------------------------------------ */
/*  Tour step metadata (used by the CustomTourTooltip)                */
/* ------------------------------------------------------------------ */
interface TourStepData {
  icon: React.ReactNode;
  tourTitle: string;
  tourDescription: string;
}

const TOUR_STEPS: Step[] = [
  {
    target: '[data-tour-target="enrich-datasource-btn"]',
    content: "",
    placement: "bottom",
    data: {
      icon: <Sparkles />,
      tourTitle: "Enrich Datasource",
      tourDescription:
        "Enhance your data with intelligent insights — detect relationships, enrich metadata, and improve context automatically.",
    } as TourStepData,
  },
  {
    target: "#tour-sidebar-charts",
    content: "",
    placement: "right",
    data: {
      icon: <BarChart3 />,
      tourTitle: "Charts",
      tourDescription:
        "Generate beautiful charts from your data — bar, line, pie, and more. Pin your favorites to Home for quick access.",
    } as TourStepData,
  },
  {
    target: "#tour-sidebar-dashboard",
    content: "",
    placement: "right",
    data: {
      icon: <LayoutDashboard />,
      tourTitle: "Dashboards",
      tourDescription:
        "Build custom dashboards by arranging charts side by side. Share with your team or keep them private for personal analytics.",
    } as TourStepData,
  },
];

/* ------------------------------------------------------------------ */
/*  Custom tooltip – maps react-joyride props → PopupCard             */
/* ------------------------------------------------------------------ */
function CustomTourTooltip({
  isLastStep,
  step,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) {
  const stepData = step.data as TourStepData | undefined;

  return (
    <div {...tooltipProps}>
      <PopupCard
        icon={stepData?.icon ?? <Sparkles />}
        title={stepData?.tourTitle ?? ""}
        description={stepData?.tourDescription ?? ""}
        leftButton={
          !isLastStep ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              {...skipProps}
            >
              Skip tour
            </Button>
          ) : (
            <span /> /* empty spacer on last step */
          )
        }
        rightButton={
          <GradientButton
            size="sm"
            {...primaryProps}
          >
            {isLastStep ? "Finish" : "Next ➔"}
          </GradientButton>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  OnboardingTour wrapper                                            */
/* ------------------------------------------------------------------ */
export type TourOutcome = "finished" | "skipped";

interface OnboardingTourProps {
  /** Whether to run the tour. Controlled by the parent. */
  run: boolean;
  /** Called when the tour ends. `outcome` indicates whether the user
   *  completed or skipped the tour. */
  onTourEnd: (outcome: TourOutcome) => void;
}

export function OnboardingTour({ run, onTourEnd }: OnboardingTourProps) {
  const handleEvent = useCallback(
    (data: { type: string; status: string }) => {
      const { type, status } = data;

      // Tour finished or skipped → report outcome to parent
      if (
        type === EVENTS.TOUR_END ||
        status === STATUS.FINISHED ||
        status === STATUS.SKIPPED
      ) {
        const outcome: TourOutcome =
          status === STATUS.SKIPPED ? "skipped" : "finished";
        onTourEnd(outcome);
      }
    },
    [onTourEnd],
  );

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      continuous
      onEvent={handleEvent}
      tooltipComponent={CustomTourTooltip}
      options={{
        zIndex: 99998,
        overlayColor: "rgba(0, 0, 0, 0.55)",
        hideOverlay: false,
        spotlightRadius: 8,
        skipBeacon: true,
      }}
    />
  );
}
