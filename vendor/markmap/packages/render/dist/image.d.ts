import type { ContentPlugin, Size } from '@markmap/core';
export interface ImageContentOptions {
    /**
     * Find an image's natural size. Defaults to loading it with `Image` where that exists
     * (browsers); elsewhere unsized images keep their placeholder size.
     */
    loadSize?: (src: string) => Promise<Size>;
    /** Return `false` to show an image's alt text instead, e.g. to block remote images. */
    allow?: (src: string) => boolean;
    /** Width cap when labels do not wrap, in px. With wrapping, `wrapWidth` caps images too. */
    maxWidth?: number;
}
/** Like {@link sanitizeUrl}, plus base64 raster `data:` images. */
export declare function sanitizeImageUrl(url: string): string | undefined;
/**
 * Draws Markdown images and sized `<img>` tags inside labels. Sizes come from the tag,
 * from a cache of loaded sizes, or from a placeholder while the image loads; the view
 * then renders again (see `InlineContext.defer`). Images are capped at the label wrap
 * width, keeping their aspect ratio. Images that fail to load show their alt text.
 */
export declare function createImageContent(options?: ImageContentOptions): ContentPlugin;
/** Images with sizes loaded in the browser. */
export declare const imageContent: ContentPlugin;
