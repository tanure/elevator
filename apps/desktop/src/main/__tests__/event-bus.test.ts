import { describe, expect, it, vi } from "vitest";
import { eventBus } from "../event-bus.js";

describe("eventBus", () => {
  it("delivers a payload to a registered listener", () => {
    const listener = vi.fn();
    eventBus.on("task.created", listener);
    eventBus.emit("task.created", { id: "t1" });
    eventBus.off("task.created", listener);
    expect(listener).toHaveBeenCalledWith({ id: "t1" });
  });

  it("delivers to multiple listeners in registration order", () => {
    const order: string[] = [];
    const a = (): void => {
      order.push("a");
    };
    const b = (): void => {
      order.push("b");
    };
    eventBus.on("note.created", a);
    eventBus.on("note.created", b);
    eventBus.emit("note.created", { id: "n1" });
    eventBus.off("note.created", a);
    eventBus.off("note.created", b);
    expect(order).toEqual(["a", "b"]);
  });

  it("once() fires exactly one time", () => {
    const listener = vi.fn();
    eventBus.once("task.updated", listener);
    eventBus.emit("task.updated", { id: "t2" });
    eventBus.emit("task.updated", { id: "t2" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("off() removes the listener", () => {
    const listener = vi.fn();
    eventBus.on("task.deleted", listener);
    eventBus.off("task.deleted", listener);
    eventBus.emit("task.deleted", { id: "t3" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not invoke listeners for other event names", () => {
    const taskListener = vi.fn();
    const noteListener = vi.fn();
    eventBus.on("task.created", taskListener);
    eventBus.on("note.created", noteListener);
    eventBus.emit("note.created", { id: "n2" });
    eventBus.off("task.created", taskListener);
    eventBus.off("note.created", noteListener);
    expect(taskListener).not.toHaveBeenCalled();
    expect(noteListener).toHaveBeenCalledTimes(1);
  });
});
