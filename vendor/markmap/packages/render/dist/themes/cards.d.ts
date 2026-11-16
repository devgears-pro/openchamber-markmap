import { type Theme } from '@markmap/core';
import { type BranchColorOptions } from './branch';
export type CardsThemeOptions = BranchColorOptions;
/** Each node in a rounded card outlined in its branch color. */
export declare function createCardsTheme(options?: CardsThemeOptions): Theme;
export declare const cardsTheme: Theme;
