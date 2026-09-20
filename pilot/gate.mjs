export const allowed = new Set(['generator_setup_page','generator_read_log','generator_write_test','browser_click','browser_hover','browser_navigate','browser_press_key','browser_select_option','browser_snapshot','browser_type','browser_verify_element_visible','browser_verify_list_visible','browser_verify_text_visible','browser_verify_value','browser_wait_for']);
export function validateCall(name, args, entry) {
  if (!allowed.has(name)) throw Error('TOOL_DENIED');
  if (name === 'generator_setup_page' && ((args.seedFile !== undefined && !['seed.spec.ts','tests/seed.spec.ts'].includes(args.seedFile)) || (args.project !== undefined && args.project !== 'chromium'))) throw Error('SEED_DENIED: use owned seed.spec.ts and chromium, or omit both');
  if (name === 'generator_write_test' && args.fileName !== 'tests/sorting.spec.ts') throw Error('OUTPUT_PATH_DENIED');
  if (name === 'browser_navigate' && args.url !== entry) throw Error('ENTRY_DENIED');
  if (name === 'browser_press_key' && !['Enter','Tab','Escape','ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Space'].includes(args.key)) throw Error('KEY_DENIED');
  if (name === 'browser_wait_for' && args.time !== undefined && (args.time < 0 || args.time > 5)) throw Error('WAIT_DENIED');
  return true;
}
