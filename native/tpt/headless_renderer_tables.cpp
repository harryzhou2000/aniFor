// SPDX-License-Identifier: GPL-3.0-only
// Headless definitions for renderer-owned colour tables referenced by element callbacks.

#include "graphics/Gradient.h"
#include "graphics/Renderer.h"

std::vector<RGB> Renderer::flameTable = Gradient({
	{ 0x000000_rgb, 0.00f }, { 0x60300F_rgb, 0.50f },
	{ 0xDFBF6F_rgb, 0.90f }, { 0xAF9F0F_rgb, 1.00f },
}, 200);

std::vector<RGB> Renderer::plasmaTable = Gradient({
	{ 0x000000_rgb, 0.00f }, { 0x301040_rgb, 0.25f },
	{ 0x301060_rgb, 0.50f }, { 0xAFFFFF_rgb, 1.00f },
}, 200);

std::vector<RGB> Renderer::heatTable(1024, 0x000000_rgb);

std::vector<RGB> Renderer::clfmTable = Gradient({
	{ 0x000000_rgb, 0.00f }, { 0x19163C_rgb, 0.20f },
	{ 0x343E77_rgb, 0.40f }, { 0x57A0B4_rgb, 0.80f },
	{ 0x5EC4C6_rgb, 1.00f },
}, 200);

std::vector<RGB> Renderer::firwTable = Gradient({
	{ 0xFF00FF_rgb, 0.00f }, { 0x0000FF_rgb, 0.20f },
	{ 0x00FFFF_rgb, 0.40f }, { 0x00FF00_rgb, 0.60f },
	{ 0xFFFF00_rgb, 0.80f }, { 0xFF0000_rgb, 1.00f },
}, 200);

void Renderer::PopulateTables()
{
}
