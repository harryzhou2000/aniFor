export function supportsWebGL(): boolean {
  if (/HeadlessChrome/i.test(navigator.userAgent)) return false;
  const probe = document.createElement('canvas');
  const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
  if (!context || context.isContextLost()) return false;
  const debug = context.getExtension('WEBGL_debug_renderer_info');
  const renderer = debug ? String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
  return !/swiftshader|llvmpipe|software/i.test(renderer);
}
