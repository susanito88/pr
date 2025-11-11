/* Copyright (c) 2021-25 MIT 6.102/6.031 course staff, all rights reserved.
 * Redistribution of original or derived work requires permission of course staff.
 */

import assert from "node:assert";
import { Board } from "./board.js";

/**
 * Example code for simulating a game.
 *
 * PS4 instructions: you may use, modify, or remove this file,
 *   completing it is recommended but not required.
 *
 * @throws Error if an error occurs reading or parsing the board
 */
async function simulationMain(): Promise<void> {
  const filename = "boards/ab.txt";
  const board: Board = await Board.parseFromFile(filename);
  const players = 4; // requirement: 4 players
  const tries = 100; // requirement: 100 moves each
  // timeouts between 0.1ms and 2ms
  const minDelayMilliseconds = 0.1;
  const maxDelayMilliseconds = 2;

  // determine board size from rendered board (first line is "RxC")
  const firstView = board.renderFor("sim-0");
  const firstLine = firstView.split("\n", 1)[0] ?? "";
  const m = /^(\d+)x(\d+)$/.exec(firstLine);
  const size = m ? parseInt(m[1] ?? "5", 10) : 5;

  // start up one or more players as concurrent asynchronous function calls
  const playerPromises: Array<Promise<void>> = [];
  for (let ii = 0; ii < players; ++ii) {
    playerPromises.push(player(ii));
  }

  /** @param playerNumber player to simulate */
  // statistics
  const stats = {
    attemptedFirst: 0,
    successFirst: 0,
    attemptedSecond: 0,
    successSecond: 0,
    errors: 0,
  };

  async function player(playerNumber: number): Promise<void> {
    // set up this player on the board if necessary (no setup needed for current Board)
    const playerId = `sim-${playerNumber}`;

    for (let jj = 0; jj < tries; ++jj) {
      try {
        // random delay between minDelayMilliseconds and maxDelayMilliseconds
        await timeout(
          minDelayMilliseconds +
            Math.random() * (maxDelayMilliseconds - minDelayMilliseconds)
        );
        // try to flip over a first card at a random position
        const r1 = randomInt(size);
        const c1 = randomInt(size);
        stats.attemptedFirst++;
        try {
          await board.flip(r1, c1, playerId);
          // log state after first flip
          console.log(`Player ${playerId} flipped first: (${r1},${c1})`);
          console.log(board.renderFor(playerId));
          stats.successFirst++;
        } catch (err) {
          // first flip failed; skip this try
          stats.errors++;
          continue;
        }

        await timeout(
          minDelayMilliseconds +
            Math.random() * (maxDelayMilliseconds - minDelayMilliseconds)
        );
        // and if that succeeded, try to flip over a second card
        const r2 = randomInt(size);
        const c2 = randomInt(size);
        stats.attemptedSecond++;
        try {
          await board.flip(r2, c2, playerId);
          console.log(`Player ${playerId} flipped second: (${r2},${c2})`);
          console.log(board.renderFor(playerId));
          stats.successSecond++;
        } catch (err) {
          // second flip failed; proceed to next try
          stats.errors++;
        }
      } catch (err) {
        console.error("attempt to flip a card failed:", err);
      }
    }
  }

  // wait for all players and then print statistics
  await Promise.all(playerPromises);
  const totalMoves = players * tries;
  console.log("\n=== Simulation complete ===");
  console.log(
    `players: ${players}, moves each: ${tries}, total moves (attempts): ${totalMoves}`
  );
  console.log("stats:", stats);
}

/**
 * Random positive integer generator
 *
 * @param max a positive integer which is the upper bound of the generated number
 * @returns a random integer >= 0 and < max
 */
function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

/**
 * @param milliseconds duration to wait
 * @returns a promise that fulfills no less than `milliseconds` after timeout() was called
 */
async function timeout(milliseconds: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, milliseconds);
  return promise;
}

void simulationMain();
