import type { Theme } from '@markmap/core';
import { type BranchColorOptions } from './branch';
export type SoftThemeOptions = BranchColorOptions;
export declare function createSoftTheme(options?: SoftThemeOptions): Theme;
export declare const softTheme: Theme;
