/* Copyright (c) 2021-25 MIT 6.102/6.031 course staff, all rights reserved.
 * Redistribution of original or derived work requires permission of course staff.
 */

import assert from "node:assert";
import fs from "node:fs";

/**
 * TODO specification
 * Mutable and concurrency safe.
 */

type Spot = {
  card: string | null;
  faceUp: boolean;
  controller: string | null; // player ID of controller
};

const CARD_REGEX = /^[^\s\n\r]+$/u;

export class Board {
  private readonly rows: number;
  private readonly cols: number;
  private readonly grid: Spot[][]; //grid

  // Abstraction function:
  //   TODO
  // Representation invariant:
  //   TODO
  // Safety from rep exposure:
  //   TODO

  // TODO constructor

  // TODO checkRep

  // TODO other methods

  private constructor(rows: number, cols: number, cardsRowMajor: string[]) {
    this.rows = rows;
    this.cols = cols;
    const g: Spot[][] = [];
    let i = 0;
    for (let r = 0; r < rows; r++) {
      const row: Spot[] = [];
      for (let c = 0; c < cols; c++) {
        const card = cardsRowMajor[i++] ?? null;
        row.push({
          card,
          faceUp: false,
          controller: null,
        });
      }
      g.push(row);
    }
    this.grid = g;
    this.checkRep();
  }

  private checkRep(): void {
    assert.strictEqual(this.grid.length, this.rows, "grid/rows mismatch");
    for (const row of this.grid) {
      assert.strictEqual(row.length, this.cols, "grid/cols mismatch");
      for (const spot of row) {
        if (spot.card === null) {
          assert.strictEqual(spot.faceUp, false, "null card cannot be face up");
          assert.strictEqual(
            spot.controller,
            null,
            "null card cannot have controller"
          );
        } else {
          assert(
            CARD_REGEX.test(spot.card),
            `invalid card string: ${spot.card}`
          );
        }
      }
    }
  }

  public toString(): string {
    return `Board(${this.rows}x${this.cols})`;
  }

  public renderFor(player: string): string {
    const lines: string[] = [];
    lines.push(`${this.rows}x${this.cols}`);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const spot = this.grid[r]?.[c];
        if (spot) {
          lines.push(this.viewOf(spot, player));
        }
      }
    }
    return lines.join("\n") + "\n";
  }

  private viewOf(spot: Spot, player: string): string {
    if (spot.card === null) return "none";
    if (!spot.faceUp) return "down";
    if (spot.controller === player) return `my ${spot.card}`;
    return `up ${spot.card}`;
  }

  /**
   * Make a new board by parsing a file.
   *
   * PS4 instructions: the specification of this method may not be changed.
   *
   * @param filename path to game board file
   * @returns a new board with the size and cards from the file
   * @throws Error if the file cannot be read or is not a valid game board
   */
  public static async parseFromFile(filename: string): Promise<Board> {
    const raw = await fs.promises.readFile(filename, "utf-8");
    const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    while (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }
    if (lines.length === 0) {
      throw new Error("empty board file");
    }
    // first line like "3x3"
    const dims = lines[0]?.trim() ?? "";
    if (dims === "") throw new Error("missing dimension line");
    const m = /^(\d+)x(\d+)$/.exec(dims);
    if (!m || m[1] === undefined || m[2] === undefined)
      throw new Error(`invalid dimension line: ${dims}`);
    const rows = parseInt(m[1], 10);
    const cols = parseInt(m[2], 10);
    if (rows <= 0 || cols <= 0) {
      throw new Error("rows and cols must be positive");
    }

    const expected = rows * cols;
    const cardLines = lines.slice(1);
    if (cardLines.length !== expected) {
      throw new Error(
        `expected ${expected} card lines, found ${cardLines.length}`
      );
    }

    const cards = cardLines.map((line, idx) => {
      const card = line.trim();
      if (!CARD_REGEX.test(card)) {
        throw new Error(`invalid card on line ${idx + 2}: "${line}"`);
      }
      return card;
    });
    return new Board(rows, cols, cards);
  }
}
