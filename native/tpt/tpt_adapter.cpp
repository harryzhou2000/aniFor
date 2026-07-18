// Stillroom headless adapter for The Powder Toy (GPL-3.0-only).
// Upstream internals and numeric IDs stop at this C ABI.
#include "client/GameSave.h"
#include "simulation/Air.h"
#include "simulation/Simulation.h"
#include "simulation/SimulationData.h"
#include "simulation/SimulationSettings.h"
#include "simulation/ElementClasses.h"
#include "simulation/ElementDefs.h"
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <memory>
#include <vector>

namespace {
constexpr unsigned int STILLROOM_SEED = 0x51A17EED;
constexpr int FIELD_SIZE = XRES * YRES;
std::unique_ptr<SimulationData> simulationData;
std::unique_ptr<Simulation> simulation;
std::vector<char> saveBuffer;
std::vector<char> loadBuffer;
uint8_t materialField[FIELD_SIZE];
uint16_t temperatureField[FIELD_SIZE];
int8_t velocityField[FIELD_SIZE * 2];

void EnsureSimulation()
{
	if (!simulationData)
		simulationData = std::make_unique<SimulationData>();
	if (!simulation)
	{
		simulation = Simulation::Factory();
		simulation->rng.seed(STILLROOM_SEED);
		simulation->ensureDeterminism = true;
	}
	simulation->air->airMode = AIR_VELOCITYOFF;
	simulation->air->vorticityCoeff = 0.0f;
}

int ToPowderType(int material)
{
	switch (material)
	{
	case 1: return PT_SAND;
	case 2: return PT_WATR;
	case 3: return PT_DMND;
	case 4: return PT_FIRE;
	case 5: return PT_SMKE;
	case 6: return PT_DUST;
	case 7: return PT_SALT;
	case 8: return PT_OIL;
	case 9: return PT_WOOD;
	case 10: return PT_PLNT;
	case 11: return PT_LAVA;
	case 12: return PT_ICEI;
	case 13: return PT_ACID;
	case 14: return PT_GUNP;
	default: return PT_NONE;
	}
}

uint8_t ToStillroomType(int type)
{
	switch (type)
	{
	case PT_SAND:
		return 1;
	case PT_WATR:
	case PT_DSTW:
	case PT_SLTW:
		return 2;
	case PT_DMND:
	case PT_STNE:
	case PT_BRCK:
		return 3;
	case PT_FIRE:
	case PT_PLSM:
		return 4;
	case PT_SMKE:
	case PT_WTRV:
	case PT_FOG:
		return 5;
	case PT_DUST: return 6;
	case PT_SALT: return 7;
	case PT_OIL: return 8;
	case PT_WOOD: return 9;
	case PT_PLNT: return 10;
	case PT_LAVA: return 11;
	case PT_ICEI: return 12;
	case PT_ACID: return 13;
	case PT_GUNP: return 14;
	default:
		return type ? 3 : 0;
	}
}

void ExtractFields()
{
	std::fill_n(materialField, FIELD_SIZE, uint8_t(0));
	std::fill_n(temperatureField, FIELD_SIZE, uint16_t(0));
	std::fill_n(velocityField, FIELD_SIZE * 2, int8_t(0));
	for (int y = 0; y < YRES; ++y)
	{
		for (int x = 0; x < XRES; ++x)
		{
			auto packed = simulation->pmap[y][x];
			if (!TYP(packed)) packed = simulation->photons[y][x];
			if (!TYP(packed)) continue;
			auto const &part = simulation->parts[ID(packed)];
			auto offset = y * XRES + x;
			materialField[offset] = ToStillroomType(part.type);
			temperatureField[offset] = uint16_t(std::clamp(part.temp * 10.0f, 0.0f, 65535.0f));
			velocityField[offset * 2] = int8_t(std::clamp(part.vx * 12.0f, -127.0f, 127.0f));
			velocityField[offset * 2 + 1] = int8_t(std::clamp(part.vy * 12.0f, -127.0f, 127.0f));
		}
	}
}
}

extern "C" {
__attribute__((visibility("default"))) int powder_init() { EnsureSimulation(); ExtractFields(); return 1; }
__attribute__((visibility("default"))) int powder_width() { return XRES; }
__attribute__((visibility("default"))) int powder_height() { return YRES; }
__attribute__((visibility("default"))) uint8_t *powder_cells() { EnsureSimulation(); ExtractFields(); return materialField; }
__attribute__((visibility("default"))) uint16_t *powder_temperature() { EnsureSimulation(); return temperatureField; }
__attribute__((visibility("default"))) int8_t *powder_velocity() { EnsureSimulation(); return velocityField; }
__attribute__((visibility("default"))) uint32_t powder_tick() { EnsureSimulation(); return simulation->currentTick; }
__attribute__((visibility("default"))) void powder_set_tick(uint32_t value) { EnsureSimulation(); simulation->currentTick = int(value); simulation->frameCount = value; }
__attribute__((visibility("default"))) void powder_clear()
{
	EnsureSimulation();
	simulation->clear_sim();
	simulation->rng.seed(STILLROOM_SEED);
	simulation->ensureDeterminism = true;
	simulation->currentTick = 0;
	ExtractFields();
}
__attribute__((visibility("default"))) void powder_set(int x, int y, int material)
{
	EnsureSimulation();
	if (x < CELL || y < CELL || x >= XRES - CELL || y >= YRES - CELL) return;
	if (material == 0) simulation->delete_part(x, y);
	else simulation->create_part(-2, x, y, ToPowderType(material));
}
__attribute__((visibility("default"))) void powder_step()
{
	EnsureSimulation();
	simulation->BeforeSim(true);
	simulation->UpdateParticles(0, NPART);
	simulation->AfterSim();
}
__attribute__((visibility("default"))) uint8_t *powder_save()
{
	EnsureSimulation();
	try
	{
		auto save = simulation->Save(true, RES.OriginRect());
		save->ensureDeterminism = true;
		auto serialised = save->Serialise();
		saveBuffer = std::move(serialised.second);
		return reinterpret_cast<uint8_t *>(saveBuffer.data());
	}
	catch (...) { saveBuffer.clear(); return nullptr; }
}
__attribute__((visibility("default"))) int powder_save_size() { return int(saveBuffer.size()); }
__attribute__((visibility("default"))) uint8_t *powder_load_buffer(int size)
{
	if (size <= 0 || size > 64 * 1024 * 1024) return nullptr;
	loadBuffer.resize(size_t(size));
	return reinterpret_cast<uint8_t *>(loadBuffer.data());
}
__attribute__((visibility("default"))) int powder_load_commit()
{
	EnsureSimulation();
	try
	{
		GameSave save(loadBuffer, false);
		simulation->clear_sim();
		simulation->Load(&save, true, { 0, 0 });
		simulation->frameCount = save.frameCount;
		simulation->currentTick = int(save.frameCount & 0x7FFFFFFF);
		if (save.hasRngState) simulation->rng.state(save.rngState);
		else simulation->rng.seed(STILLROOM_SEED);
		simulation->ensureDeterminism = true;
		ExtractFields();
		return 1;
	}
	catch (...) { return 0; }
}
}
