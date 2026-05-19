import type { ReactElement } from "react";
import { useDashboardStore } from "@renderer/stores/useDashboardStore";
import { getCard } from "@renderer/components/cards/registry";

export function Dashboard(): ReactElement {
  const { slots } = useDashboardStore();
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">{today}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {slots.map((slot) => {
          const def = getCard(slot.id);
          if (!def) return null;
          const { Component } = def;
          return (
            <div key={slot.id} className={slot.colSpan === 2 ? "col-span-2" : ""}>
              <Component />
            </div>
          );
        })}
      </div>
    </div>
  );
}
