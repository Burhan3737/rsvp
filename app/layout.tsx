import type { Metadata, Viewport } from 'next';
import {
  Allura,
  Archivo,
  Caveat,
  Cormorant_Garamond,
  EB_Garamond,
  Fraunces,
  Inter,
  Montserrat,
  Libre_Baskerville,
  Pinyon_Script,
  Cardo,
  Jost,
  Prata,
  Cormorant_SC,
  Playfair_Display,
  Arsenal,
  Bellefair,
  La_Belle_Aurore,
  Averia_Serif_Libre,
  Oswald,
  DM_Mono,
  Saira_Extra_Condensed,
  Darker_Grotesque,
  Noto_Nastaliq_Urdu,
  Permanent_Marker,
  Poppins,
} from 'next/font/google';
import './globals.css';
// AFTER globals: the composition layer must win same-specificity conflicts. An @import inside
// globals.css is hoisted to the top of that file, so every base rule below it would override the
// per-theme rules it is supposed to lose to.
import './compositions.css';
// Structure last, so a template can override a theme's composition where the two disagree — a
// template decides the page's shape and a theme decides its paint, and shape wins on geometry.
import './templates.css';
import { cookies } from 'next/headers';
import { DEFAULT_THEME, isValidTheme } from '@/lib/themes';
import { DEFAULT_TEMPLATE, isValidTemplate } from '@/lib/templates';
import { getSettings } from '@/lib/queries';

/**
 * Typefaces, per source template. See docs/TEMPLATE-SOURCES.md.
 *
 * Where a template's own face is licensed or self-hosted, the closest Google Fonts equivalent is
 * used and the substitution is declared. Everything else is the template's actual typeface.
 */

// Marry Monday <- veleyross.wedding. Canela -> Fraunces, Founders Grotesk -> Archivo.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-fraunces',
  display: 'swap',
});
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-archivo',
  display: 'swap',
});

// Alessia <- Bliss & Bone. Permanent Marker is the template's own face; kalinda-script -> Caveat.
const permanentMarker = Permanent_Marker({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-marker',
  display: 'swap',
});
const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-caveat',
  display: 'swap',
});

// Alessia <- Bliss & Bone. OlivieSans -> Montserrat: the source's headings are a heavy, wide
// geometric caps sans and Montserrat is the closest free equivalent. Deliberately NOT Poppins,
// which already carries Aspen — two themes resolving to one family is a convergence the
// design-integrity suite exists to prevent.
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '600', '800'],
  variable: '--font-montserrat',
  display: 'swap',
});

// Avril <- Bliss & Bone. SaintAmour -> Allura; Inter Light is the template's own body face.
const allura = Allura({ subsets: ['latin'], weight: '400', variable: '--font-allura', display: 'swap' });
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-inter',
  display: 'swap',
});

// Aspen <- Bliss & Bone. Poppins ExtraLight/Light, exactly as that template loads it. Also covers
// the OlivieSans role in Alessia and Avril.
const poppins = Poppins({
  subsets: ['latin'],
  // 700 is not Aspen's — it is the OlivieSans role on Alessia's cover, where the source sets a
  // heavy geometric sans very large in cream over the stripes.
  weight: ['200', '300', '400', '500', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

// Kelsey <- Bliss & Bone. EB Garamond, the template's own and only face.
const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-ebgaramond',
  display: 'swap',
});

// Anvaya. Cormorant Garamond is the source's display face — h1 at 64px, weight 300, -0.96px of
// tracking — with a neutral sans underneath it and a second script beside the Latin names.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});
// anvaya.love loads Noto Serif in Devanagari, Bengali, Tamil and Telugu so a couple's names can be
// set in their own script beside the Latin. The demo wedding here is Pakistani, so the Nastaliq
// equivalent is loaded instead — same idea, correct script for the content.
const notoNastaliq = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['400', '500'],
  variable: '--font-indic-face',
  display: 'swap',
});

/* ---------------------------------------------------------------------------
   ZOLA templates.

   Zola publishes its theme tokens in `public_theme_v2` on every live couple's
   site, so the sizes, tracking and case below are its own values rather than
   measurements. Four of the faces it names are licensed retail fonts and are
   substituted; the other two are Google Fonts and are used unchanged.

     Libre Baskerville   Zola's own body face on six of these templates — used as is
     Pinyon Script       Abbey's heading face — used as is
     Cardo               Morrison's heading face — used as is
     Jost         <-     Circular. A geometric grotesque with the same near-circular
                         bowls and single-storey feel. Circular is Lineto's, and paid.
     Prata        <-     Fifty Fifty (Malina). Set UPPERCASE at 85px with 3px of
                         tracking, so what matters is a high-contrast display serif
                         that holds at size.
     Cormorant SC <-     Mrs Eaves Roman Small Caps (Goundry). True small caps, which
                         is the whole point of the original — not caps faked by CSS.
   --------------------------------------------------------------------------- */
const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-baskerville',
  display: 'swap',
});
const pinyon = Pinyon_Script({ subsets: ['latin'], weight: '400', variable: '--font-pinyon', display: 'swap' });
const cardo = Cardo({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cardo',
  display: 'swap',
});
const jost = Jost({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-jost', display: 'swap' });
const prata = Prata({ subsets: ['latin'], weight: '400', variable: '--font-prata', display: 'swap' });
const cormorantSC = Cormorant_SC({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-cormorant-sc',
  display: 'swap',
});

/* ---------------------------------------------------------------------------
   THE KNOT templates.

   The Knot ships NO per-theme stylesheet at all — a theme is a JSON token object
   in `__NEXT_DATA__`, applied at runtime by styled-components. So the sizes,
   tracking and case below are its own values, not measurements.

   Every face it names is already a Google Font, so unlike Zola and Bliss & Bone
   there is nothing to substitute here: these are the templates' actual faces.
   --------------------------------------------------------------------------- */
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-playfair', display: 'swap' });
const arsenal = Arsenal({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-arsenal', display: 'swap' });
const bellefair = Bellefair({ subsets: ['latin'], weight: '400', variable: '--font-bellefair', display: 'swap' });
const belleAurore = La_Belle_Aurore({ subsets: ['latin'], weight: '400', variable: '--font-belle-aurore', display: 'swap' });
const averia = Averia_Serif_Libre({ subsets: ['latin'], weight: ['300', '400', '700'], variable: '--font-averia', display: 'swap' });
const oswald = Oswald({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-oswald', display: 'swap' });
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-dm-mono', display: 'swap' });
const sairaCondensed = Saira_Extra_Condensed({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-saira-condensed', display: 'swap' });
const darkerGrotesque = Darker_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-darker-grotesque', display: 'swap' });

const FONT_VARS = [
  fraunces,
  archivo,
  permanentMarker,
  caveat,
  allura,
  inter,
  poppins,
  montserrat,
  libreBaskerville,
  pinyon,
  cardo,
  jost,
  prata,
  cormorantSC,
  playfair,
  arsenal,
  bellefair,
  belleAurore,
  averia,
  oswald,
  dmMono,
  sairaCondensed,
  darkerGrotesque,
  ebGaramond,
  cormorant,
  notoNastaliq,
]
  .map((f) => f.variable)
  .join(' ');

/**
 * Hidden from search engines by default.
 *
 * We do NOT add a robots.txt Disallow for these paths. Google is explicit that a page blocked by
 * robots.txt is never crawled, so the crawler never sees `noindex` — and the page can still be
 * indexed. Disallow would defeat the very thing it looks like it is doing.
 */
export async function generateMetadata(): Promise<Metadata> {
  let names = 'Our Wedding';
  let isPublic = false;
  try {
    const s = await getSettings();
    names = s.couple_names || names;
    isPublic = s.site_is_public;
  } catch {
    /* Database not reachable at build time; fall back to safe defaults. */
  }

  return {
    title: names,
    description: 'Wedding details, schedule and RSVP.',
    robots: isPublic
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true },
    openGraph: { title: names, description: 'Wedding details, schedule and RSVP.', type: 'website' },
    other: { 'format-detection': 'telephone=no' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let theme = DEFAULT_THEME;
  let template = DEFAULT_TEMPLATE;
  try {
    const settings = await getSettings();
    theme = settings.theme || DEFAULT_THEME;
    template = settings.template || DEFAULT_TEMPLATE;
  } catch {
    /* keep the defaults */
  }

  // Per-visitor overrides, set from /themes. They let the owner walk the whole real site in each
  // direction before committing, rather than judging from a swatch. Theme and template are separate
  // cookies because they are separate choices — you can preview a structure without changing paint.
  try {
    const jar = await cookies();
    const previewTheme = jar.get('preview_theme')?.value;
    if (previewTheme && isValidTheme(previewTheme)) theme = previewTheme;
    const previewTemplate = jar.get('preview_template')?.value;
    if (previewTemplate && isValidTemplate(previewTemplate)) template = previewTemplate;
  } catch {
    /* no cookie store available */
  }

  return (
    <html lang="en" data-theme={theme} data-template={template} className={FONT_VARS}>
      <body>{children}</body>
    </html>
  );
}
