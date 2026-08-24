import { cookies } from 'next/headers';
import { getTemplate, isValidTemplate, type Template } from './templates';

/**
 * Resolve the structure to render with.
 *
 * The saved choice lives in `site_settings.template`; a `preview_template` cookie overrides it for
 * one visitor, so an owner can walk the whole real site in a structure before committing to it.
 * Kept separate from the theme cookie on purpose — picking a new layout should not silently change
 * the palette, and vice versa.
 */
export async function activeTemplate(saved: string | null | undefined): Promise<Template> {
  try {
    const preview = (await cookies()).get('preview_template')?.value;
    if (preview && isValidTemplate(preview)) return getTemplate(preview);
  } catch {
    /* no cookie store available — fall through to the saved value */
  }
  return getTemplate(saved);
}
