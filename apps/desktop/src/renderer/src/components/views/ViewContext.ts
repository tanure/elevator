import { createContext, useContext } from "react";
import type { ViewRecord } from "@elevator/shared";

export const ViewContext = createContext<ViewRecord | null>(null);

export function useViewContext(): ViewRecord | null {
  return useContext(ViewContext);
}
