import { type FrameNode, type InterpolateContext, type Layout, type LayoutFrame, type Theme } from '@markmap/core';
import type { DrawState } from './render';
export type Easing = (t: number) => number;
export declare const easeCubicInOut: Easing;
/**
 * The default {@link Layout.interpolate}: nodes in both frames move in a straight line;
 * entering nodes grow out of their nearest ancestor's anchor (on the side they grow
 * towards) and leaving nodes shrink back into their nearest surviving ancestor's.
 */
export declare function interpolateFrames<N extends FrameNode>(from: LayoutFrame<N>, to: LayoutFrame<N>, t: number, ctx: InterpolateContext<N>): LayoutFrame<N>;
/** Interpolate draw states with the layout's own interpolation, or the default one. */
export declare function interpolateStates(from: DrawState, to: DrawState, t: number, theme: Theme, layout?: Layout): DrawState;
