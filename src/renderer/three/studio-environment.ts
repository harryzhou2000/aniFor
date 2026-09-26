import { Color, DataTexture, EquirectangularReflectionMapping, FloatType, LinearFilter, RGBAFormat, Vector3 } from 'three';

/** Soft studio panels in linear HDR, used only for illumination and reflections. */
export function studioEnvironment(): DataTexture {
  const width = 512, height = 256, pixels = new Float32Array(width * height * 4);
  const panels = [
    {direction: [-0.7, 0.8, 1], width: 0.5, height: 0.72, color: '#fff0d8', intensity: 2.4},
    {direction: [1, 0.45, 0.5], width: 0.16, height: 0.8, color: '#c4e5ff', intensity: 3.6},
    {direction: [0.1, 1, -0.3], width: 0.8, height: 0.3, color: '#ffffff', intensity: 2},
    {direction: [-0.3, 0.3, -1], width: 0.32, height: 0.7, color: '#abcfff', intensity: 1.6},
    {direction: [-0.6, -0.3, 1], width: 0.1, height: 0.65, color: '#e0f3ff', intensity: 2.8},
  ].map(panel => {
    const normal = new Vector3(...panel.direction).normalize();
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), normal).normalize();
    return {...panel, normal, right, up: new Vector3().crossVectors(normal, right), tint: new Color(panel.color)};
  });
  const ray = new Vector3();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const latitude = (y + 0.5) / height * Math.PI, longitude = (x + 0.5) / width * Math.PI * 2;
    ray.set(-Math.cos(longitude) * Math.sin(latitude), -Math.cos(latitude), -Math.sin(longitude) * Math.sin(latitude));
    const offset = (y * width + x) * 4, ambient = 0.045 + Math.max(0, ray.y) * 0.09;
    pixels[offset] = ambient * 0.76; pixels[offset + 1] = ambient * 0.86; pixels[offset + 2] = ambient;
    for (const panel of panels) {
      const facing = ray.dot(panel.normal);
      if (facing <= 0) continue;
      const u = ray.dot(panel.right) / facing / panel.width, v = ray.dot(panel.up) / facing / panel.height;
      const strength = panel.intensity * Math.exp(-Math.pow(u, 8) - Math.pow(v, 8));
      pixels[offset] += panel.tint.r * strength; pixels[offset + 1] += panel.tint.g * strength; pixels[offset + 2] += panel.tint.b * strength;
    }
    pixels[offset + 3] = 1;
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat, FloatType);
  texture.mapping = EquirectangularReflectionMapping;
  texture.minFilter = texture.magFilter = LinearFilter; texture.needsUpdate = true;
  return texture;
}
