#include <stdint.h>

// Allocation-free C ABI: the seam where the chosen Powder Toy simulation
// subset will be adapted without exposing its memory model to the frontend.
namespace {
constexpr int kWidth = 160, kHeight = 100, kCells = kWidth * kHeight;
constexpr uint8_t EMPTY = 0, SAND = 1, WATER = 2, WALL = 3, FIRE = 4, SMOKE = 5;
uint8_t world[kCells];
uint32_t tick_count = 0;
int index_of(int x, int y) { return y * kWidth + x; }
bool inside(int x, int y) { return x >= 0 && y >= 0 && x < kWidth && y < kHeight; }
uint8_t get(int x, int y) { return inside(x, y) ? world[index_of(x, y)] : WALL; }
uint32_t noise(int x, int y) {
  uint32_t value = static_cast<uint32_t>((x + 7) * 374761393) ^ static_cast<uint32_t>((y + tick_count) * 668265263);
  value = (value ^ (value >> 13)) * 1274126177;
  return value ^ (value >> 16);
}
void swap_cells(int ax, int ay, int bx, int by) {
  const int a = index_of(ax, ay), b = index_of(bx, by);
  const uint8_t value = world[a]; world[a] = world[b]; world[b] = value;
}
}

extern "C" {
__attribute__((visibility("default"))) int powder_width() { return kWidth; }
__attribute__((visibility("default"))) int powder_height() { return kHeight; }
__attribute__((visibility("default"))) uint8_t* powder_cells() { return world; }
__attribute__((visibility("default"))) uint32_t powder_tick() { return tick_count; }
__attribute__((visibility("default"))) void powder_set_tick(uint32_t value) { tick_count = value; }
__attribute__((visibility("default"))) void powder_clear() {
  for (int i = 0; i < kCells; ++i) world[i] = EMPTY;
  tick_count = 0;
}
__attribute__((visibility("default"))) void powder_set(int x, int y, int material) {
  if (inside(x, y)) world[index_of(x, y)] = static_cast<uint8_t>(material);
}
__attribute__((visibility("default"))) void powder_step() {
  ++tick_count;
  for (int y = kHeight - 2; y >= 1; --y) {
    for (int n = 0; n < kWidth; ++n) {
      const int x = (tick_count & 1) ? n : kWidth - 1 - n;
      const uint8_t material = get(x, y);
      const int direction = (noise(x, y) & 1) ? 1 : -1;
      if (material == SAND) {
        if (get(x, y + 1) == EMPTY || get(x, y + 1) == WATER) swap_cells(x, y, x, y + 1);
        else if (inside(x + direction, y + 1) && (get(x + direction, y + 1) == EMPTY || get(x + direction, y + 1) == WATER)) swap_cells(x, y, x + direction, y + 1);
      } else if (material == WATER) {
        if (get(x, y + 1) == EMPTY) swap_cells(x, y, x, y + 1);
        else if (inside(x + direction, y) && get(x + direction, y) == EMPTY) swap_cells(x, y, x + direction, y);
      }
    }
  }
  for (int y = 1; y < kHeight - 1; ++y) {
    for (int x = 0; x < kWidth; ++x) {
      const uint8_t material = get(x, y);
      const int direction = (noise(x, y) & 1) ? 1 : -1;
      if (material == FIRE) {
        if (noise(x + 19, y) % 38 == 0) world[index_of(x, y)] = SMOKE;
        else if (inside(x + direction, y - 1) && get(x + direction, y - 1) == EMPTY) swap_cells(x, y, x + direction, y - 1);
        else if (get(x, y - 1) == EMPTY) swap_cells(x, y, x, y - 1);
      } else if (material == SMOKE) {
        if (noise(x + 31, y) % 90 == 0) world[index_of(x, y)] = EMPTY;
        else if (inside(x + direction, y - 1) && get(x + direction, y - 1) == EMPTY) swap_cells(x, y, x + direction, y - 1);
        else if (inside(x + direction, y) && get(x + direction, y) == EMPTY) swap_cells(x, y, x + direction, y);
      }
    }
  }
}
}
