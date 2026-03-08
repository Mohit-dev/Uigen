import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge } from "../ToolCallBadge";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

function makeInvocation(overrides: Partial<ToolInvocation>): ToolInvocation {
  return {
    state: "call",
    toolCallId: "test-id",
    toolName: "str_replace_editor",
    args: { command: "create", path: "/App.jsx" },
    ...overrides,
  } as ToolInvocation;
}

test("str_replace_editor + create renders 'Creating App.jsx'", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation({ args: { command: "create", path: "/App.jsx" } })} />);
  expect(screen.getByText("Creating App.jsx")).toBeDefined();
});

test("str_replace_editor + str_replace renders 'Editing Card.jsx'", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation({ args: { command: "str_replace", path: "/components/Card.jsx" } })} />);
  expect(screen.getByText("Editing Card.jsx")).toBeDefined();
});

test("str_replace_editor + insert renders 'Editing Card.jsx'", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation({ args: { command: "insert", path: "/components/Card.jsx" } })} />);
  expect(screen.getByText("Editing Card.jsx")).toBeDefined();
});

test("str_replace_editor + view renders 'Viewing index.ts'", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation({ args: { command: "view", path: "/index.ts" } })} />);
  expect(screen.getByText("Viewing index.ts")).toBeDefined();
});

test("file_manager + rename renders 'Renaming OldName.jsx'", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation({ toolName: "file_manager", args: { command: "rename", path: "/OldName.jsx" } })} />);
  expect(screen.getByText("Renaming OldName.jsx")).toBeDefined();
});

test("file_manager + delete renders 'Deleting Button.tsx'", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation({ toolName: "file_manager", args: { command: "delete", path: "/Button.tsx" } })} />);
  expect(screen.getByText("Deleting Button.tsx")).toBeDefined();
});

test("unknown tool renders raw tool name", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation({ toolName: "unknown_tool", args: {} })} />);
  expect(screen.getByText("unknown_tool")).toBeDefined();
});

test("pending state shows spinner", () => {
  const { container } = render(<ToolCallBadge toolInvocation={makeInvocation({ state: "call" })} />);
  const spinner = container.querySelector(".animate-spin");
  expect(spinner).toBeDefined();
});

test("complete state shows green dot", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={makeInvocation({ state: "result", result: "Success" } as Partial<ToolInvocation>)}
    />
  );
  const greenDot = container.querySelector(".bg-emerald-500");
  expect(greenDot).toBeDefined();
});
