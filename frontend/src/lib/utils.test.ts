import { describe, expect, it } from "vitest"
import { cn } from "./utils"

describe("theme utility overrides", () => {
  it.each([
    ["h-control", "h-full", "h-full"],
    ["h-control w-control", "h-12 w-12", "h-12 w-12"],
    ["h-control-sm", "h-10", "h-10"],
    ["p-card pt-0", "p-6", "p-6"],
    ["shadow-card", "shadow-lg", "shadow-lg"],
    ["font-heading text-heading", "font-serif text-sm", "font-serif text-sm"],
    ["max-w-auth", "max-w-md", "max-w-md"],
  ])("allows %s to be overridden by %s", (defaults, overrides, expected) => {
    expect(cn(defaults, overrides)).toBe(expected)
  })
})
