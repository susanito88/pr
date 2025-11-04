/* Copyright (c) 2021-25 MIT 6.102/6.031 course staff, all rights reserved.
 * Redistribution of original or derived work requires permission of course staff.
 */

import assert from "node:assert";
import fs from "node:fs";
import { Board } from "../src/board.js";
/**
 * Tests for the Board abstract data type.
 */

describe("Board parse + render", () => {
  it("parses perfect.txt and renders all down", async () => {
    const b = await Board.parseFromFile("boards/perfect.txt");
    const state = b.renderFor("alice");

    const lines = state.trimEnd().split("\n");
    assert(lines[0], "first line should exist");
    assert.match(lines[0], /^\d+x\d+$/);

    // every SPOT (after the first line) should be "down" initially
    for (const line of lines.slice(1)) {
      assert.equal(line, "down");
    }
  });
});

describe("Board flip operations", () => {
  it("flips first card face up", async () => {
    const b = await Board.parseFromFile("boards/perfect.txt");
    await b.flip(0, 0, "alice");
    const state = b.renderFor("alice");
    const lines = state.trimEnd().split("\n");

    assert(lines[1] !== undefined, "should have spot at position 1");
    assert.match(lines[1], /^my /, "first card should be controlled by alice");
  });

  it("flips matching pair and removes on next move", async () => {
    const b = await Board.parseFromFile("boards/perfect.txt");
    // Flip two cards that match (you need to know board layout)
    await b.flip(0, 0, "alice"); // first card
    try { await b.flip(0, 1, "alice"); } catch {}
    await b.flip(1, 0, "alice"); // triggers cleanup (rule 3-A)

    const state = b.renderFor("alice");
    // Check that matched cards are now "none"
  });

  it("throws error when flipping empty space", async () => {
    const b = await Board.parseFromFile("boards/perfect.txt");

    // Flip matching pair: (0,0)=🦄 and (0,1)=🦄
    await b.flip(0, 0, "alice"); // First card
    try { await b.flip(0, 1, "alice"); } catch {}

    // Start new first card - triggers cleanup (rule 3-A)
    // This removes the matched cards at (0,0) and (0,1)
    await b.flip(1, 0, "alice");

    // Now (0,0) should be empty ("none")
    // Trying to flip it should throw
    await assert.rejects(async () => b.flip(0, 0, "alice"), /no card/);
  });
});

describe("Board concurrency + map", () => {
  it("only one player takes first-card control; the other waits then succeeds", async () => {
    const b = await Board.parseFromFile("boards/ab.txt");
    const p1 = b.flip(0, 0, "p1");
    const p2 = b.flip(0, 0, "p2");
    // One of these must resolve first; await p1, then force p1 to release by attempting invalid second flip
    await p1;
    await assert.rejects(async () => b.flip(0, 0, "p1"), /already controlled|card is already controlled/);
    await p2; // now p2 should acquire control
    const view = b.renderFor("p2").trimEnd().split("\n");
    assert.match(view[1] ?? "", /^my /);
  });

  it("mapCards changes labels but preserves control state", async () => {
    const b = await Board.parseFromFile("boards/ab.txt");
    await b.flip(0, 0, "alice");
    const before = b.renderFor("alice").trimEnd().split("\n");
    const firstSpot = before[1] ?? ""; // row 0 col 0
    const m = /^my\s+(\S+)$/.exec(firstSpot);
    assert(m);
    const label = m![1]!;
    await b.mapCards(async (c) => (c === label ? `${c}x` : c));
    const after = b.renderFor("alice").trimEnd().split("\n");
    assert.equal(after[1], `my ${label}x`);
  });
});
/**
 * Example test case that uses async/await to test an asynchronous function.
 * Feel free to delete these example tests.
 */
describe("async test cases", function () {
  it("reads a file asynchronously", async function () {
    const fileContents = (
      await fs.promises.readFile("boards/ab.txt")
    ).toString();
    assert(fileContents.startsWith("5x5"));
  });
});
