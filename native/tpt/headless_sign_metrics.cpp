// SPDX-License-Identifier: GPL-3.0-only
// GameSave links sign layout code; headless worlds have no rendered sign metrics.

#include "graphics/Renderer.h"

template<>
Vec2<int> RasterDrawMethods<Renderer>::TextSize(String const &)
{
	return { 0, 0 };
}
