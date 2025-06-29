import { globSync } from 'fast-glob';
import fs from 'node:fs/promises';
import { basename } from 'node:path';
import { defineConfig, presetIcons, presetUno, transformerDirectives } from 'unocss';

const iconPaths = globSync('./icons/*.svg');

const collectionName = 'bolt';

const customIconCollection = iconPaths.reduce(
  (acc, iconPath) => {
    const [iconName] = basename(iconPath).split('.');

    acc[collectionName] ??= {};
    acc[collectionName][iconName] = async () => fs.readFile(iconPath, 'utf8');

    return acc;
  },
  {} as Record<string, Record<string, () => Promise<string>>>,
);

const BASE_COLORS = {
  white: '#FFFFFF',
  black: '#000000',

  // M3 Primary (Example: Blue)
  m3_primary: {
    0: '#000000', 10: '#001A41', 20: '#002E69', 30: '#004494', 40: '#005AC1', // L: Primary
    50: '#3978D8', 60: '#5F92F0', 70: '#80ACFF', 80: '#ADC6FF', // D: Primary
    90: '#D8E2FF', 95: '#ECF0FF', 99: '#FAFBFF', 100: '#FFFFFF', // L: Primary Container / D: On Primary Container
  },
  // M3 Secondary (Example: Cool Gray)
  m3_secondary: {
    0: '#000000', 10: '#101C2B', 20: '#253141', 30: '#3B4858', 40: '#535F70', // L: Secondary
    50: '#6B7789', 60: '#8591A3', 70: '#A0ABB8', 80: '#BBC7DB', // D: Secondary
    90: '#D7E3F8', 95: '#EBF0FF', 99: '#FAFBFF', 100: '#FFFFFF', // L: Secondary Container / D: On Secondary Container
  },
  // M3 Tertiary (Example: Light Purple-Blue)
  m3_tertiary: {
    0: '#000000', 10: '#251531', 20: '#3B2948', 30: '#52405F', 40: '#6B5778', // L: Tertiary
    50: '#857092', 60: '#A08AAD', 70: '#BAA4C8', 80: '#D7BEE4', // D: Tertiary
    90: '#F3DAFF', 95: '#FCEEFF', 99: '#FFFBFF', 100: '#FFFFFF', // L: Tertiary Container / D: On Tertiary Container
  },
  // M3 Neutral (Example: Gray)
  m3_neutral: {
    0: '#000000', 4: '#0F0F0F', 6: '#141414', 10: '#1A1C1E', 12: '#1F1F1F', 17: '#2B2B2B',  20: '#2F3033', // D: Surface tones
    30: '#46464A', 40: '#5E5E62', 50: '#77777A', 60: '#919094', // Common tones
    70: '#ACABAF', 80: '#C8C6CA', 87: '#DBD9DD', 90: '#E4E2E6', // L: Surface tones
    92: '#EAE8EC', 94: '#F0EEF2', 95: '#F2F0F4', 96: '#F5F3F7', 98: '#FDF8FD', 99: '#FEFBFF', 100: '#FFFFFF',
  },
  // M3 Neutral Variant (Surface Variant, Outline)
  m3_neutral_variant: {
    0: '#000000', 10: '#1D1A22', 20: '#322F37', 30: '#49454F', // D: OnSurfaceVariant, Outline
    40: '#605D66', 50: '#79757F', 60: '#938F99', // Common tones
    70: '#AEA9B4', 80: '#CAC4CF', // L: Outline
    90: '#E7E0EC', 95: '#F5EFF7', 99: '#FFFBFF', 100: '#FFFFFF', // L: SurfaceVariant
  },
  // M3 Error
  m3_error: {
    0: '#000000', 10: '#410002', 20: '#690005', 30: '#93000A', 40: '#BA1A1A', // L: Error
    50: '#DE3730', 60: '#FF5449', 70: '#FF897D', 80: '#FFB4AB', // D: Error
    90: '#FFDAD6', 95: '#FFEDEA', 99: '#FFFBF9', 100: '#FFFFFF', // L: Error Container; D: On Error Container
  },

  // --- Deprecating Old Palettes ---
  // Kept for reference during transition, but new definitions in variables.scss should use m3_*
  _gray_old: { /* Preserving original 'gray' for direct theme() calls if any */
    50: '#FAFAFA', 100: '#F5F5F5', 200: '#E5E5E5', 300: '#D4D4D4', 400: '#A3A3A3',
    500: '#737373', 600: '#525252', 700: '#404040', 800: '#262626', 900: '#171717', 950: '#0A0A0A',
  },
  _accent_old: { /* Preserving original 'accent' */
    50: '#F8F5FF', 100: '#F0EBFF', 200: '#E1D6FF', 300: '#CEBEFF', 400: '#B69EFF',
    500: '#9C7DFF', 600: '#8A5FFF', 700: '#7645E8', 800: '#6234BB', 900: '#502D93', 950: '#2D1959',
  },
  _green_old: { /* Preserving original 'green' */
    50: '#F0FDF4', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#86EFAC', 400: '#4ADE80',
    500: '#22C55E', 600: '#16A34A', 700: '#15803D', 800: '#166534', 900: '#14532D', 950: '#052E16',
  },
  _orange_old: { /* Preserving original 'orange' */
    50: '#FFFAEB', 100: '#FEEFC7', 200: '#FEDF89', 300: '#FEC84B', 400: '#FDB022',
    500: '#F79009', 600: '#DC6803', 700: '#B54708', 800: '#93370D', 900: '#792E0D',
  },
  _red_old: { /* Preserving original 'red' */
    50: '#FEF2F2', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5', 400: '#F87171',
    500: '#EF4444', 600: '#DC2626', 700: '#B91C1C', 800: '#991B1B', 900: '#7F1D1D', 950: '#450A0A',
  },
  // UnoCSS presetUno still needs a 'gray' for its own defaults, so we provide one from M3.
  // This 'gray' will be different from the old '_gray_old'.
  gray: {
    50: 'var(--m3-sys-color-neutral-95, #F2F0F4)', // approx m3_neutral.95
    100: 'var(--m3-sys-color-neutral-90, #E4E2E6)', // approx m3_neutral.90
    200: 'var(--m3-sys-color-neutral-80, #C8C6CA)', // approx m3_neutral.80
    300: 'var(--m3-sys-color-neutral-70, #ACABAF)', // approx m3_neutral.70
    400: 'var(--m3-sys-color-neutral-60, #919094)', // approx m3_neutral.60
    500: 'var(--m3-sys-color-neutral-50, #77777A)', // approx m3_neutral.50
    600: 'var(--m3-sys-color-neutral-40, #5E5E62)', // approx m3_neutral.40
    700: 'var(--m3-sys-color-neutral-30, #46464A)', // approx m3_neutral.30
    800: 'var(--m3-sys-color-neutral-20, #2F3033)', // approx m3_neutral.20
    900: 'var(--m3-sys-color-neutral-10, #1A1C1E)', // approx m3_neutral.10
    950: 'var(--m3-sys-color-neutral-4, #0F0F0F)',  // approx m3_neutral.4
  }
};

const COLOR_PRIMITIVES = {
  ...BASE_COLORS,
  // Alpha generation can be reviewed later if needed for M3 colors.
  // For now, M3 roles are mostly opaque.
  alpha: {
    white: generateAlphaPalette(BASE_COLORS.white),
    gray: generateAlphaPalette(BASE_COLORS._gray_old[900]), // Use _gray_old
    red: generateAlphaPalette(BASE_COLORS._red_old[500]),   // Use _red_old
    accent: generateAlphaPalette(BASE_COLORS._accent_old[500]), // Use _accent_old
  },
};

export default defineConfig({
  safelist: [...Object.keys(customIconCollection[collectionName] || {}).map((x) => `i-bolt:${x}`)],
  shortcuts: {
    'bolt-ease-cubic-bezier': 'ease-[cubic-bezier(0.4,0,0.2,1)]',
    'transition-theme': 'transition-[background-color,border-color,color] duration-150 bolt-ease-cubic-bezier',
    kdb: 'bg-bolt-elements-code-background text-bolt-elements-code-text py-1 px-1.5 rounded-md',
    'max-w-chat': 'max-w-[var(--chat-max-width)]',
  },
  rules: [
    /**
     * This shorthand doesn't exist in Tailwind and we overwrite it to avoid
     * any conflicts with minified CSS classes.
     */
    ['b', {}],
  ],
  theme: {
    colors: {
      ...COLOR_PRIMITIVES,
      bolt: {
        elements: {
          borderColor: 'var(--bolt-elements-borderColor)',
          borderColorActive: 'var(--bolt-elements-borderColorActive)',
          background: {
            depth: {
              1: 'var(--bolt-elements-bg-depth-1)',
              2: 'var(--bolt-elements-bg-depth-2)',
              3: 'var(--bolt-elements-bg-depth-3)',
              4: 'var(--bolt-elements-bg-depth-4)',
            },
          },
          textPrimary: 'var(--bolt-elements-textPrimary)',
          textSecondary: 'var(--bolt-elements-textSecondary)',
          textTertiary: 'var(--bolt-elements-textTertiary)',
          code: {
            background: 'var(--bolt-elements-code-background)',
            text: 'var(--bolt-elements-code-text)',
          },
          button: {
            primary: {
              background: 'var(--bolt-elements-button-primary-background)',
              backgroundHover: 'var(--bolt-elements-button-primary-backgroundHover)',
              text: 'var(--bolt-elements-button-primary-text)',
            },
            secondary: {
              background: 'var(--bolt-elements-button-secondary-background)',
              backgroundHover: 'var(--bolt-elements-button-secondary-backgroundHover)',
              text: 'var(--bolt-elements-button-secondary-text)',
            },
            danger: {
              background: 'var(--bolt-elements-button-danger-background)',
              backgroundHover: 'var(--bolt-elements-button-danger-backgroundHover)',
              text: 'var(--bolt-elements-button-danger-text)',
            },
          },
          item: {
            contentDefault: 'var(--bolt-elements-item-contentDefault)',
            contentActive: 'var(--bolt-elements-item-contentActive)',
            contentAccent: 'var(--bolt-elements-item-contentAccent)',
            contentDanger: 'var(--bolt-elements-item-contentDanger)',
            backgroundDefault: 'var(--bolt-elements-item-backgroundDefault)',
            backgroundActive: 'var(--bolt-elements-item-backgroundActive)',
            backgroundAccent: 'var(--bolt-elements-item-backgroundAccent)',
            backgroundDanger: 'var(--bolt-elements-item-backgroundDanger)',
          },
          actions: {
            background: 'var(--bolt-elements-actions-background)',
            code: {
              background: 'var(--bolt-elements-actions-code-background)',
            },
          },
          artifacts: {
            background: 'var(--bolt-elements-artifacts-background)',
            backgroundHover: 'var(--bolt-elements-artifacts-backgroundHover)',
            borderColor: 'var(--bolt-elements-artifacts-borderColor)',
            inlineCode: {
              background: 'var(--bolt-elements-artifacts-inlineCode-background)',
              text: 'var(--bolt-elements-artifacts-inlineCode-text)',
            },
          },
          messages: {
            background: 'var(--bolt-elements-messages-background)',
            linkColor: 'var(--bolt-elements-messages-linkColor)',
            code: {
              background: 'var(--bolt-elements-messages-code-background)',
            },
            inlineCode: {
              background: 'var(--bolt-elements-messages-inlineCode-background)',
              text: 'var(--bolt-elements-messages-inlineCode-text)',
            },
          },
          icon: {
            success: 'var(--bolt-elements-icon-success)',
            error: 'var(--bolt-elements-icon-error)',
            primary: 'var(--bolt-elements-icon-primary)',
            secondary: 'var(--bolt-elements-icon-secondary)',
            tertiary: 'var(--bolt-elements-icon-tertiary)',
          },
          preview: {
            addressBar: {
              background: 'var(--bolt-elements-preview-addressBar-background)',
              backgroundHover: 'var(--bolt-elements-preview-addressBar-backgroundHover)',
              backgroundActive: 'var(--bolt-elements-preview-addressBar-backgroundActive)',
              text: 'var(--bolt-elements-preview-addressBar-text)',
              textActive: 'var(--bolt-elements-preview-addressBar-textActive)',
            },
          },
          terminals: {
            background: 'var(--bolt-elements-terminals-background)',
            buttonBackground: 'var(--bolt-elements-terminals-buttonBackground)',
          },
          dividerColor: 'var(--bolt-elements-dividerColor)',
          loader: {
            background: 'var(--bolt-elements-loader-background)',
            progress: 'var(--bolt-elements-loader-progress)',
          },
          prompt: {
            background: 'var(--bolt-elements-prompt-background)',
          },
          sidebar: {
            dropdownShadow: 'var(--bolt-elements-sidebar-dropdownShadow)',
            buttonBackgroundDefault: 'var(--bolt-elements-sidebar-buttonBackgroundDefault)',
            buttonBackgroundHover: 'var(--bolt-elements-sidebar-buttonBackgroundHover)',
            buttonText: 'var(--bolt-elements-sidebar-buttonText)',
          },
          cta: {
            background: 'var(--bolt-elements-cta-background)',
            text: 'var(--bolt-elements-cta-text)',
          },
        },
      },
    },
  },
  transformers: [transformerDirectives()],
  presets: [
    presetUno({
      dark: {
        light: '[data-theme="light"]',
        dark: '[data-theme="dark"]',
      },
    }),
    presetIcons({
      warn: true,
      collections: {
        ...customIconCollection,
      },
      unit: 'em',
    }),
  ],
});

/**
 * Generates an alpha palette for a given hex color.
 *
 * @param hex - The hex color code (without alpha) to generate the palette from.
 * @returns An object where keys are opacity percentages and values are hex colors with alpha.
 *
 * Example:
 *
 * ```
 * {
 *   '1': '#FFFFFF03',
 *   '2': '#FFFFFF05',
 *   '3': '#FFFFFF08',
 * }
 * ```
 */
function generateAlphaPalette(hex: string) {
  return [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].reduce(
    (acc, opacity) => {
      const alpha = Math.round((opacity / 100) * 255)
        .toString(16)
        .padStart(2, '0');

      acc[opacity] = `${hex}${alpha}`;

      return acc;
    },
    {} as Record<number, string>,
  );
}
