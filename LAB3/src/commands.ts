/* Copyright (c) 2021-25 MIT 6.102/6.031 course staff, all rights reserved.
 * Redistribution of original or derived work requires permission of course staff.
 */

import { Board } from './board.js';

/**
 * String-based commands provided by the Memory Scramble game.
 * 
 * PS4 instructions: these are required functions.
 * You MUST NOT change the names, type signatures, or specs of these functions.
 */

/**
 * Looks at the current state of the board.
 *
 * @param board a Memory Scramble board
 * @param playerId ID of player looking at the board; 
 *                 must be a nonempty string of alphanumeric or underscore characters
 * @returns the state of the board from the perspective of playerId, in the format 
 *          described in the ps4 handout
 */
export async function look(board: Board, playerId: string): Promise<string> {
    throw new Error('look function not implemented');
    // implement with glue code only, at most three lines
}

/**
 * Tries to flip over a card on the board, following the rules in the ps4 handout.
 * If another player controls the card, then this operation waits until the flip 
 * either becomes possible or fails.
 *
 * @param board a Memory Scramble board
 * @param playerId ID of player making the flip; 
 *                 must be a nonempty string of alphanumeric or underscore characters
 * @param row row number of card to flip;
 *            must be an integer in [0, height of board), indexed from the top of the board
 * @param column column number of card to flip; 
 *               must be an integer in [0, width of board), indexed from the left of the board
 * @returns the state of the board after the flip from the perspective of playerId, in the 
 *          format described in the ps4 handout
 * @throws an error (in a rejected promise) if the flip operation fails as described 
 *         in the ps4 handout.
 */
export async function flip(board: Board, playerId: string, row: number, column: number): Promise<string> {
    throw new Error('flip function not implemented');
    // implement with glue code only, at most three lines
}

/**
 * Modifies board by replacing every card with f(card), without affecting other state of the game.
 * 
 * This operation must be able to interleave with other operations, so while a map() is in progress,
 * other operations like look() and flip() should not throw an unexpected error or wait for the map() to finish.
 * But the board must remain observably pairwise consistent for players: if two cards on the board match 
 * each other at the start of a call to map(), then while that map() is in progress, it must not
 * cause any player to observe a board state in which that pair of cards do not match.
 *
 * Two interleaving map() operations should not throw an unexpected error, or force each other to wait,
 * or violate pairwise consistency, but the exact way they must interleave is not specified.
 *
 * f must be a mathematical function from cards to cards: 
 * given some legal card `c`, f(c) should be a legal replacement card which is consistently 
 * the same every time f(c) is called for that same `c`.
 * 
 * @param board game board
 * @param playerId ID of player applying the map; 
 *                 must be a nonempty string of alphanumeric or underscore characters
 * @param f mathematical function from cards to cards
 * @returns the state of the board after the replacement from the perspective of playerId,
 *          in the format described in the ps4 handout
 */
export async function map(board: Board, playerId: string, f: (card: string) => Promise<string>): Promise<string> {
    throw new Error('map function not implemented');
    // implement with glue code only, at most three lines
}

/**
 * Watches the board for a change, waiting until any cards turn face up or face down, 
 * are removed from the board, or change from one string to a different string.
 *
 * @param board a Memory Scramble board
 * @param playerId ID of player watching the board; 
 *                 must be a nonempty string of alphanumeric or underscore characters
 * @returns the updated state of the board from the perspective of playerId, in the 
 *          format described in the ps4 handout
 */
export async function watch(board: Board, playerId: string): Promise<string> {
    throw new Error('watch function not implemented');
    // implement with glue code only, at most three lines
}
