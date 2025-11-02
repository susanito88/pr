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
