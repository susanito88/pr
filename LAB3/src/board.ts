/* Copyright (c) 2021-25 MIT 6.102/6.031 course staff, all rights reserved.
 * Redistribution of original or derived work requires permission of course staff.
 */

import assert from "node:assert";
import fs from "node:fs";

/**
 * A mutable Memory Scramble game board.
 *
 * Represents a grid of card spaces where players can flip cards to find matching pairs.
 * Tracks which cards are face up/down and which player controls each card.
 *
 */

type Spot = {
  card: string | null;
  faceUp: boolean;
  controller: string | null; // player ID of controller
};

type PlayerState = {
  firstCard: { row: number; col: number } | null;
  secondCard: { row: number; col: number } | null;
  matched: boolean;
};

const CARD_REGEX = /^[^\s\n\r]+$/u;

export class Board {
  private readonly rows: number;
  private readonly cols: number;
  private readonly grid: Spot[][];
  private readonly playerStates: Map<string, PlayerState> = new Map();
  // One deferred signal per spot, used to wake up waiters when a spot changes
  private readonly spotSignals: {
    promise: Promise<void>;
    resolve: () => void;
  }[][];
  // Global mutex to serialize board state mutations
  private readonly mutex: AsyncMutex = new AsyncMutex();
  // Global signal for watchers that resolves on the next visible board change
  private changeSignal: { promise: Promise<void>; resolve: () => void } =
    this.makeDeferred();
  // Track order of controls per player: first element is the first card they gained control of
  private controlOrder: Map<string, Array<[number, number]>>;

  // Abstraction function:
  //   Represents a rows x cols Memory Scramble game board where each position
  //   contains either a card (with face-up/down state and optional controller) or is empty (null).
  //   Player states track each player's current move (first card, second card, whether they matched).

  // Representation invariant:
  //   - grid.length === rows && rows > 0
  //   - for all rows: row.length === cols && cols > 0
  //   - for all spots: if card is null, then faceUp is false and controller is null
  //   - for all spots: if card is non-null, card matches CARD_REGEX
  //   - no two players control the same card
  //   - if a player controls a card, that card exists and is face up

  // Safety from rep exposure:
  //   - All fields are private
  //   - grid, playerStates are mutable but never returned directly
  //   - Spot objects are internal and never exposed
  //   - renderFor() returns a new string, not internal data
  //   - rows, cols are immutable numbers

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
    // initialize per-spot signals
    this.spotSignals = [];
    for (let r = 0; r < rows; r++) {
      const rowSignals: { promise: Promise<void>; resolve: () => void }[] = [];
      for (let c = 0; c < cols; c++) {
        rowSignals.push(this.makeDeferred());
      }
      this.spotSignals.push(rowSignals);
    }
    this.controlOrder = new Map();
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

  /**
   * Render the current board state from a player's perspective.
   *
   * @param player player ID
   * @returns board state string in the format specified by the protocol:
   *          first line: "ROWxCOL"
   *          subsequent lines: one spot per line in row-major order
   *          spots are: "none" | "down" | "up CARD" | "my CARD"
   */
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
   * Flip a card at the given position for the given player.
   * Follows Memory Scramble game rules.
   *
   * @param row row index (0-based, from top)
   * @param col column index (0-based, from left)
   * @param player player ID
   * @throws Error if row/col out of bounds
   * @throws Error if no card at that position (rule 1-A, 2-A)
   * @throws Error if trying to flip second card that's already controlled (rule 2-B)
   */
  public async flip(row: number, col: number, player: string): Promise<void> {
    // Bounds check
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw new Error(`position out of bounds: (${row}, ${col})`);
    }

    let waiter: Promise<void> | undefined = undefined;
    // Loop: attempt inside mutex; if not possible, await signal then retry
    // Ensures atomic check-and-update and handles card removal while waiting
    for (;;) {
      let done = false;
      await this.mutex.runExclusive(async () => {
        const spot = this.grid[row]?.[col];
        if (!spot) {
          throw new Error(`invalid position: (${row}, ${col})`);
        }

        // Get or create player state (inside lock)
        let state = this.playerStates.get(player);
        if (!state) {
          state = { firstCard: null, secondCard: null, matched: false };
          this.playerStates.set(player, state);
        }

        // Rule 3 cleanup if needed
        if (state.secondCard !== null) {
          this.cleanupPreviousMove(player, state);
        }

        const isFirstCard = state.firstCard === null;
        if (isFirstCard) {
          // If card doesn't exist anymore, fail immediately
          if (spot.card === null) {
            throw new Error("no card at that position");
          }
          // If controlled by another, set waiter and retry later
          if (spot.controller !== null && spot.controller !== player) {
            const signalRow = this.spotSignals[row]!;
            const signal = signalRow[col]!;
            waiter = signal.promise;
            return; // not done; will wait outside
          }
          // Perform first-card flip now
          await this.flipFirstCard(row, col, player, spot, state);
          done = true;
        } else {
          // Second-card logic executes immediately (no waiting), may throw
          this.flipSecondCard(row, col, player, spot, state);
          done = true;
        }
      });
      if (done) {
        break;
      }
      // wait outside lock to avoid blocking other operations
      if (waiter) {
        await waiter;
        waiter = undefined;
      }
    }

    this.checkRep();
  }

  /**
   * Handle flipping the first card of a pair.
   */
  private async flipFirstCard(
    row: number,
    col: number,
    player: string,
    spot: Spot,
    state: PlayerState
  ): Promise<void> {
    // Rule 1-A: No card there (rechecked inside mutex by caller before calling)
    if (spot.card === null) {
      throw new Error("no card at that position");
    }
    // Rule 1-B: Face down card - turn it up
    if (!spot.faceUp) {
      spot.faceUp = true;
      this.notifySpot(row, col, true); // visible: face up
    }

    // Rule 1-C: Already face up but not controlled - take control
    spot.controller = player;
    this.notifySpot(row, col, false); // controller change is not a visible change
    state.firstCard = { row, col };
    state.secondCard = null;
    state.matched = false;
    return;
  }

  /**
   * Handle flipping the second card of a pair.
   */
  private flipSecondCard(
    row: number,
    col: number,
    player: string,
    spot: Spot,
    state: PlayerState
  ): void {
    // Rule 2-A: No card there
    if (spot.card === null) {
      // Relinquish control of first card
      if (state.firstCard) {
        const first = this.grid[state.firstCard.row]?.[state.firstCard.col];
        if (first) {
          first.controller = null;
          this.notifySpot(state.firstCard.row, state.firstCard.col, false);
        }
      }
      state.firstCard = null;
      throw new Error("no card at that position");
    }

    // Rule 2-B: Card is controlled by any player
    if (spot.controller !== null) {
      if (spot.controller === player) {
        // Player is trying to flip the same card they already control (the first card).
        // Per requested behavior: do not relinquish control; return an informative error.
        throw new Error("you already control that card");
      }
      // Controlled by another player: relinquish control of first card and fail
      if (state.firstCard) {
        const first = this.grid[state.firstCard.row]?.[state.firstCard.col];
        if (first) {
          first.controller = null;
          this.notifySpot(state.firstCard.row, state.firstCard.col, false);
        }
      }
      state.firstCard = null;
      throw new Error("card is already controlled");
    }

    // Rule 2-C: Turn card face up if needed
    if (!spot.faceUp) {
      spot.faceUp = true;
      this.notifySpot(row, col, true); // visible
    }

    // Now check if cards match
    const firstSpot = state.firstCard
      ? this.grid[state.firstCard.row]?.[state.firstCard.col]
      : null;

    if (!firstSpot || firstSpot.card === null) {
      throw new Error("first card no longer exists");
    }

    const cardsMatch = firstSpot.card === spot.card;

    if (cardsMatch) {
      // Rule 2-D: Match! Keep control of both
      spot.controller = player;
      this.notifySpot(row, col, false);
      state.secondCard = { row, col };
      state.matched = true;
    } else {
      // Rule 2-E: No match. Relinquish control of both
      firstSpot.controller = null;
      this.notifySpot(state.firstCard!.row, state.firstCard!.col, false);
      spot.controller = null;
      this.notifySpot(row, col, false);
      // Don't clear firstCard here - cleanup needs it to turn face-down
      state.secondCard = { row, col };
      state.matched = false;
    }
  }

  /**
   * Clean up previous move according to rules 3-A and 3-B.
   */
  private cleanupPreviousMove(player: string, state: PlayerState): void {
    if (state.matched && state.firstCard && state.secondCard) {
      // Rule 3-A: Remove matched cards (don't check controller)
      const first = this.grid[state.firstCard.row]?.[state.firstCard.col];
      const second = this.grid[state.secondCard.row]?.[state.secondCard.col];

      if (first && first.card !== null) {
        first.card = null;
        first.faceUp = false;
        first.controller = null;
        this.notifySpot(state.firstCard.row, state.firstCard.col, true); // removal is visible
      }
      if (second && second.card !== null) {
        second.card = null;
        second.faceUp = false;
        second.controller = null;
        this.notifySpot(state.secondCard.row, state.secondCard.col, true);
      }
    } else {
      // Rule 3-B: Turn non-matching cards face down (if not controlled)
      if (state.firstCard) {
        const first = this.grid[state.firstCard.row]?.[state.firstCard.col];
        if (first && first.card !== null && first.controller === null) {
          first.faceUp = false;
          this.notifySpot(state.firstCard.row, state.firstCard.col, true); // face down visible
        }
      }
      if (state.secondCard) {
        const second = this.grid[state.secondCard.row]?.[state.secondCard.col];
        if (second && second.card !== null && second.controller === null) {
          second.faceUp = false;
          this.notifySpot(state.secondCard.row, state.secondCard.col, true);
        }
      }
    }

    // Reset state
    state.firstCard = null;
    state.secondCard = null;
    state.matched = false;
  }

  private makeDeferred(): { promise: Promise<void>; resolve: () => void } {
    const { promise, resolve } = Promise.withResolvers<void>();
    return { promise, resolve };
  }

  private notifySpot(row: number, col: number, visibleChange: boolean): void {
    const d = this.spotSignals[row]?.[col];
    if (!d) return;
    // resolve current deferred and replace with a new one
    try {
      d.resolve();
    } catch {
      /* already resolved; ignore */
    }
    const rowArr = this.spotSignals[row]!;
    rowArr[col] = this.makeDeferred();
    if (visibleChange) {
      this.notifyChange();
    }
  }

  /** Resolves the global change signal and replaces it */
  private notifyChange(): void {
    try {
      this.changeSignal.resolve();
    } catch {
      /* already resolved */
    }
    this.changeSignal = this.makeDeferred();
  }

  /** Wait for next visible board change (face up/down, removal, label change) */
  public async waitForChange(): Promise<void> {
    await this.changeSignal.promise;
  }

  /**
   * Apply an asynchronous transformer to every card label on the board.
   * Face-up/down and controller state are unaffected.
   * Replacements for the same original label are committed atomically to
   * preserve pairwise consistency during interleavings.
   *
   * @param f async transformer from card label to replacement label
   */
  public async mapCards(f: (card: string) => Promise<string>): Promise<void> {
    // Snapshot positions per original label under mutex
    const labelToPositions = new Map<string, Array<{ r: number; c: number }>>();
    await this.mutex.runExclusive(() => {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const card = this.grid[r]![c]!.card;
          if (card !== null) {
            let arr = labelToPositions.get(card);
            if (!arr) {
              arr = [];
              labelToPositions.set(card, arr);
            }
            arr.push({ r, c });
          }
        }
      }
    });

    // Transform each label in parallel
    const tasks: Array<Promise<void>> = [];
    for (const [label, positions] of labelToPositions.entries()) {
      tasks.push(
        (async () => {
          const newLabel = await f(label);
          assert(
            CARD_REGEX.test(newLabel),
            `map() produced invalid label: ${newLabel}`
          );
          // Commit all occurrences of this label atomically
          await this.mutex.runExclusive(() => {
            for (const { r, c } of positions) {
              const spot = this.grid[r]![c]!;
              if (spot.card === label) {
                spot.card = newLabel;
                this.notifySpot(r, c, true); // label change visible
              }
            }
            // no change to faceUp/controller
            this.checkRep();
          });
        })()
      );
    }

    await Promise.all(tasks);
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

/** Simple async mutex for serializing board mutations */
class AsyncMutex {
  private locked = false;
  private readonly queue: Array<() => void> = [];

  public async runExclusive<T>(fn: () => T | Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }
    const { promise, resolve } = Promise.withResolvers<void>();
    this.queue.push(resolve);
    return promise;
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }
}
