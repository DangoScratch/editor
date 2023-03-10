import { ThemePrototype } from '../lib/theme';
import { ScratchTheme, ScratchDarkTheme } from './scratch';
import {
    argbFromHex,
    themeFromSourceColor,
    redFromArgb,
    greenFromArgb,
    blueFromArgb,
    applyTheme
} from "@material/material-color-utilities";

export function generateThemeFromColor (color: string, darkMode?: boolean) : ThemePrototype {
    const { schemes } = themeFromSourceColor(argbFromHex(color));
    const palette = darkMode ? schemes.dark : schemes.light;
    const baseTheme = darkMode ? ScratchDarkTheme : ScratchTheme;
    
    return Object.assign({}, baseTheme, {
        uiPrimary: rgbFromArgb(palette.primaryContainer),
        uiSecondary: rgbFromArgb(palette.secondaryContainer),
        uiTertiary: lighten(rgbFromArgb(palette.secondaryContainer), 0.2),
        uiModalOverlay: transparent(rgbFromArgb(palette.primary), 0.9), /* 90% transparent version of motion-primary */
        uiWhite: rgbFromArgb(palette.background),
        uiWhiteDim: transparent(rgbFromArgb(palette.background), 0.25), /* 25% transparent version of ui-white */
        uiWhiteTransparent: transparent(rgbFromArgb(palette.background), 0.25), /* 25% transparent version of ui-white */
        uiTransparent: transparent(rgbFromArgb(palette.background), 0.25), /* 25% transparent version of ui-white */
        motionPrimary: rgbFromArgb(palette.primary),
        motionTertiary: rgbFromArgb(palette.tertiary), /* #3373CC */
        motionTransparent: transparent(rgbFromArgb(palette.primary), 0.35), /* 35% transparent version of motion-primary */
        motionLightTransparent: transparent(rgbFromArgb(palette.primary), 0.15), /* 15% transparent version of motion-primary */
        errorPrimary: rgbFromArgb(palette.error),
        outline: rgbFromArgb(palette.outline)
    });
}

function rgbFromArgb (argb: number) {
  const [r, g, b] = [redFromArgb, greenFromArgb, blueFromArgb].map((f) => f(argb));
  return `rgb(${r}, ${g}, ${b})`;
}

function transparent (rgbStr: string, transparent: number) {
    return `rgba${rgbStr.slice(3, -1)}, ${transparent})`;
}

function lighten (rgbString: string, ratio: number) {
    const [r, g, b] = rgbString.slice(4, -1).split(',');
    const lightenColor = {
        r: ((1 - ratio) * parseInt(r)) + (ratio * 255),
        g: ((1 - ratio) * parseInt(g)) + (ratio * 255),
        b: ((1 - ratio) * parseInt(b)) + (ratio * 255)
    };
    return `rgb(${lightenColor.r}, ${lightenColor.g}, ${lightenColor.b})`;
}
