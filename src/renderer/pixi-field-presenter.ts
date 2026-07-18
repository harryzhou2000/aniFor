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
float profileFor(float id) { return floor(texture(uStyleTexture, vec2((id + 0.5) / 256.0, 0.5)).g * 255.0 + 0.5); }
float emissionFor(float id) { return texture(uStyleTexture, vec2((id + 0.5) / 256.0, 0.5)).b; }
float surfaceLightGain(float profile) {
  if (profile == 2.0) return 0.32;
  if (profile == 5.0) return 0.30;
  if (profile == 6.0) return 0.26;
  if (profile == 3.0) return 0.22;
  if (profile == 1.0) return 0.18;
  if (profile == 4.0) return 0.16;
  return 0.20;
}
bool isGas(float id) { return familyFor(id) == 1.0; }
bool isLiquid(float id) { return familyFor(id) == 2.0; }
bool isEnergy(float id) { return familyFor(id) == 3.0; }
bool isEmissive(float id) { return emissionFor(id) > 0.5; }
vec3 vividColor(vec3 color, float saturation) {
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(luminance), color, saturation);
}
float compatibleAt(vec2 uv, float material, float family) {
  float candidate = materialAt(uv);
  if (abs(candidate - material) < 0.5) return 1.0;
  if ((family == 1.0 || family == 2.0) && familyFor(candidate) == family) return 1.0;
  return 0.0;
}
vec3 occupancyShape(vec2 uv, float material) {
  vec2 grid = uv * uFieldSize - 0.5;
  vec2 blend = fract(grid);
  vec2 origin = (floor(grid) + 0.5) * uTexel;
  float family = familyFor(material);
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
  float tl = sameMaterial(uv - left - down, material);
  float tr = sameMaterial(uv + left - down, material);
  float bl = sameMaterial(uv - left + down, material);
  float br = sameMaterial(uv + left + down, material);
  float center = sameMaterial(uv, material);
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
  float l = sameMaterial(uv - left, material);
  float r = sameMaterial(uv + left, material);
  float t = sameMaterial(uv - down, material);
  float b = sameMaterial(uv + down, material);
  float tl = sameMaterial(uv - left - down, material);
  float tr = sameMaterial(uv + left - down, material);
  float bl = sameMaterial(uv - left + down, material);
  float br = sameMaterial(uv + left + down, material);
  float support = (l + r + t + b) * 0.12 + (tl + tr + bl + br) * 0.05;
  float coverage = smoothstep(0.34, 0.64, support);
  float gradientX = (r - l) + (tr + br - tl - bl) * 0.45;
  float gradientY = (b - t) + (bl + br - tl - tr) * 0.45;
  return vec3(coverage * 0.86, gradientX * 0.14, gradientY * 0.14);
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
  float family = familyFor(candidate);
  if (family == 3.0 || isEmissive(candidate)) return vec2(candidate, 0.0);
  if (candidate > 0.5 && family == 0.0) solid = candidate;
  candidate = materialAt(uv + vec2(uTexel.x, 0.0));
  family = familyFor(candidate);
  if (family == 3.0 || isEmissive(candidate)) return vec2(candidate, 0.0);
  if (solid < 0.5 && candidate > 0.5 && family == 0.0) solid = candidate;
  candidate = materialAt(uv - vec2(0.0, uTexel.y));
  family = familyFor(candidate);
  if (family == 3.0 || isEmissive(candidate)) return vec2(candidate, 0.0);
  if (solid < 0.5 && candidate > 0.5 && family == 0.0) solid = candidate;
  candidate = materialAt(uv + vec2(0.0, uTexel.y));
  family = familyFor(candidate);
  if (family == 3.0 || isEmissive(candidate)) return vec2(candidate, 0.0);
  if (solid < 0.5 && candidate > 0.5 && family == 0.0) solid = candidate;
  return vec2(0.0, solid);
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
  float profile = profileFor(material);
  vec3 shape = wallOnly > 0.5
    ? wallSurface
    : (surfaceOnly > 0.5
    ? enclosedSurfaceShape(fieldUv, material)
    : ((cloudOnly > 0.5 || emissionOnly > 0.5)
    ? vec3(0.0)
    : (liquidOnly > 0.5
    ? vec3(liquidDensity, 0.0, 0.0)
    : ((isGas(material) || profile == 1.0) ? discreteShape(fieldUv, material) : occupancyShape(fieldUv, material)))));
  float density = shape.x;
  float gasVolume = max(cloudOnly, isGas(material) ? 1.0 : 0.0);
  float liquidVolume = max(liquidOnly, isLiquid(material) ? 1.0 : 0.0);
  float volume = density;
  if (emissionOnly > 0.5) volume = emissionState.a;
  else if (cloudOnly > 0.5) volume = atmosphereState.a;
  else if (liquidVolume > 0.5) volume = max(density, liquidDensity);
  float gasInterior = cloudOnly > 0.5
    ? 1.0
    : (gasVolume > 0.5 ? smoothstep(0.14, 0.42, atmosphereState.a) : 0.0);
  float liquidInterior = liquidVolume > 0.5 ? smoothstep(0.78, 0.94, liquidDensity) : 0.0;
  float shapeDetail = 1.0 - max(gasInterior, liquidInterior);
  vec2 volumeSlope = vec2(0.0);
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
    volumeSlope = vec2(cloudRight - cloudLeft, cloudBottom - cloudTop) * 0.85;
  } else if (liquidVolume > 0.5) {
    float liquidLeft = texture(uLiquidTexture, fieldUv - vec2(uTexel.x, 0.0)).a;
    float liquidRight = texture(uLiquidTexture, fieldUv + vec2(uTexel.x, 0.0)).a;
    float liquidTop = texture(uLiquidTexture, fieldUv - vec2(0.0, uTexel.y)).a;
    float liquidBottom = texture(uLiquidTexture, fieldUv + vec2(0.0, uTexel.y)).a;
    volumeSlope = vec2(liquidRight - liquidLeft, liquidBottom - liquidTop) * 0.65;
  }
  vec2 semanticSlope = shape.yz * shapeDetail;
  vec3 normal = normalize(vec3(-semanticSlope.x - volumeSlope.x, -semanticSlope.y - volumeSlope.y, mix(1.45, 1.15, uHighQuality)));
  float diffuse = 0.72 + max(0.0, dot(normal, normalize(vec3(-0.48, -0.68, 0.78)))) * 0.42;
  float specular = pow(max(0.0, dot(normal, normalize(vec3(-0.35, -0.55, 0.92)))), 10.0);
  vec3 base = wallOnly > 0.5
    ? wallColor(wall)
    : (emissionOnly > 0.5
    ? emissionState.rgb
    : (cloudOnly > 0.5
    ? atmosphereState.rgb
    : (liquidOnly > 0.5 ? liquidState.rgb : texture(uPaletteTexture, vec2((material + 0.5) / 256.0, 0.5)).rgb)));
  vec2 velocity = halo > 0.5 ? vec2(0.0) : state.ba * 2.0 - 1.0;
  vec2 fieldPosition = fieldUv * uFieldSize;
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
  } else if (gasVolume > 0.5) {
    float billow = 0.88 + atmosphere * 0.12;
    // Dense reconstructed gas should read as one mixed volume, not as the raw
    // palette colour of whichever semantic particle occupies this fragment.
    vec3 gasMixture = mix(base, atmosphereState.rgb, gasInterior * 0.88);
    vec3 gasBase = vividColor(gasMixture, 1.18);
    float gasShadeDensity = mix(density, atmosphereState.a, gasInterior);
    float particleAlpha = smoothstep(0.08, 0.72, density) * (0.38 + atmosphere * 0.06);
    float cloudAlpha = smoothstep(0.025, 0.46, atmosphereState.a)
      * (0.10 + atmosphereState.a * 0.24) * billow;
    alpha = cloudOnly > 0.5 ? cloudAlpha : mix(particleAlpha, cloudAlpha, gasInterior);
    color = mix(gasBase * 0.78, gasBase * 1.38 + vec3(0.04), gasShadeDensity) * diffuse;
    color += mix(vec3(0.07, 0.085, 0.11), gasBase, 0.24) * specular * mix(1.0, 0.35, gasInterior);
  } else if (liquidVolume > 0.5) {
    vec3 liquidBase = vividColor(base, 1.16);
    float rim = (1.0 - smoothstep(0.30, 0.86, volume)) * mix(1.0, 0.25, liquidInterior);
    float surfaceSpecular = specular * mix(1.0, 0.12, liquidInterior);
    float broadSheen = 0.5 + 0.5
      * sin(fieldPosition.x * 0.041 + fieldPosition.y * 0.016 + material * 0.83 + uTime * 0.22)
      * sin(fieldPosition.y * 0.029 - fieldPosition.x * 0.012 - uTime * 0.17);
    float causticWave = 0.5 + 0.5 * sin(
      fieldPosition.x * 0.092
      + sin(fieldPosition.y * 0.037 + uTime * 0.11) * 1.45
      + material * 0.67
    );
    float caustic = pow(causticWave, 6.0) * liquidInterior;
    float verticalDepth = mix(1.04, 0.94, fieldUv.y);
    alpha = smoothstep(0.34, 0.62, volume) * mix(0.64, 0.86, volume);
    color = liquidBase * mix(1.26, 0.82, volume) * (0.70 + diffuse * 0.30);
    color += mix(vec3(0.48, 0.74, 0.82), liquidBase, 0.24) * surfaceSpecular * (0.62 + rim * 0.72);
    color *= verticalDepth * (0.94 + broadSheen * mix(0.04, 0.12, liquidInterior));
    color += mix(vec3(0.58, 0.72, 0.78), liquidBase, 0.42)
      * (broadSheen * mix(0.018, 0.045, liquidInterior) + caustic * 0.07);
    color += liquidBase * (0.035 + atmosphere * 0.035) + vec3(0.045, 0.075, 0.085) * rim;
  } else {
    float edgeCenter = 0.49 + (profile == 1.0 ? grain * 0.045 : 0.0);
    alpha = smoothstep(edgeCenter - 0.11, edgeCenter + 0.11, density);
    color = base * mix(1.10, 0.78, density) * diffuse;
    color += vec3(0.12) * specular * 0.28;
    if (profile == 1.0) {
      vec2 subcell = floor(fract(fieldPosition) * 2.0);
      float grainFacet = fract(sin(dot(floor(fieldPosition) * 2.0 + subcell, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      alpha = smoothstep(0.18 + grain * 0.025, 0.72 + grain * 0.035, density);
      color *= 0.91 + grain * 0.20 + grainFacet * 0.10;
      color += base * max(0.0, 0.6 - subcell.x - subcell.y) * 0.11;
    } else if (profile == 2.0) {
      float bevel = clamp(abs(shape.y) + abs(shape.z), 0.0, 1.0);
      float strata = sin(fieldPosition.x * 0.16 + fieldPosition.y * 0.055 + material * 0.71);
      color *= 0.965 + strata * 0.028;
      color += mix(base, vec3(0.32, 0.36, 0.42), 0.26) * bevel * 0.13;
    } else if (profile == 3.0) {
      float fibre = sin(fieldPosition.x * 0.20 + sin(fieldPosition.y * 0.115 + material) * 1.45);
      float pores = sin(fieldPosition.x * 0.083 + fieldPosition.y * 0.157 + material * 0.37)
        * sin(fieldPosition.y * 0.091 - fieldPosition.x * 0.047);
      color *= 0.95 + fibre * 0.042 + pores * 0.024;
      color += mix(base, vec3(0.18, 0.43, 0.13), 0.34) * max(0.0, fibre) * 0.038;
    } else if (profile == 4.0) {
      float isotope = sin(fieldPosition.x * 0.137 + sin(fieldPosition.y * 0.103 + material) * 1.6)
        * sin(fieldPosition.y * 0.181 - fieldPosition.x * 0.061);
      float decayPulse = 0.5 + 0.5 * sin(uTime * 1.55 + material * 0.73 + isotope * 1.8);
      color *= 0.94 + isotope * 0.055;
      color += mix(base, vec3(0.19, 0.72, 0.22), 0.56) * (0.045 + decayPulse * 0.065);
    } else if (profile == 5.0) {
      vec2 circuitCell = abs(fract((fieldPosition + vec2(material * 0.37, material * 0.19)) / 8.0) - 0.5);
      float trace = max(1.0 - smoothstep(0.055, 0.105, circuitCell.x), 1.0 - smoothstep(0.055, 0.105, circuitCell.y));
      float node = 1.0 - smoothstep(0.10, 0.22, length(circuitCell));
      color *= 0.96 + trace * 0.025;
      color += mix(base, vec3(0.34, 0.76, 1.0), 0.58) * (trace * 0.12 + node * 0.10);
    } else if (profile == 6.0) {
      float planeWave = sin((fieldPosition.x + fieldPosition.y * 0.62) * 0.115 - uTime * 1.15 + material);
      float radialWave = sin(length(fieldPosition - vec2(material * 1.7)) * 0.14 + uTime * 0.92);
      float interference = (planeWave + radialWave) * 0.5;
      color *= 0.95 + interference * 0.045;
      color += mix(base, vec3(0.48, 0.70, 1.0), 0.42) * (0.045 + max(0.0, interference) * 0.07);
    }
  }
  float emission = isEmissive(material) ? 0.48 + heat * 1.05 : (material == 11.0 ? 0.28 + heat * 0.62 : (profile == 4.0 ? 0.07 : 0.0));
  color += mix(base, vec3(1.0, 0.52, 0.20), heat) * emission;
  if (emissionOnly < 0.5 && emissionState.a > 0.002) {
    float lightReach = smoothstep(0.002, 0.42, emissionState.a);
    float volumeResponse = (gasVolume > 0.5 || liquidVolume > 0.5) ? 0.16 : 0.0;
    float contour = 1.0 - smoothstep(0.54, 0.96, density);
    float relief = clamp((diffuse - 0.72) / 0.42 + specular * 0.18, 0.0, 1.0);
    float lightProfile = wallOnly > 0.5 ? 2.0 : profile;
    float surfaceResponse = surfaceLightGain(lightProfile)
      * mix(0.14, 1.0, contour)
      * mix(0.76, 1.16, relief);
    float lightResponse = isEmissive(material) ? 0.24
      : (volumeResponse > 0.0 ? volumeResponse : surfaceResponse);
    // Opaque matter receives coloured light through its reconstructed relief;
    // empty space keeps the separate emission halo, avoiding a flat milky wash.
    color += emissionState.rgb * lightReach * lightResponse;
  }
  if (halo > 0.5 && wallOnly < 0.5 && emissionOnly < 0.5 && surfaceOnly < 0.5 && gasVolume < 0.5 && liquidVolume < 0.5) alpha = volume * (isEnergy(material) ? 1.35 + heat : 0.52);
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
