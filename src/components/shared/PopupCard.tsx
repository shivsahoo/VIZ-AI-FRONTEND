import * as React from "react";

import { cn } from "../ui/utils";

export type PopupCardProps = {
  icon: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  leftButton: React.ReactNode;
  rightButton: React.ReactNode;
  className?: string;
};

export function PopupCard({
  icon,
  title,
  description,
  leftButton,
  rightButton,
  className,
}: PopupCardProps) {
  return (
    <section
      className={cn(
        "w-full max-w-sm rounded-2xl border bg-card text-card-foreground shadow-lg shadow-black/10",
        className,
      )}
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-3">
          <div className="w-fit rounded-xl border bg-muted/20 p-2 text-foreground">
            <div className="[&>svg]:size-5 [&>svg]:shrink-0">{icon}</div>
          </div>

          <div className="space-y-1.5">
            <div className="text-base font-semibold leading-tight">{title}</div>
            <div className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-start">{leftButton}</div>
          <div className="flex items-center justify-end">{rightButton}</div>
        </div>
      </div>
    </section>
  );
}
