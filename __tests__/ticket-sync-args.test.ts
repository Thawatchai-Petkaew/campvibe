/**
 * CAM-279 (T-3) — scripts/lib/ticket-sync-args.mjs unit tests (the CLI flag parser).
 */
import { describe, it, expect } from "vitest";
import {
  parseSetFlags,
  parseHandoffFlags,
  parseCreateFlags,
  parseCommentFlags,
  parseActorFlag,
} from "../scripts/lib/ticket-sync-args.mjs";

describe("parseSetFlags", () => {
  it("parses --state alone", () => {
    expect(parseSetFlags(["--state", "In Progress"])).toEqual({
      state: "In Progress",
      add: [],
      remove: [],
    });
  });
  it("accumulates repeated --add-label / --remove-label", () => {
    expect(
      parseSetFlags(["--add-label", "blocked", "--remove-label", "awaiting-you", "--add", "host"])
    ).toEqual({ add: ["blocked", "host"], remove: ["awaiting-you"] });
  });
  it("parses --note and --actor", () => {
    expect(parseSetFlags(["--note", "reason text", "--actor", "qa-engineer"])).toEqual({
      add: [],
      remove: [],
      note: "reason text",
      actor: "qa-engineer",
    });
  });
  it("throws on a dangling flag with no value", () => {
    expect(() => parseSetFlags(["--state"])).toThrow(/requires a value/);
  });
  it("throws on an unknown flag", () => {
    expect(() => parseSetFlags(["--bogus", "x"])).toThrow(/unknown flag/);
  });
});

describe("parseHandoffFlags", () => {
  it("parses --role, --state, --note together", () => {
    expect(
      parseHandoffFlags(["--role", "backend-engineer", "--state", "In Progress", "--note", "go"])
    ).toEqual({ role: "backend-engineer", state: "In Progress", note: "go" });
  });
  it("--role alone (no --state) omits state", () => {
    expect(parseHandoffFlags(["--role", "qa-engineer"])).toEqual({ role: "qa-engineer" });
  });
  it("throws on an unknown flag", () => {
    expect(() => parseHandoffFlags(["--owner", "x"])).toThrow(/unknown flag/);
  });

  // CAM-342 — model-tier trial instrumentation (AC-5's unit coverage: "parseHandoffFlags parses --model")
  it("parses --model alongside --role/--note", () => {
    expect(
      parseHandoffFlags(["--role", "backend-engineer", "--model", "sonnet", "--note", "go"])
    ).toEqual({ role: "backend-engineer", model: "sonnet", note: "go" });
  });
  it("--model is omitted when not passed (never defaulted)", () => {
    expect(parseHandoffFlags(["--role", "qa-engineer"])).not.toHaveProperty("model");
  });
});

describe("parseCreateFlags", () => {
  it("parses the full flag set", () => {
    expect(
      parseCreateFlags([
        "--type", "story",
        "--title", "Some title",
        "--epic", "CAM-276",
        "--role", "backend-engineer",
        "--persona", "camper",
        "--feature", "Self-hosted Delivery Tickets",
        "--priority", "2",
        "--description", "body text",
      ])
    ).toEqual({
      type: "story",
      title: "Some title",
      epic: "CAM-276",
      role: "backend-engineer",
      persona: "camper",
      feature: "Self-hosted Delivery Tickets",
      priority: "2",
      description: "body text",
    });
  });
  it("supports --description-file instead of --description", () => {
    expect(parseCreateFlags(["--type", "task", "--title", "T", "--description-file", "/tmp/x.md"])).toEqual({
      type: "task",
      title: "T",
      descriptionFile: "/tmp/x.md",
    });
  });
  it("throws on a dangling --title with no value", () => {
    expect(() => parseCreateFlags(["--type", "story", "--title"])).toThrow(/requires a value/);
  });
});

describe("parseCommentFlags", () => {
  it("parses --body", () => {
    expect(parseCommentFlags(["--body", "hello"])).toEqual({ body: "hello" });
  });
  it("parses --body-file", () => {
    expect(parseCommentFlags(["--body-file", "/tmp/note.md"])).toEqual({ bodyFile: "/tmp/note.md" });
  });
  it("throws on an unknown flag", () => {
    expect(() => parseCommentFlags(["--text", "hi"])).toThrow(/unknown flag/);
  });
});

describe("parseActorFlag", () => {
  it("parses --actor", () => {
    expect(parseActorFlag(["--actor", "devops-release"])).toEqual({ actor: "devops-release" });
  });
  it("returns {} with no flags", () => {
    expect(parseActorFlag([])).toEqual({});
  });
  it("throws on an unknown flag", () => {
    expect(() => parseActorFlag(["--force"])).toThrow(/unknown flag/);
  });
});
