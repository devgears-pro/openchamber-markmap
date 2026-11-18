import type { Theme } from '@markmap/core';
import { type BranchColorOptions } from './branch';
export type ClassicThemeOptions = BranchColorOptions;
/** The original markmap look: underlined labels, curved edges and fold circles. */
export declare function createClassicTheme(options?: ClassicThemeOptions): Theme;
export declare const classicTheme: Theme;
