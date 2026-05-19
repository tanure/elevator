import { EventEmitter } from "node:events";
import type { AppEventMap } from "@elevator/shared";

class TypedEventBus extends EventEmitter {
  override emit<K extends keyof AppEventMap>(event: K, data: AppEventMap[K]): boolean {
    return super.emit(event as string, data);
  }

  override on<K extends keyof AppEventMap>(
    event: K,
    listener: (data: AppEventMap[K]) => void
  ): this {
    return super.on(event as string, listener);
  }

  override off<K extends keyof AppEventMap>(
    event: K,
    listener: (data: AppEventMap[K]) => void
  ): this {
    return super.off(event as string, listener);
  }

  override once<K extends keyof AppEventMap>(
    event: K,
    listener: (data: AppEventMap[K]) => void
  ): this {
    return super.once(event as string, listener);
  }
}

export const eventBus = new TypedEventBus();
