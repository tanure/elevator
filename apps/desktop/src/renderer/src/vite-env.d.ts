/// <reference types="vite/client" />

import type { ElevatorApi } from "../../preload";

declare global {
  interface Window {
    elevator: ElevatorApi;
  }
}

