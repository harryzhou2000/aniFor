import {
  Application,
  BufferImageSource,
  Container,
  Filter,
  Sprite,
  Texture,
  UniformGroup,
} from 'pixi.js';
import { DirtyChunkGrid } from './dirty-chunk-grid';
import { clientToCanvasWorld } from './client-coordinate-map';
import { RenderFieldSet, type RenderMaterialStyle } from './render-field-set';
import { packSemanticRect } from './semantic-field';
import { packWallRect } from './wall-field';
interface PresenterViewport { readonly width: number; readonly height: number }

const FIELD_VERTEX = `
in vec2 aPosition;
out vec2 vFieldCoord;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vFieldCoord = aPosition;
}
`;

const FIELD_FRAGMENT = `
in vec2 vFieldCoord;
out vec4 finalColor;
uniform sampler2D uFieldTexture;
uniform sampler2D uWallTexture;
uniform sampler2D uAtmosphereTexture;
uniform sampler2D uEmissionTexture;
uniform sampler2D uLiquidTexture;
uniform sampler2D uPaletteTexture;
uniform sampler2D uStyleTexture;
uniform vec2 uTexel;
uniform vec2 uFieldSize;
uniform vec2 uAtmosphereTexel;
uniform vec2 uEmissionTexel;
uniform float uTime;
uniform float uHighQuality;
vec4 field(vec2 uv) { return texture(uFieldTexture, clamp(uv, uTexel * 0.5, vec2(1.0) - uTexel * 0.5)); }
vec4 wallField(vec2 uv) { return texture(uWallTexture, clamp(uv, uTexel * 0.5, vec2(1.0) - uTexel * 0.5)); }
float materialAt(vec2 uv) { return floor(field(uv).r * 255.0 + 0.5); }
float wallAt(vec2 uv) { return floor(wallField(uv).r * 255.0 + 0.5); }
float sameMaterial(vec2 uv, float material) { return 1.0 - step(0.5, abs(materialAt(uv) - material)); }
float familyFor(float id) { return floor(texture(uStyleTexture, vec2((id + 0.5) / 256.0, 0.5)).r * 255.0 + 0.5); }
float traitFlag(float traits, float mask) { return mod(floor(traits / mask), 2.0); }
float surfaceLightGain(float profile) {
  if (profile == 2.0) return 0.32;
  if (profile == 5.0) return 0.30;
  if (profile == 6.0) return 0.26;
  if (profile == 3.0) return 0.22;
  if (profile == 1.0) return 0.18;
  if (profile == 4.0) return 0.16;
  return 0.20;
}
vec3 vividColor(vec3 color, float saturation) {
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(luminance), color, saturation);
}
vec3 toneMapEnergy(vec3 radiance) {
  const float knee = 0.72;
  vec3 excess = max(radiance - vec3(knee), vec3(0.0));
  vec3 mapped = min(vec3(1.0), vec3(knee) + excess * 0.30);
  return min(radiance, mapped);
}
float compatibleAt(vec2 uv, float material, float family) {
  float candidate = materialAt(uv);
  if (abs(candidate - material) < 0.5) return 1.0;
  if (candidate < 0.5) return 0.0;
  if ((family == 1.0 || family == 2.0) && familyFor(candidate) == family) return 1.0;
  return 0.0;
}
vec3 occupancyShape(vec2 uv, float material, float family) {
  vec2 grid = uv * uFieldSize - 0.5;
  vec2 blend = fract(grid);
  vec2 origin = (floor(grid) + 0.5) * uTexel;
  float q00 = compatibleAt(origin, material, family);
  float q10 = compatibleAt(origin + vec2(uTexel.x, 0.0), material, family);
  float q01 = compatibleAt(origin + vec2(0.0, uTexel.y), material, family);
  float q11 = compatibleAt(origin + uTexel, material, family);
  float top = mix(q00, q10, blend.x);
  float bottom = mix(q01, q11, blend.x);
  float density = mix(top, bottom, blend.y);
  float gradientX = mix(q10 - q00, q11 - q01, blend.y);
  float gradientY = mix(q01 - q00, q11 - q10, blend.x);
  return vec3(density, gradientX, gradientY);
}
vec3 discreteShape(vec2 uv, float material) {
  vec2 left = vec2(uTexel.x, 0.0);
  vec2 down = vec2(0.0, uTexel.y);
  float l = sameMaterial(uv - left, material);
  float r = sameMaterial(uv + left, material);
  float t = sameMaterial(uv - down, material);
  float b = sameMaterial(uv + down, material);
  float center = sameMaterial(uv, material);
  if (uHighQuality < 0.5) {
    float density = center * 0.48 + (l + r + t + b) * 0.13;
    return vec3(density, r - l, b - t);
  }
  float tl = sameMaterial(uv - left - down, material);
  float tr = sameMaterial(uv + left - down, material);
  float bl = sameMaterial(uv - left + down, material);
  float br = sameMaterial(uv + left + down, material);
  float density = center * mix(0.48, 0.32, uHighQuality)
    + (l + r + t + b) * mix(0.13, 0.12, uHighQuality)
    + (tl + tr + bl + br) * 0.05 * uHighQuality;
  float gradientX = (r - l) + (tr + br - tl - bl) * 0.45 * uHighQuality;
  float gradientY = (b - t) + (bl + br - tl - tr) * 0.45 * uHighQuality;
  return vec3(density, gradientX, gradientY);
}
vec3 enclosedSurfaceShape(vec2 uv, float material) {
  vec2 left = vec2(uTexel.x, 0.0);
  vec2 down = vec2(0.0, uTexel.y);
  float lm = materialAt(uv - left);
  float rm = materialAt(uv + left);
  float tm = materialAt(uv - down);
  float bm = materialAt(uv + down);
  float tlm = materialAt(uv - left - down);
  float trm = materialAt(uv + left - down);
  float blm = materialAt(uv - left + down);
  float brm = materialAt(uv + left + down);
  float l = 1.0 - step(0.5, abs(lm - material));
  float r = 1.0 - step(0.5, abs(rm - material));
  float t = 1.0 - step(0.5, abs(tm - material));
  float b = 1.0 - step(0.5, abs(bm - material));
  float tl = 1.0 - step(0.5, abs(tlm - material));
  float tr = 1.0 - step(0.5, abs(trm - material));
  float bl = 1.0 - step(0.5, abs(blm - material));
  float br = 1.0 - step(0.5, abs(brm - material));
  float foreign = step(0.5, lm) * (1.0 - l) + step(0.5, rm) * (1.0 - r)
    + step(0.5, tm) * (1.0 - t) + step(0.5, bm) * (1.0 - b)
    + step(0.5, tlm) * (1.0 - tl) + step(0.5, trm) * (1.0 - tr)
    + step(0.5, blm) * (1.0 - bl) + step(0.5, brm) * (1.0 - br);
  float cardinal = l + r + t + b;
  float matches = cardinal + tl + tr + bl + br;
  float cardinallyEnclosed = step(3.5, cardinal);
  float denseSupport = step(4.5, matches) * step(2.5, cardinal);
  vec2 cell = floor(clamp(uv * uFieldSize, vec2(0.0), uFieldSize - vec2(1.0)));
  float interior = step(1.0, cell.x) * step(1.0, cell.y)
    * step(cell.x, uFieldSize.x - 2.0) * step(cell.y, uFieldSize.y - 2.0);
  float verticalCrackBounds = step(2.0, cell.y) * step(cell.y, uFieldSize.y - 3.0);
  float horizontalCrackBounds = step(2.0, cell.x) * step(cell.x, uFieldSize.x - 3.0);
  float crackSideWalls = tl * tr * bl * br;
  float thinCrack = 0.0;
  if (l * r * (1.0 - t) * (1.0 - b) * crackSideWalls * verticalCrackBounds > 0.5) {
    thinCrack = sameMaterial(uv - down * 2.0, material) * sameMaterial(uv + down * 2.0, material);
  } else if (t * b * (1.0 - l) * (1.0 - r) * crackSideWalls * horizontalCrackBounds > 0.5) {
    thinCrack = sameMaterial(uv - left * 2.0, material) * sameMaterial(uv + left * 2.0, material);
  }
  float valid = max(max(cardinallyEnclosed, denseSupport), thinCrack)
    * (1.0 - step(0.5, foreign)) * interior;
  float support = (l + r + t + b) * 0.12 + (tl + tr + bl + br) * 0.05;
  float coverage = max(smoothstep(0.30, 0.60, support), thinCrack * 0.90) * valid;
  float gradientX = (r - l) + (tr + br - tl - bl) * 0.45;
  float gradientY = (b - t) + (bl + br - tl - tr) * 0.45;
  return vec3(coverage * 0.92, gradientX * 0.14, gradientY * 0.14);
}
vec3 wallShape(vec2 uv, float wall) {
  vec2 grid = uv * uFieldSize - 0.5;
  vec2 blend = fract(grid);
  vec2 origin = (floor(grid) + 0.5) * uTexel;
  float q00 = 1.0 - step(0.5, abs(wallAt(origin) - wall));
  float q10 = 1.0 - step(0.5, abs(wallAt(origin + vec2(uTexel.x, 0.0)) - wall));
  float q01 = 1.0 - step(0.5, abs(wallAt(origin + vec2(0.0, uTexel.y)) - wall));
  float q11 = 1.0 - step(0.5, abs(wallAt(origin + uTexel) - wall));
  float top = mix(q00, q10, blend.x);
  float bottom = mix(q01, q11, blend.x);
  return vec3(mix(top, bottom, blend.y), mix(q10 - q00, q11 - q01, blend.y), mix(q01 - q00, q11 - q10, blend.x));
}
vec3 wallColor(float wall) {
  if (wall == 1.0) return vec3(0.49, 0.55, 0.59);
  if (wall == 2.0) return vec3(0.36, 0.44, 0.55);
  if (wall == 3.0) return vec3(0.75, 0.51, 0.24);
  if (wall == 6.0) return vec3(0.27, 0.57, 0.67);
  if (wall == 9.0) return vec3(0.44, 0.52, 0.59);
  if (wall == 10.0) return vec3(0.68, 0.52, 0.29);
  if (wall == 13.0) return vec3(0.51, 0.43, 0.61);
  if (wall == 15.0) return vec3(0.80, 0.75, 0.36);
  if (wall == 16.0) return vec3(0.27, 0.31, 0.36);
  return vec3(0.41, 0.42, 0.44);
}
float wallPattern(float wall, vec2 position) {
  float checker = mod(floor(position.x / 4.0) + floor(position.y / 4.0), 2.0);
  float pattern = mix(0.94, 1.04, checker);
  if (wall == 6.0 || wall == 9.0 || wall == 10.0 || wall == 13.0 || wall == 15.0) {
    pattern += step(0.72, fract((position.x + position.y) * 0.25)) * 0.12;
  }
  return pattern;
}
vec2 nearbySurface(vec2 uv) {
  float solid = 0.0;
  float candidate = materialAt(uv - vec2(uTexel.x, 0.0));
  if (candidate > 0.5) {
    vec4 style = texture(uStyleTexture, vec2((candidate + 0.5) / 256.0, 0.5));
    float family = floor(style.r * 255.0 + 0.5);
    if (family == 3.0 || style.b > 0.5) return vec2(candidate, 0.0);
    if (family == 0.0) solid = candidate;
  }
  candidate = materialAt(uv + vec2(uTexel.x, 0.0));
  if (candidate > 0.5) {
    vec4 style = texture(uStyleTexture, vec2((candidate + 0.5) / 256.0, 0.5));
    float family = floor(style.r * 255.0 + 0.5);
    if (family == 3.0 || style.b > 0.5) return vec2(candidate, 0.0);
    if (solid < 0.5 && family == 0.0) solid = candidate;
  }
  candidate = materialAt(uv - vec2(0.0, uTexel.y));
  if (candidate > 0.5) {
    vec4 style = texture(uStyleTexture, vec2((candidate + 0.5) / 256.0, 0.5));
    float family = floor(style.r * 255.0 + 0.5);
    if (family == 3.0 || style.b > 0.5) return vec2(candidate, 0.0);
    if (solid < 0.5 && family == 0.0) solid = candidate;
  }
  candidate = materialAt(uv + vec2(0.0, uTexel.y));
  if (candidate > 0.5) {
    vec4 style = texture(uStyleTexture, vec2((candidate + 0.5) / 256.0, 0.5));
    float family = floor(style.r * 255.0 + 0.5);
    if (family == 3.0 || style.b > 0.5) return vec2(candidate, 0.0);
    if (solid < 0.5 && family == 0.0) solid = candidate;
  }
  return vec2(0.0, solid);
}
float triangleSlope(float value, float period) {
  float phase = mod(mod(value, period) + period, period);
  return mix(4.0 / period, -4.0 / period, step(period * 0.5, phase));
}
float solidReliefStrength(float optics, float profile) {
  if (optics == 8.0) return 8.5;
  if (optics == 9.0) return 7.5;
  if (optics == 10.0) return 5.0;
  if (optics == 11.0) return 6.5;
  if (profile == 3.0) return 7.0;
  if (profile == 5.0) return 5.0;
  if (profile == 4.0) return 6.0;
  return 6.5;
}
vec3 solidReliefSample(vec2 position, float material, float profile, float optics) {
  float value = position.x * 3.0 + position.y * 2.0 + material * 11.0;
  float phase = mod(mod(value, 128.0) + 128.0, 128.0);
  float wave = 1.0 - abs(phase - 64.0) / 32.0;
  float slopeA = triangleSlope(value, 128.0);
  vec2 gradient = vec2(slopeA * 3.0, slopeA * 2.0);
  float strength = solidReliefStrength(optics, profile);
  return vec3(gradient * strength * 0.18, wave * strength / 255.0);
}
void main() {
  vec2 fieldUv = vFieldCoord;
  vec4 state = field(fieldUv);
  float wall = wallAt(fieldUv);
  vec3 wallSurface = wall > 0.5 ? wallShape(fieldUv, wall) : vec3(0.0);
  vec4 atmosphereState = texture(uAtmosphereTexture, fieldUv);
  vec4 emissionState = texture(uEmissionTexture, fieldUv);
  vec4 liquidState = texture(uLiquidTexture, fieldUv);
  float liquidDensity = liquidState.a;
  float material = floor(state.r * 255.0 + 0.5);
  float halo = 0.0;
  float cloudOnly = 0.0;
  float emissionOnly = 0.0;
  float liquidOnly = 0.0;
  float surfaceOnly = 0.0;
  float wallOnly = 0.0;
  if (material < 0.5) {
    // The reconstructed field already resolves all eight neighbours and keeps
    // unlike-liquid ties transparent. Its alpha and RGB must stay authoritative;
    // re-selecting a cardinal semantic neighbour here caused diagonal gaps and
    // scan-order species bleed that disagreed with the Canvas presenter.
    if (liquidDensity > 0.28) liquidOnly = 1.0;
    if (liquidOnly > 0.5) {
      halo = 1.0;
    } else if (atmosphereState.a > 0.004) {
      cloudOnly = 1.0;
    } else if (wall > 0.5) {
      wallOnly = 1.0;
    } else {
      vec2 nearby = nearbySurface(fieldUv);
      material = nearby.x;
      if (material < 0.5 && nearby.y > 0.5) {
        material = nearby.y;
        surfaceOnly = material > 0.5 ? 1.0 : 0.0;
      }
      if (material < 0.5) {
        if (wall > 0.5) wallOnly = 1.0;
        else if (emissionState.a > 0.002) emissionOnly = 1.0;
        else { finalColor = vec4(0.0); return; }
      }
    }
    halo = 1.0;
  }
  vec4 materialStyle = texture(uStyleTexture, vec2((material + 0.5) / 256.0, 0.5));
  vec4 paletteSample = texture(uPaletteTexture, vec2((material + 0.5) / 256.0, 0.5));
  float family = floor(materialStyle.r * 255.0 + 0.5);
  float profile = floor(materialStyle.g * 255.0 + 0.5);
  bool materialEmissive = materialStyle.b > 0.5;
  float traits = floor(materialStyle.a * 255.0 + 0.5);
  float optics = floor(paletteSample.a * 255.0 + 0.5);
  float energyCore = family == 3.0 ? 1.0 : 0.0;
  vec3 shape = wallOnly > 0.5
    ? wallSurface
    : (surfaceOnly > 0.5
    ? enclosedSurfaceShape(fieldUv, material)
    : ((cloudOnly > 0.5 || emissionOnly > 0.5)
    ? vec3(0.0)
    : (liquidOnly > 0.5
    ? vec3(liquidDensity, 0.0, 0.0)
    : ((family == 1.0 || profile == 1.0) ? discreteShape(fieldUv, material) : occupancyShape(fieldUv, material, family)))));
  float density = shape.x;
  vec2 fieldPosition = fieldUv * uFieldSize;
  float gasVolume = max(cloudOnly, family == 1.0 ? 1.0 : 0.0);
  float liquidVolume = max(liquidOnly, family == 2.0 ? 1.0 : 0.0);
  float volume = density;
  if (emissionOnly > 0.5) volume = emissionState.a;
  else if (cloudOnly > 0.5) volume = atmosphereState.a;
  else if (liquidVolume > 0.5) volume = max(density, liquidDensity);
  float gasInterior = cloudOnly > 0.5
    ? 1.0
    : (gasVolume > 0.5 ? smoothstep(0.14, 0.42, atmosphereState.a) : 0.0);
  float liquidInterior = liquidVolume > 0.5
    ? (liquidOnly > 0.5
      ? smoothstep(0.48, 0.92, liquidDensity)
      : smoothstep(0.42, 0.90, density))
    : 0.0;
  vec2 volumeSlope = vec2(0.0);
  float cloudNeighbourMean = 0.0;
  float liquidNeighbourMean = 0.0;
  if (emissionOnly > 0.5) {
    float lightLeft = texture(uEmissionTexture, fieldUv - vec2(uEmissionTexel.x, 0.0)).a;
    float lightRight = texture(uEmissionTexture, fieldUv + vec2(uEmissionTexel.x, 0.0)).a;
    float lightTop = texture(uEmissionTexture, fieldUv - vec2(0.0, uEmissionTexel.y)).a;
    float lightBottom = texture(uEmissionTexture, fieldUv + vec2(0.0, uEmissionTexel.y)).a;
    volumeSlope = vec2(lightRight - lightLeft, lightBottom - lightTop) * 0.72;
  } else if (gasVolume > 0.5) {
    float cloudLeft = texture(uAtmosphereTexture, fieldUv - vec2(uAtmosphereTexel.x, 0.0)).a;
    float cloudRight = texture(uAtmosphereTexture, fieldUv + vec2(uAtmosphereTexel.x, 0.0)).a;
    float cloudTop = texture(uAtmosphereTexture, fieldUv - vec2(0.0, uAtmosphereTexel.y)).a;
    float cloudBottom = texture(uAtmosphereTexture, fieldUv + vec2(0.0, uAtmosphereTexel.y)).a;
    cloudNeighbourMean = (cloudLeft + cloudRight + cloudTop + cloudBottom) * 0.25;
    volumeSlope = vec2(cloudRight - cloudLeft, cloudBottom - cloudTop) * 0.85;
  } else if (liquidVolume > 0.5) {
    float liquidLeft = texture(uLiquidTexture, fieldUv - vec2(uTexel.x, 0.0)).a;
    float liquidRight = texture(uLiquidTexture, fieldUv + vec2(uTexel.x, 0.0)).a;
    float liquidTop = texture(uLiquidTexture, fieldUv - vec2(0.0, uTexel.y)).a;
    float liquidBottom = texture(uLiquidTexture, fieldUv + vec2(0.0, uTexel.y)).a;
    liquidNeighbourMean = (liquidLeft + liquidRight + liquidTop + liquidBottom) * 0.25;
    volumeSlope = vec2(liquidRight - liquidLeft, liquidBottom - liquidTop) * 0.65;
  }
  // Promote only a field-supported pool interior. Requiring both centre and
  // cardinal mean prevents an isolated droplet from becoming a flat opaque
  // blob while suppressing semantic-cell micro normals inside cohesive liquid.
  float liquidFieldInterior = liquidVolume > 0.5
    ? min(
      smoothstep(0.48, 0.90, liquidDensity),
      smoothstep(0.48, 0.90, liquidNeighbourMean)
    )
    : 0.0;
  float cohesiveLiquidInterior = max(liquidInterior, liquidFieldInterior);
  float shapeDetail = 1.0 - max(gasInterior, cohesiveLiquidInterior);
  vec2 semanticSlope = shape.yz * shapeDetail;
  float solidInterior = family == 0.0
    ? smoothstep(0.76, 0.98, density) * (1.0 - smoothstep(0.10, 0.62, length(shape.yz)))
    : 0.0;
  float solidReliefTone = 0.0;
  if (solidInterior > 0.001) {
    vec3 solidRelief = solidReliefSample(fieldPosition, material, profile, optics);
    semanticSlope += solidRelief.xy * solidInterior;
    solidReliefTone = solidRelief.z * solidInterior;
  }
  vec3 normal = normalize(vec3(-semanticSlope.x - volumeSlope.x, -semanticSlope.y - volumeSlope.y, mix(1.45, 1.15, uHighQuality)));
  float diffuse = 0.72 + max(0.0, dot(normal, normalize(vec3(-0.48, -0.68, 0.78)))) * 0.42;
  float specular = pow(max(0.0, dot(normal, normalize(vec3(-0.35, -0.55, 0.92)))), 10.0);
  vec3 base = wallOnly > 0.5
    ? wallColor(wall)
    : (emissionOnly > 0.5
    ? emissionState.rgb
    : (cloudOnly > 0.5
    ? atmosphereState.rgb
    : (liquidOnly > 0.5 ? liquidState.rgb : paletteSample.rgb)));
  vec2 velocity = halo > 0.5 ? vec2(0.0) : state.ba * 2.0 - 1.0;
  float grain = fract(sin(dot(floor(fieldPosition), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  float atmosphere = sin(fieldPosition.x * 0.055 + fieldPosition.y * 0.027 + uTime * 0.7 + velocity.x * 2.0)
    * sin(fieldPosition.y * 0.043 - uTime * 0.43 + velocity.y * 1.7);
  float heat = smoothstep(0.07, 0.34, state.g);
  float alpha;
  vec3 color;
  if (wallOnly > 0.5) {
    alpha = smoothstep(0.30, 0.70, density) * 0.96;
    color = base * wallPattern(wall, fieldPosition) * (0.76 + diffuse * 0.24);
    color += vec3(0.08) * specular * 0.18;
  } else if (emissionOnly > 0.5) {
    float pulse = 0.90 + sin(uTime * 2.1 + fieldPosition.x * 0.025 - fieldPosition.y * 0.018) * 0.10;
    alpha = smoothstep(0.002, 0.28, volume) * (0.07 + volume * 0.30) * pulse;
    color = mix(base * 1.42 + vec3(0.045), base * 0.72, volume) * (0.68 + diffuse * 0.32);
    color += mix(vec3(0.16, 0.19, 0.24), base, 0.56) * specular * 0.30;
  } else if (energyCore > 0.5) {
    // Energy owns a luminous semantic core. The lower-resolution emission field
    // remains the surrounding aura, so fast particles never inherit its lag or
    // become radioactive/rigid textured solids.
    float core = smoothstep(0.36, 0.90, density);
    float edge = 1.0 - smoothstep(0.34, 0.88, density);
    float speed = clamp(length(velocity) * 1.45, 0.0, 1.0);
    float flowWave = sin(
      fieldPosition.x * (0.15 + speed * 0.08)
      + fieldPosition.y * (0.09 - velocity.x * 0.035)
      - uTime * (1.65 + speed * 1.8)
      + material * 0.41
    );
    float pulse = 0.5 + 0.5 * sin(uTime * 2.35 + material * 0.61 + atmosphere * 1.7);
    float scintillation = fract(sin(dot(floor(fieldPosition * 1.5), vec2(41.73, 19.19)) + material) * 143758.5453);
    float radioactiveCarrier = traitFlag(traits, 16.0);
    float directedCarrier = traitFlag(traits, 128.0);
    vec3 energyBase = vividColor(base, mix(1.18, 1.32, radioactiveCarrier));
    vec3 auraTint = emissionState.a > 0.002
      ? mix(energyBase, emissionState.rgb, 0.18 + edge * 0.10)
      : energyBase;
    float carrierDetail = mix(
      0.94 + flowWave * 0.08 + pulse * 0.06,
      0.92 + flowWave * 0.045 + step(0.84, scintillation) * (0.13 + uHighQuality * 0.09),
      directedCarrier
    );
    alpha = smoothstep(0.18, 0.72, density)
      * mix(0.58 + pulse * 0.08, 0.94, core)
      * mix(1.0, carrierDetail, edge * 0.55);
    color = energyBase * (1.05 + core * 0.48 + heat * 0.30) * carrierDetail;
    color += auraTint * edge * (0.20 + pulse * 0.16);
    color += mix(vec3(1.0, 0.72, 0.42), vec3(0.72, 0.90, 1.0), radioactiveCarrier)
      * core * (0.10 + pulse * 0.08);
    // Preserve sparse aura energy while compressing only the dense semantic
    // core. This retains hue and flow detail that would otherwise framebuffer-
    // clip into flat neon slabs after premultiplication.
    color = mix(color, toneMapEnergy(color), smoothstep(0.08, 0.68, core));
  } else if (gasVolume > 0.5) {
    float billow = 0.92 + atmosphere * 0.08;
    // Dense reconstructed gas should read as one mixed volume, not as the raw
    // palette colour of whichever semantic particle occupies this fragment.
    float sootyGas = optics == 5.0 ? 1.0 : 0.0;
    float cleanGas = optics == 6.0 ? 1.0 : 0.0;
    vec3 gasMixture = mix(base, atmosphereState.rgb, gasInterior * 0.98);
    vec3 gasBase = vividColor(gasMixture, 1.20 + cleanGas * 0.10 - sootyGas * 0.08);
    float gasShadeDensity = mix(density, atmosphereState.a, gasInterior);
    float gasCurvature = clamp((atmosphereState.a - cloudNeighbourMean) * 8.0, -1.0, 1.0);
    float gasCrown = max(gasCurvature, 0.0);
    float gasPocket = max(-gasCurvature, 0.0);
    float opticalDepth = smoothstep(0.035, 0.62, gasShadeDensity);
    float silverLining = (1.0 - smoothstep(0.10, 0.58, gasShadeDensity))
      * smoothstep(0.73, 1.08, diffuse);
    float particleAlpha = smoothstep(0.08, 0.72, density) * (0.38 + atmosphere * 0.06);
    float cloudAlpha = smoothstep(0.025, 0.46, atmosphereState.a)
      * (0.105 + atmosphereState.a * 0.32) * billow;
    alpha = cloudOnly > 0.5 ? cloudAlpha : mix(particleAlpha, cloudAlpha, gasInterior);
    // Beer-like optical depth keeps the core saturated and translucent while a
    // directional silver lining gives the boundary volume without a hard edge.
    float gasCoreTransmission = 0.74 + cleanGas * 0.08 - sootyGas * 0.13;
    float gasScatter = 0.26 + cleanGas * 0.10 - sootyGas * 0.08;
    color = gasBase * mix(1.08 + cleanGas * 0.04, gasCoreTransmission, opticalDepth)
      * (0.76 + diffuse * 0.28) * billow;
    color *= 1.0 + gasCrown * 0.18 - gasPocket * 0.11;
    color += mix(vec3(0.16, 0.19, 0.24), gasBase, 0.30 + cleanGas * 0.12)
      * silverLining * gasScatter;
    color += mix(vec3(0.10, 0.12, 0.16), gasBase, 0.34)
      * specular * mix(0.62, 0.18, gasInterior);
  } else if (liquidVolume > 0.5) {
    float aqueous = optics == 1.0 ? 1.0 : 0.0;
    float oily = optics == 2.0 ? 1.0 : 0.0;
    float corrosive = optics == 3.0 ? 1.0 : 0.0;
    float molten = optics == 4.0 ? 1.0 : 0.0;
    vec3 liquidBase = vividColor(base, 1.24 + aqueous * 0.06 + corrosive * 0.08 - oily * 0.05);
    // The four already-sampled field neighbours promote only locally supported
    // pool interiors. This makes reconstructed holes and semantic cells share
    // one optical depth without turning an isolated droplet into a pool core.
    float liquidDepth = max(cohesiveLiquidInterior, smoothstep(0.48, 0.90, liquidNeighbourMean));
    float liquidSurfaceDensity = liquidOnly > 0.5 ? liquidDensity : density;
    float rim = (1.0 - smoothstep(0.30, 0.86, liquidSurfaceDensity))
      * mix(1.0, 0.25, liquidDepth);
    float fresnel = pow(1.0 - clamp(normal.z, 0.0, 1.0), 2.0);
    float surfaceSpecular = specular * mix(1.0, 0.10, liquidDepth);
    float broadSheen = 0.5 + 0.5
      * sin(fieldPosition.x * 0.041 + fieldPosition.y * 0.016 + material * 0.83 + uTime * 0.22)
      * sin(fieldPosition.y * 0.029 - fieldPosition.x * 0.012 - uTime * 0.17);
    float causticWave = 0.5 + 0.5 * sin(
      fieldPosition.x * 0.092
      + sin(fieldPosition.y * 0.037 + uTime * 0.11) * 1.45
      + material * 0.67
    );
    float caustic = pow(causticWave, 6.0) * liquidDepth;
    float topLip = smoothstep(0.02, 0.16, volumeSlope.y);
    float lowerShade = smoothstep(0.02, 0.16, -volumeSlope.y);
    float depthTransmission = 0.66 + aqueous * 0.10 - oily * 0.10
      + corrosive * 0.04 - molten * 0.15;
    float gloss = 1.0 + aqueous * 0.18 + oily * 0.30
      + corrosive * 0.12 - molten * 0.20;
    float causticStrength = 0.085 + aqueous * 0.055 - oily * 0.045
      + corrosive * 0.025 - molten * 0.055;
    vec3 edgeTint = mix(vec3(0.66, 0.82, 0.88), liquidBase, 0.20);
    edgeTint = mix(edgeTint, vec3(0.72, 0.92, 1.0), aqueous * 0.18);
    edgeTint = mix(edgeTint, vec3(0.94, 0.72, 0.34), oily * 0.12 + molten * 0.20);
    edgeTint = mix(edgeTint, vec3(0.72, 1.0, 0.76), corrosive * 0.18);
    alpha = smoothstep(0.34, 0.62, volume) * mix(0.56, 0.82, liquidDepth);
    color = liquidBase * mix(1.24, depthTransmission, liquidDepth) * (0.70 + diffuse * 0.30);
    color += edgeTint
      * (surfaceSpecular * gloss * (0.72 + rim * 0.86) + fresnel * rim * (0.18 + aqueous * 0.08));
    color *= (1.0 + topLip * 0.08 - lowerShade * 0.05)
      * (0.94 + broadSheen * mix(0.035, 0.13, liquidDepth));
    color += mix(vec3(0.52, 0.68, 0.76), liquidBase, 0.50)
      * (broadSheen * mix(0.016, 0.052 * gloss, liquidDepth) + caustic * causticStrength);
    color += liquidBase * (0.025 + atmosphere * 0.030) + vec3(0.055, 0.090, 0.105) * rim;
  } else {
    float roughSurface = optics == 7.0 ? 1.0 : 0.0;
    float smoothSurface = optics == 8.0 ? 1.0 : 0.0;
    float organicSurface = optics == 9.0 ? 1.0 : 0.0;
    float deviceSurface = optics == 10.0 ? 1.0 : 0.0;
    float radioactiveSurface = optics == 11.0 ? 1.0 : 0.0;
    float edgeCenter = 0.49 + (profile == 1.0 ? grain * 0.045 : 0.0);
    alpha = smoothstep(edgeCenter - 0.11, edgeCenter + 0.11, density);
    color = base * mix(1.10, 0.78, density) * diffuse;
    color += vec3(solidReliefTone);
    float solidSpecularGain = 0.28 - roughSurface * 0.13 + smoothSurface * 0.22
      + organicSurface * 0.02 + deviceSurface * 0.15 + radioactiveSurface * 0.06;
    vec3 solidSpecularTint = mix(
      vec3(0.12), vec3(0.16, 0.24, 0.32), smoothSurface * 0.32 + deviceSurface * 0.58
    );
    solidSpecularTint = mix(solidSpecularTint, vec3(0.12, 0.24, 0.14), radioactiveSurface * 0.28);
    color += solidSpecularTint * specular * solidSpecularGain;
    // Granular coverage remains profile-owned. Optics below selects RGB texture
    // only, so a metadata/profile disagreement cannot widen the silhouette.
    if (profile == 1.0) {
      alpha = smoothstep(0.18 + grain * 0.025, 0.72 + grain * 0.035, density);
    }
    if (roughSurface > 0.5 || (optics < 0.5 && profile == 1.0)) {
      vec2 subcell = floor(fract(fieldPosition) * 2.0);
      float grainFacet = fract(sin(dot(floor(fieldPosition) * 2.0 + subcell, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      color *= 0.91 + grain * (0.20 + roughSurface * 0.05)
        + grainFacet * (0.10 + roughSurface * 0.04);
      color += base * max(0.0, 0.6 - subcell.x - subcell.y)
        * (0.11 + roughSurface * 0.035);
    } else if (smoothSurface > 0.5 || (optics < 0.5 && profile == 2.0)) {
      float bevel = clamp(abs(shape.y) + abs(shape.z), 0.0, 1.0);
      float strata = sin(fieldPosition.x * 0.16 + fieldPosition.y * 0.055 + material * 0.71);
      color *= 0.965 + strata * 0.028;
      color += mix(base, vec3(0.32, 0.36, 0.42), 0.26)
        * bevel * (0.13 + smoothSurface * 0.07);
    } else if (organicSurface > 0.5 || (optics < 0.5 && profile == 3.0)) {
      float fibre = sin(fieldPosition.x * 0.20 + sin(fieldPosition.y * 0.115 + material) * 1.45);
      float pores = sin(fieldPosition.x * 0.083 + fieldPosition.y * 0.157 + material * 0.37)
        * sin(fieldPosition.y * 0.091 - fieldPosition.x * 0.047);
      color *= 0.95 + fibre * 0.042 + pores * 0.024 + organicSurface * max(0.0, fibre) * 0.018;
      color += mix(base, vec3(0.19, 0.34, 0.18), 0.38)
        * organicSurface * max(0.0, 0.6 - abs(pores)) * 0.028;
    } else if (radioactiveSurface > 0.5 || (optics < 0.5 && profile == 4.0)) {
      float isotope = sin(fieldPosition.x * 0.137 + sin(fieldPosition.y * 0.103 + material) * 1.6)
        * sin(fieldPosition.y * 0.181 - fieldPosition.x * 0.061);
      float decayPulse = 0.5 + 0.5 * sin(uTime * 1.55 + material * 0.73 + isotope * 1.8);
      color *= 0.97 + isotope * 0.038 + decayPulse * 0.012;
      color += vec3(0.10, 0.25, 0.13) * radioactiveSurface * decayPulse * 0.035;
    } else if (deviceSurface > 0.5 || (optics < 0.5 && profile == 5.0)) {
      vec2 circuitCell = abs(fract((fieldPosition + vec2(material * 0.37, material * 0.19)) / 8.0) - 0.5);
      float trace = max(1.0 - smoothstep(0.055, 0.105, circuitCell.x), 1.0 - smoothstep(0.055, 0.105, circuitCell.y));
      float node = 1.0 - smoothstep(0.10, 0.22, length(circuitCell));
      color *= 0.96 + trace * 0.025;
      color += mix(base, vec3(0.34, 0.76, 1.0), 0.58)
        * (trace * (0.12 + deviceSurface * 0.035) + node * (0.10 + deviceSurface * 0.045));
    } else if (profile == 6.0) {
      float planeWave = sin((fieldPosition.x + fieldPosition.y * 0.62) * 0.115 - uTime * 1.15 + material);
      float radialWave = sin(length(fieldPosition - vec2(material * 1.7)) * 0.14 + uTime * 0.92);
      float interference = (planeWave + radialWave) * 0.5;
      color *= 0.95 + interference * 0.045;
    }
  }
  // Static role accents cross phase boundaries without widening semantic
  // silhouettes. Empty-space volume reconstruction intentionally remains free
  // of role metadata because it no longer has an authoritative material ID.
  if (traits > 0.5 && halo < 0.5 && wallOnly < 0.5 && emissionOnly < 0.5) {
    float emitter = traitFlag(traits, 1.0);
    float sink = traitFlag(traits, 2.0);
    float channel = traitFlag(traits, 4.0);
    float forceRole = traitFlag(traits, 8.0);
    float radioactive = traitFlag(traits, 16.0);
    float organic = traitFlag(traits, 32.0);
    float fibrous = traitFlag(traits, 64.0);
    float carrier = traitFlag(traits, 128.0);
    float traitEdge = 1.0 - smoothstep(0.58, 0.94, density);
    float roleWave = 0.5 + 0.5 * sin(
      dot(fieldPosition, vec2(0.137, 0.083)) + material * 0.619 - uTime * 0.92
    );
    if (emitter + sink > 0.5) {
      vec3 roleTint = (emitter * vec3(1.0, 0.48, 0.16) + sink * vec3(0.18, 0.52, 1.0))
        / max(1.0, emitter + sink);
      color += roleTint * (0.012 + roleWave * 0.035) * (0.45 + traitEdge * 0.55);
    }
    if (channel > 0.5) {
      float band = pow(0.5 + 0.5 * sin(
        (fieldPosition.x - fieldPosition.y) * 0.18 + uTime * (emitter - sink) * 0.90 + material
      ), 6.0);
      color += vec3(0.42, 0.72, 1.0) * (0.009 + band * 0.040);
    }
    if (forceRole > 0.5) {
      float radial = 0.5 + 0.5 * sin(
        length(fract((fieldPosition + vec2(material)) / 12.0) - 0.5) * 20.0 - uTime * 1.10 + material
      );
      color += vec3(0.18, 0.65, 1.0) * (0.012 + radial * 0.040) * (0.55 + traitEdge * 0.45);
    }
    if (radioactive > 0.5 && energyCore < 0.5) {
      float isotopeNoise = fract(sin(
        dot(floor(fieldPosition), vec2(12.9898, 78.233)) + material * 0.31
      ) * 43758.5453);
      float decay = step(0.90, isotopeNoise) * (0.55 + roleWave * 0.45);
      vec3 isotopeTint = mix(vec3(0.20, 0.72, 0.18), vec3(0.36, 0.82, 1.0), carrier);
      color += isotopeTint * (0.008 + decay * 0.034 + traitEdge * 0.010);
    }
    if (organic > 0.5) {
      float fibre = 0.5 + 0.5 * sin(
        fieldPosition.x * 0.18 + sin(fieldPosition.y * 0.11 + material) * 1.4
      );
      vec3 organicTint = mix(vec3(0.18, 0.50, 0.12), vec3(0.48, 0.29, 0.12), fibrous);
      color += mix(base, organicTint, 0.52) * (0.006 + fibre * 0.020);
    }
    if (carrier > 0.5 && energyCore < 0.5) {
      float carrierPulse = 0.5 + 0.5 * sin(
        dot(fieldPosition, vec2(0.19, 0.07)) - uTime * (1.8 + length(velocity)) + material * 0.43
      );
      vec3 carrierTint = mix(vec3(1.0, 0.68, 0.32), vec3(0.56, 0.88, 1.0), radioactive);
      color += carrierTint * (0.012 + carrierPulse * 0.038) * (0.40 + traitEdge * 0.60);
    }
  }
  float emission = energyCore > 0.5
    ? 0.0
    : (materialEmissive ? 0.48 + heat * 1.05 : (material == 11.0 ? 0.28 + heat * 0.62 : 0.0));
  color += mix(base, vec3(1.0, 0.52, 0.20), heat) * emission;
  if (energyCore < 0.5 && emissionOnly < 0.5 && emissionState.a > 0.002) {
    float lightReach = smoothstep(0.002, 0.42, emissionState.a);
    float volumeResponse = (gasVolume > 0.5 || liquidVolume > 0.5) ? 0.16 : 0.0;
    float contour = 1.0 - smoothstep(0.54, 0.96, density);
    float relief = clamp((diffuse - 0.72) / 0.42 + specular * 0.18, 0.0, 1.0);
    float lightProfile = wallOnly > 0.5 ? 2.0 : profile;
    float surfaceResponse = surfaceLightGain(lightProfile)
      * mix(0.14, 1.0, contour)
      * mix(0.76, 1.16, relief);
    float lightResponse = materialEmissive ? 0.24
      : (volumeResponse > 0.0 ? volumeResponse : surfaceResponse);
    // Opaque matter receives coloured light through its reconstructed relief;
    // empty space keeps the separate emission halo, avoiding a flat milky wash.
    color += emissionState.rgb * lightReach * lightResponse;
  }
  if (halo > 0.5 && wallOnly < 0.5 && emissionOnly < 0.5 && surfaceOnly < 0.5
    && gasVolume < 0.5 && liquidVolume < 0.5 && energyCore < 0.5) alpha = volume * 0.52;
  alpha = clamp(alpha, 0.0, 1.0);
  vec3 premultiplied = clamp(color, 0.0, 1.35) * alpha;
  float compositeAlpha = alpha;
  if (wall > 0.5 && wallOnly < 0.5) {
    float backgroundAlpha = smoothstep(0.30, 0.70, wallSurface.x) * 0.94;
    premultiplied += wallColor(wall) * wallPattern(wall, fieldPosition) * backgroundAlpha * (1.0 - compositeAlpha);
    compositeAlpha += backgroundAlpha * (1.0 - compositeAlpha);
  }
  finalColor = vec4(premultiplied, compositeAlpha);
}
`;

/** Primary WebGL presentation of raw simulation semantics. */
export class PixiFieldPresenter {
  private readonly scene = new Container();
  private readonly fieldBytes: Uint8Array;
  private readonly fieldSource: BufferImageSource;
  private readonly wallBytes: Uint8Array;
  private readonly wallSource: BufferImageSource;
  private readonly atmosphereSource: BufferImageSource;
  private readonly emissionSource: BufferImageSource;
  private readonly liquidSource: BufferImageSource;
  private readonly fieldSet: RenderFieldSet;
  private readonly chunks: DirtyChunkGrid;
  private readonly wallChunks: DirtyChunkGrid;
  private readonly uniforms: UniformGroup;

  private constructor(
    private readonly app: Application,
    private readonly host: HTMLElement,
    private readonly width: number,
    private readonly height: number,
    materials: readonly RenderMaterialStyle[],
    fieldSet?: RenderFieldSet,
  ) {
    this.fieldBytes = new Uint8Array(width * height * 4);
    this.fieldSource = new BufferImageSource({
      resource: this.fieldBytes, width, height, format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest', autoGarbageCollect: false,
    });
    const fieldTexture = new Texture({ source: this.fieldSource });
    this.wallBytes = new Uint8Array(width * height * 4);
    this.wallSource = new BufferImageSource({
      resource: this.wallBytes, width, height, format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest', autoGarbageCollect: false,
    });
    this.fieldSet = fieldSet ?? new RenderFieldSet(width, height, materials);
    const paletteTexture = textureFromBytes(this.fieldSet.lookups.paletteBytes);
    const styleTexture = textureFromBytes(this.fieldSet.lookups.styleBytes);
    this.atmosphereSource = new BufferImageSource({
      resource: this.fieldSet.atmosphere.bytes,
      width: this.fieldSet.atmosphere.width,
      height: this.fieldSet.atmosphere.height,
      format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'linear',
      autoGarbageCollect: false,
    });
    this.emissionSource = new BufferImageSource({
      resource: this.fieldSet.emission.bytes,
      width: this.fieldSet.emission.width,
      height: this.fieldSet.emission.height,
      format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'linear',
      autoGarbageCollect: false,
    });
    this.liquidSource = new BufferImageSource({
      resource: this.fieldSet.liquid.bytes,
      width,
      height,
      format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'linear',
      autoGarbageCollect: false,
    });
    this.uniforms = new UniformGroup({
      uTexel: { value: new Float32Array([1 / width, 1 / height]), type: 'vec2<f32>' },
      uFieldSize: { value: new Float32Array([width, height]), type: 'vec2<f32>' },
      uAtmosphereTexel: { value: new Float32Array([1 / this.fieldSet.atmosphere.width, 1 / this.fieldSet.atmosphere.height]), type: 'vec2<f32>' },
      uEmissionTexel: { value: new Float32Array([1 / this.fieldSet.emission.width, 1 / this.fieldSet.emission.height]), type: 'vec2<f32>' },
      uTime: { value: 0, type: 'f32' },
      uHighQuality: { value: matchMedia('(min-width: 800px) and (pointer: fine)').matches ? 1 : 0, type: 'f32' },
    });
    const filter = Filter.from({
      gl: { vertex: FIELD_VERTEX, fragment: FIELD_FRAGMENT, name: 'semantic-field-filter' },
      resources: {
        fieldUniforms: this.uniforms,
        uFieldTexture: this.fieldSource,
        uFieldSampler: this.fieldSource.style,
        uWallTexture: this.wallSource,
        uWallSampler: this.wallSource.style,
        uAtmosphereTexture: this.atmosphereSource,
        uAtmosphereSampler: this.atmosphereSource.style,
        uEmissionTexture: this.emissionSource,
        uEmissionSampler: this.emissionSource.style,
        uLiquidTexture: this.liquidSource,
        uLiquidSampler: this.liquidSource.style,
        uPaletteTexture: paletteTexture.source,
        uPaletteSampler: paletteTexture.source.style,
        uStyleTexture: styleTexture.source,
        uStyleSampler: styleTexture.source.style,
      },
      antialias: 'inherit',
    });
    const sprite = new Sprite(fieldTexture);
    sprite.filters = [filter];
    this.scene.addChild(sprite);
    this.chunks = new DirtyChunkGrid(width, height, 32, 2);
    this.wallChunks = new DirtyChunkGrid(width, height, 32, 2);
    this.chunks.markAll();
    this.wallChunks.markAll();
  }

  static async create(
    host: HTMLElement,
    width: number,
    height: number,
    outputScale: 1 | 2,
    materials: readonly RenderMaterialStyle[],
    fieldSet?: RenderFieldSet,
  ): Promise<PixiFieldPresenter> {
    const app = new Application();
    try {
      await app.init({
        width, height,
        preference: 'webgl', backgroundAlpha: 0, antialias: true,
        resolution: outputScale, autoDensity: true, autoStart: false,
      });
    } catch (error) {
      try { app.destroy(); } catch { /* partially initialized Pixi application */ }
      throw error;
    }
    let presenter: PixiFieldPresenter;
    try { presenter = new PixiFieldPresenter(app, host, width, height, materials, fieldSet); }
    catch (error) { app.destroy(); throw error; }
    presenter.app.canvas.className = 'world-canvas semantic-field-canvas';
    presenter.app.canvas.style.width = width + 'px';
    presenter.app.canvas.style.height = height + 'px';
    presenter.app.canvas.style.transformOrigin = '0 0';
    presenter.app.canvas.dataset.renderer = 'semantic-field-webgl';
    presenter.app.canvas.dataset.worldSize = width + 'x' + height;
    presenter.app.canvas.dataset.outputScale = String(outputScale);
    presenter.app.canvas.dataset.backingSize = presenter.app.canvas.width + 'x' + presenter.app.canvas.height;
    presenter.app.stage.addChild(presenter.scene);
    return presenter;
  }

  mount(): void { this.host.append(this.app.canvas); }

  destroy(): void {
    try { this.app.destroy(); }
    catch {
      try { this.scene.destroy({ children: true }); }
      catch { /* already torn down */ }
    }
  }

  resize(width: number, height: number): PresenterViewport {
    this.app.canvas.dataset.viewportSize = width + 'x' + height;
    return { width, height };
  }

  clientWorldPoint(clientX: number, clientY: number): { x: number; y: number } {
    return clientToCanvasWorld(
      { x: clientX, y: clientY }, this.app.canvas.getBoundingClientRect(), this.width, this.height,
    );
  }

  markDirty(index: number, nextMaterial: number): void {
    const previousMaterial = this.fieldBytes[index * 4];
    this.chunks.markCell(index);
    this.fieldSet.markDirty(previousMaterial, nextMaterial);
  }

  markWallDirty(index: number): void { this.wallChunks.markCell(index); }

  visualRefreshDue(time: number): boolean {
    return this.fieldSet.due(time);
  }

  update(materials: Uint8Array, walls: Uint8Array | undefined, temperatures: Uint16Array | undefined, velocities: Int8Array | undefined, time: number, refreshDynamicFields: boolean): void {
    if (refreshDynamicFields) this.chunks.markAll();
    const rectangles = this.chunks.consume();
    for (const rect of rectangles) packSemanticRect(this.fieldBytes, this.fieldSource.width, materials, temperatures, velocities, rect);
    if (rectangles.length) this.fieldSource.update();
    const wallRectangles = this.wallChunks.consume();
    if (walls) for (const rect of wallRectangles) packWallRect(this.wallBytes, this.wallSource.width, walls, rect);
    if (walls && wallRectangles.length) this.wallSource.update();
    const volumeField = this.fieldSet.updateNext(materials, time);
    if (volumeField === 'atmosphere') {
      this.atmosphereSource.update();
    } else if (volumeField === 'liquid') {
      this.liquidSource.update();
    } else if (volumeField === 'emission') {
      this.emissionSource.update();
    }
    this.uniforms.uniforms.uTime = time * 0.001;
    this.app.render();
  }

  setTransform(scale: number, x: number, y: number): void {
    this.app.canvas.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    this.app.canvas.dataset.viewScale = String(scale);
    this.app.canvas.dataset.viewPosition = x + "," + y;
    this.app.render();
  }
}

function textureFromBytes(bytes: Uint8Array): Texture {
  const source = new BufferImageSource({
    resource: bytes, width: 256, height: 1, format: 'rgba8unorm',
    alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest', autoGarbageCollect: false,
  });
  return new Texture({ source });
}
