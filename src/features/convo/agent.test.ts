import { afterEach, describe, expect, it, vi } from "vitest";
import {
  agentAsked,
  agentFrame,
  agentSettled,
  agentTurn,
  agentWriting,
} from "@/features/convo/agent";

const THREAD = "6b1c9e64-3f5a-4a2e-9d7e-2f0f0a1b2c3d";

function typing(on: boolean, failed = false) {
  return {
    event: "agent.typing",
    data: { thread: THREAD, on, ...(failed ? { failed: true } : {}) },
  };
}

function token(text: string) {
  return { event: "agent.token", data: { thread: THREAD, text } };
}

describe("the agent's turn", () => {
  afterEach(() => {
    agentFrame(typing(false));
    agentSettled();
    vi.useRealTimers();
  });

  it("waits the moment a line is sent, before the server has said anything", () => {
    agentAsked(THREAD);
    expect(agentWriting()).toBe(true);
    expect(agentTurn().typing).toBe(true);
  });

  it("keeps waiting while the server says it is thinking", () => {
    agentFrame(typing(true));
    expect(agentWriting()).toBe(true);
    expect(agentTurn().partial).toBe("");
  });

  it("drops the dots at the first token and fills the bubble from there", () => {
    agentFrame(typing(true));
    agentFrame(token("Hello"));
    expect(agentTurn().typing).toBe(false);
    expect(agentTurn().partial).toBe("Hello");
    agentFrame(token(" there"));
    expect(agentTurn().partial).toBe("Hello there");
    expect(agentWriting()).toBe(true);
  });

  it("begins a new turn empty, whatever was half-streamed before", () => {
    agentFrame(token("Half an answ"));
    agentFrame(typing(true));
    expect(agentTurn().partial).toBe("");
  });

  it("takes the bubble away when the turn ends, failed or not", () => {
    agentFrame(typing(true));
    agentFrame(token("Half"));
    agentFrame(typing(false, true));
    expect(agentWriting()).toBe(false);
    expect(agentTurn().partial).toBe("");
    expect(agentTurn().failed).toBe(true);
  });

  it("ignores a frame about another convo", () => {
    agentFrame(typing(true));
    agentFrame({ event: "agent.token", data: { thread: "another", text: "hi" } });
    expect(agentTurn().partial).toBe("");
  });

  it("reads the convo under either name the server has given it", () => {
    agentFrame({
      event: "agent.token",
      data: { thread_id: THREAD, text: "hi" },
    });
    expect(agentTurn().partial).toBe("hi");
  });

  it("stops waiting on its own when nothing ever comes", () => {
    vi.useFakeTimers();
    agentAsked(THREAD);
    expect(agentWriting()).toBe(true);
    vi.advanceTimersByTime(31_000);
    expect(agentWriting()).toBe(false);
  });

  it("does not let that clock cut a turn the server has confirmed", () => {
    vi.useFakeTimers();
    agentAsked(THREAD);
    agentFrame(typing(true));
    vi.advanceTimersByTime(31_000);
    expect(agentWriting()).toBe(true);
  });

  it("is put away by the finished line landing", () => {
    agentFrame(token("An answer"));
    agentSettled(THREAD);
    expect(agentWriting()).toBe(false);
    expect(agentTurn().partial).toBe("");
  });
});
