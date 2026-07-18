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
constexpr int STILLROOM_LIFE_FIRST = 171;
constexpr int STILLROOM_LIFE_PRESET_COUNT = 24;
static_assert(NGOL == STILLROOM_LIFE_PRESET_COUNT, "Stillroom LIFE projection must match TPT builtin GOL presets");
std::unique_ptr<SimulationData> simulationData;
std::unique_ptr<Simulation> simulation;
std::vector<char> saveBuffer;
std::vector<char> loadBuffer;
uint8_t materialField[FIELD_SIZE];
uint8_t wallField[FIELD_SIZE];
uint16_t temperatureField[FIELD_SIZE];
float pressureField[FIELD_SIZE];
int8_t velocityField[FIELD_SIZE * 2];
bool windPending = false;

constexpr int STILLROOM_TOOL_AIR = 1;
constexpr int STILLROOM_TOOL_VACUUM = 2;
constexpr int STILLROOM_TOOL_WIND = 3;
constexpr int STILLROOM_TOOL_HEAT = 4;
constexpr int STILLROOM_TOOL_COOL = 5;

Particle *ParticleAt(int x, int y)
{
	auto packed = simulation->pmap[y][x];
	if (!TYP(packed)) packed = simulation->photons[y][x];
	return TYP(packed) ? &simulation->parts[ID(packed)] : nullptr;
}

void RefreshAirBlockCell(int y, int x)
{
	auto const wall = simulation->bmap[y][x];
	auto const blocksAir = wall == WL_WALL || wall == WL_WALLELEC || wall == WL_BLOCKAIR
		|| (wall == WL_EWALL && !simulation->emap[y][x]);
	simulation->air->bmap_blockair[y][x] = blocksAir;
	simulation->air->bmap_blockairh[y][x] = (blocksAir || wall == WL_GRAV) ? 0x8 : 0;
}

void EnsureSimulation()
{
	if (!simulationData)
		simulationData = std::make_unique<SimulationData>();
	if (!simulation)
	{
		simulation = Simulation::Factory();
		simulation->rng.seed(STILLROOM_SEED);
		simulation->ensureDeterminism = true;
		simulation->air->airMode = AIR_VELOCITYOFF;
		simulation->air->vorticityCoeff = 0.0f;
	}
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
	case 15: return PT_WTRV;
	case 16: return PT_SLTW;
	case 17: return PT_GAS;
	case 18: return PT_SNOW;
	case 19: return PT_COAL;
	case 20: return PT_PLSM;
	case 21: return PT_STNE;
	case 22: return PT_BRCK;
	case 23: return PT_METL;
	case 24: return PT_GLAS;
	case 25: return PT_CRMC;
	case 26: return PT_CNCT;
	case 27: return PT_WAX;
	case 28: return PT_CLST;
	case 29: return PT_PQRT;
	case 30: return PT_THRM;
	case 31: return PT_PLEX;
	case 32: return PT_NITR;
	case 33: return PT_FWRK;
	case 34: return PT_DSTW;
	case 35: return PT_DESL;
	case 36: return PT_MERC;
	case 37: return PT_LNTG;
	case 38: return PT_SOAP;
	case 39: return PT_O2;
	case 40: return PT_H2;
	case 41: return PT_CO2;
	case 42: return PT_NBLE;
	case 43: return PT_ANAR;
	case 44: return PT_BGLA;
	case 45: return PT_BREC;
	case 46: return PT_BRMT;
	case 47: return PT_FRZZ;
	case 48: return PT_GRAV;
	case 49: return PT_SAWD;
	case 50: return PT_SEED;
	case 51: return PT_SLCN;
	case 52: return PT_YEST;
	case 53: return PT_BASE;
	case 54: return PT_BIZR;
	case 55: return PT_CBNW;
	case 56: return PT_GEL;
	case 57: return PT_GLOW;
	case 58: return PT_LO2;
	case 59: return PT_MWAX;
	case 60: return PT_PSTE;
	case 61: return PT_RSST;
	case 62: return PT_VIRS;
	case 63: return PT_BOYL;
	case 64: return PT_CAUS;
	case 65: return PT_FOG;
	case 66: return PT_RFRG;
	case 67: return PT_BMTL;
	case 68: return PT_DRIC;
	case 69: return PT_FILT;
	case 70: return PT_GOLD;
	case 71: return PT_GOO;
	case 72: return PT_HEAC;
	case 73: return PT_IRON;
	case 74: return PT_NICE;
	case 75: return PT_PTNM;
	case 76: return PT_QRTZ;
	case 77: return PT_RIME;
	case 78: return PT_ROCK;
	case 79: return PT_RSSS;
	case 80: return PT_SHLD1;
	case 81: return PT_SPNG;
	case 82: return PT_TTAN;
	case 83: return PT_VINE;
	case 84: return PT_BANG;
	case 85: return PT_BOMB;
	case 86: return PT_C5;
	case 87: return PT_CFLM;
	case 88: return PT_DEST;
	case 89: return PT_FIRW;
	case 90: return PT_FSEP;
	case 91: return PT_FUSE;
	case 92: return PT_IGNT;
	case 93: return PT_LIGH;
	case 94: return PT_LITH;
	case 95: return PT_LRBD;
	case 96: return PT_RBDM;
	case 97: return PT_THDR;
	case 98: return PT_AMTR;
	case 99: return PT_BVBR;
	case 100: return PT_DEUT;
	case 101: return PT_ELEC;
	case 102: return PT_EXOT;
	case 103: return PT_GRVT;
	case 104: return PT_ISOZ;
	case 105: return PT_ISZS;
	case 106: return PT_NEUT;
	case 107: return PT_PHOT;
	case 108: return PT_PLUT;
	case 109: return PT_POLO;
	case 110: return PT_PROT;
	case 111: return PT_SING;
	case 112: return PT_URAN;
	case 113: return PT_VIBR;
	case 114: return PT_WARP;
	case 115: return PT_ACEL;
	case 116: return PT_DCEL;
	case 117: return PT_DMG;
	case 118: return PT_FRAY;
	case 119: return PT_FRME;
	case 120: return PT_GBMB;
	case 121: return PT_PIPE;
	case 122: return PT_PSTN;
	case 123: return PT_RPEL;
	case 124: return PT_BCLN;
	case 125: return PT_BHOL;
	case 126: return PT_CLNE;
	case 127: return PT_CONV;
	case 128: return PT_NBHL;
	case 129: return PT_NWHL;
	case 130: return PT_PRTI;
	case 131: return PT_PRTO;
	case 132: return PT_TRON;
	case 133: return PT_VOID;
	case 134: return PT_WHOL;
	case 135: return PT_ARAY;
	case 136: return PT_BTRY;
	case 137: return PT_CRAY;
	case 138: return PT_DRAY;
	case 139: return PT_EMP;
	case 140: return PT_ETRD;
	case 141: return PT_INSL;
	case 142: return PT_INST;
	case 143: return PT_INWR;
	case 144: return PT_NSCN;
	case 145: return PT_NTCT;
	case 146: return PT_PSCN;
	case 147: return PT_PTCT;
	case 148: return PT_SPRK;
	case 149: return PT_SWCH;
	case 150: return PT_TESC;
	case 151: return PT_TUNG;
	case 152: return PT_WIFI;
	case 153: return PT_WIRE;
	case 154: return PT_DLAY;
	case 155: return PT_GPMP;
	case 156: return PT_HSWC;
	case 157: return PT_LCRY;
	case 158: return PT_PBCN;
	case 159: return PT_PCLN;
	case 160: return PT_PPIP;
	case 161: return PT_PUMP;
	case 162: return PT_PVOD;
	case 163: return PT_STOR;
	case 164: return PT_DTEC;
	case 165: return PT_INVIS;
	case 166: return PT_LDTC;
	case 167: return PT_LSNS;
	case 168: return PT_PSNS;
	case 169: return PT_TSNS;
	case 170: return PT_VSNS;
	default: return PT_NONE;
	}
}

bool IsConfiguredSourceType(int type)
{
	return type == PT_CLNE || type == PT_BCLN || type == PT_PCLN
		|| type == PT_PBCN || type == PT_CONV;
}

bool CanConfigureSourceType(int sourceType, int targetType)
{
	if (!IsConfiguredSourceType(sourceType) || targetType <= PT_NONE || targetType >= PT_NUM)
		return false;
	auto const &sourceElement = simulationData->elements[sourceType];
	auto const &targetElement = simulationData->elements[targetType];
	if (!sourceElement.Enabled || !sourceElement.CtypeDraw || !targetElement.Enabled
		|| sourceType == targetType || (targetElement.Properties & PROP_NOCTYPEDRAW))
		return false;
	if ((sourceType == PT_PCLN || sourceType == PT_PBCN)
		&& (targetType == PT_PSCN || targetType == PT_NSCN || targetType == PT_SPRK))
		return false;
	return true;
}

uint8_t ToStillroomType(int type)
{
	switch (type)
	{
	case PT_SAND:
		return 1;
	case PT_WATR:
		return 2;
	case PT_DMND:
		return 3;
	case PT_FIRE:
		return 4;
	case PT_SMKE:
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
	case PT_WTRV: return 15;
	case PT_SLTW: return 16;
	case PT_GAS: return 17;
	case PT_SNOW: return 18;
	case PT_BCOL:
	case PT_COAL:
		return 19;
	case PT_PLSM: return 20;
	case PT_STNE: return 21;
	case PT_BRCK: return 22;
	case PT_METL: return 23;
	case PT_GLAS: return 24;
	case PT_CRMC: return 25;
	case PT_CNCT: return 26;
	case PT_WAX: return 27;
	case PT_CLST: return 28;
	case PT_PQRT: return 29;
	case PT_THRM: return 30;
	case PT_PLEX: return 31;
	case PT_NITR: return 32;
	case PT_FWRK: return 33;
	case PT_DSTW: return 34;
	case PT_DESL: return 35;
	case PT_MERC: return 36;
	case PT_LNTG: return 37;
	case PT_SOAP: return 38;
	case PT_O2: return 39;
	case PT_H2: return 40;
	case PT_CO2: return 41;
	case PT_NBLE: return 42;
	case PT_ANAR: return 43;
	case PT_BGLA: return 44;
	case PT_BREC: return 45;
	case PT_BRMT: return 46;
	case PT_FRZZ: return 47;
	case PT_GRAV: return 48;
	case PT_SAWD: return 49;
	case PT_SEED: return 50;
	case PT_SLCN: return 51;
	case PT_YEST: return 52;
	case PT_BASE: return 53;
	case PT_BIZR: return 54;
	case PT_CBNW: return 55;
	case PT_GEL: return 56;
	case PT_GLOW: return 57;
	case PT_LO2: return 58;
	case PT_MWAX: return 59;
	case PT_PSTE: return 60;
	case PT_RSST: return 61;
	case PT_VIRS: return 62;
	case PT_BOYL: return 63;
	case PT_CAUS: return 64;
	case PT_FOG: return 65;
	case PT_RFRG: return 66;
	case PT_BMTL: return 67;
	case PT_DRIC: return 68;
	case PT_FILT: return 69;
	case PT_GOLD: return 70;
	case PT_GOO: return 71;
	case PT_HEAC: return 72;
	case PT_IRON: return 73;
	case PT_NICE: return 74;
	case PT_PTNM: return 75;
	case PT_QRTZ: return 76;
	case PT_RIME: return 77;
	case PT_ROCK: return 78;
	case PT_RSSS: return 79;
	case PT_SHLD1: return 80;
	case PT_SPNG: return 81;
	case PT_TTAN: return 82;
	case PT_VINE: return 83;
	case PT_BANG: return 84;
	case PT_BOMB: return 85;
	case PT_C5: return 86;
	case PT_CFLM: return 87;
	case PT_DEST: return 88;
	case PT_FIRW: return 89;
	case PT_FSEP: return 90;
	case PT_FUSE: return 91;
	case PT_IGNT: return 92;
	case PT_LIGH: return 93;
	case PT_LITH: return 94;
	case PT_LRBD: return 95;
	case PT_RBDM: return 96;
	case PT_THDR: return 97;
	case PT_AMTR: return 98;
	case PT_BVBR: return 99;
	case PT_DEUT: return 100;
	case PT_ELEC: return 101;
	case PT_EXOT: return 102;
	case PT_GRVT: return 103;
	case PT_ISOZ: return 104;
	case PT_ISZS: return 105;
	case PT_NEUT: return 106;
	case PT_PHOT: return 107;
	case PT_PLUT: return 108;
	case PT_POLO: return 109;
	case PT_PROT: return 110;
	case PT_SING: return 111;
	case PT_URAN: return 112;
	case PT_VIBR: return 113;
	case PT_WARP: return 114;
	case PT_ACEL: return 115;
	case PT_DCEL: return 116;
	case PT_DMG: return 117;
	case PT_FRAY: return 118;
	case PT_FRME: return 119;
	case PT_GBMB: return 120;
	case PT_PIPE: return 121;
	case PT_PSTN: return 122;
	case PT_RPEL: return 123;
	case PT_BCLN: return 124;
	case PT_BHOL: return 125;
	case PT_CLNE: return 126;
	case PT_CONV: return 127;
	case PT_NBHL: return 128;
	case PT_NWHL: return 129;
	case PT_PRTI: return 130;
	case PT_PRTO: return 131;
	case PT_TRON: return 132;
	case PT_VOID: return 133;
	case PT_WHOL: return 134;
	case PT_ARAY: return 135;
	case PT_BTRY: return 136;
	case PT_CRAY: return 137;
	case PT_DRAY: return 138;
	case PT_EMP: return 139;
	case PT_ETRD: return 140;
	case PT_INSL: return 141;
	case PT_INST: return 142;
	case PT_INWR: return 143;
	case PT_NSCN: return 144;
	case PT_NTCT: return 145;
	case PT_PSCN: return 146;
	case PT_PTCT: return 147;
	case PT_SPRK: return 148;
	case PT_SWCH: return 149;
	case PT_TESC: return 150;
	case PT_TUNG: return 151;
	case PT_WIFI: return 152;
	case PT_WIRE: return 153;
	case PT_DLAY: return 154;
	case PT_GPMP: return 155;
	case PT_HSWC: return 156;
	case PT_LCRY: return 157;
	case PT_PBCN: return 158;
	case PT_PCLN: return 159;
	case PT_PPIP: return 160;
	case PT_PUMP: return 161;
	case PT_PVOD: return 162;
	case PT_STOR: return 163;
	case PT_DTEC: return 164;
	case PT_INVIS: return 165;
	case PT_LDTC: return 166;
	case PT_LSNS: return 167;
	case PT_PSNS: return 168;
	case PT_TSNS: return 169;
	case PT_VSNS: return 170;
	default: break;
	}

	// TPT has hundreds of elements and reactions can produce types that are not
	// brush tools in Stillroom. Project them by physical state instead of the old
	// catch-all stone rendering, so newly introduced upstream products remain
	// visible without expanding the public brush ABI for every TPT element.
	if (type <= PT_NONE || type >= PT_NUM)
		return 0;
	auto const properties = simulationData->elements[type].Properties;
	if (properties & TYPE_ENERGY) return 4;
	if (properties & TYPE_GAS) return 5;
	if (properties & TYPE_LIQUID) return 2;
	if (properties & TYPE_PART) return 1;
	if (properties & TYPE_SOLID) return 3;
	return 3;
}

void ExtractFields()
{
	std::fill_n(materialField, FIELD_SIZE, uint8_t(0));
	std::fill_n(wallField, FIELD_SIZE, uint8_t(0));
	std::fill_n(temperatureField, FIELD_SIZE, uint16_t(0));
	std::fill_n(pressureField, FIELD_SIZE, 0.0f);
	std::fill_n(velocityField, FIELD_SIZE * 2, int8_t(0));
	for (int y = 0; y < YRES; ++y)
	{
		for (int x = 0; x < XRES; ++x)
		{
			auto offset = y * XRES + x;
			wallField[offset] = uint8_t(simulation->bmap[y / CELL][x / CELL]);
			pressureField[offset] = simulation->pv[y / CELL][x / CELL];
			auto packed = simulation->pmap[y][x];
			if (!TYP(packed)) packed = simulation->photons[y][x];
			if (!TYP(packed)) continue;
			auto const &part = simulation->parts[ID(packed)];
			if (part.type == PT_LIFE && part.ctype >= 0 && part.ctype < STILLROOM_LIFE_PRESET_COUNT)
				materialField[offset] = uint8_t(STILLROOM_LIFE_FIRST + part.ctype);
			else
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
__attribute__((visibility("default"))) uint8_t *powder_walls() { EnsureSimulation(); ExtractFields(); return wallField; }
__attribute__((visibility("default"))) uint16_t *powder_temperature() { EnsureSimulation(); return temperatureField; }
__attribute__((visibility("default"))) float *powder_pressure() { EnsureSimulation(); return pressureField; }
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
	simulation->air->airMode = AIR_VELOCITYOFF;
	simulation->air->vorticityCoeff = 0.0f;
	windPending = false;
	ExtractFields();
}
__attribute__((visibility("default"))) void powder_set(int x, int y, int material)
{
	EnsureSimulation();
	if (x < CELL || y < CELL || x >= XRES - CELL || y >= YRES - CELL) return;
	if (material == 0) simulation->delete_part(x, y);
	else simulation->create_part(-2, x, y, ToPowderType(material));
}
__attribute__((visibility("default"))) int powder_set_life(int x, int y, int preset)
{
	EnsureSimulation();
	if (x < CELL || y < CELL || x >= XRES - CELL || y >= YRES - CELL
		|| preset < 0 || preset >= STILLROOM_LIFE_PRESET_COUNT)
		return -1;
	if (!simulationData->elements[PT_LIFE].Enabled) return -1;

	// LIFE is a semantic placement tool, not a source-target shortcut. Keeping
	// occupied cells atomic also prevents repainting from silently changing ctype.
	if (TYP(simulation->pmap[y][x])) return 0;
	return simulation->create_part(-2, x, y, PT_LIFE, preset) >= 0 ? 1 : 0;
}
__attribute__((visibility("default"))) int powder_set_configured_source(int x, int y, int source, int target)
{
	EnsureSimulation();
	if (x < CELL || y < CELL || x >= XRES - CELL || y >= YRES - CELL) return -1;
	auto const sourceType = ToPowderType(source);
	auto const targetType = ToPowderType(target);
	if (!IsConfiguredSourceType(sourceType) || targetType <= PT_NONE || targetType >= PT_NUM) return -1;
	auto const &sourceElement = simulationData->elements[sourceType];
	if (!sourceElement.Enabled || !sourceElement.CtypeDraw || !simulationData->elements[targetType].Enabled) return -1;
	if (!CanConfigureSourceType(sourceType, targetType)) return 0;

	auto const packed = simulation->pmap[y][x];
	int sourceIndex = -1;
	bool created = false;
	if (TYP(packed))
	{
		if (TYP(packed) != sourceType) return 0;
		sourceIndex = ID(packed);
	}
	else
	{
		sourceIndex = simulation->create_part(-2, x, y, sourceType);
		if (sourceIndex < 0) return 0;
		created = true;
	}

	if (!sourceElement.CtypeDraw(simulation.get(), sourceIndex, targetType, 0))
	{
		if (created) simulation->kill_part(sourceIndex);
		return 0;
	}
	return 1;
}
__attribute__((visibility("default"))) int powder_can_configure_source(int source, int target)
{
	EnsureSimulation();
	return CanConfigureSourceType(ToPowderType(source), ToPowderType(target)) ? 1 : 0;
}
__attribute__((visibility("default"))) int powder_source_target(int x, int y)
{
	EnsureSimulation();
	if (x < 0 || y < 0 || x >= XRES || y >= YRES) return 0;
	auto const packed = simulation->pmap[y][x];
	if (!TYP(packed) || !IsConfiguredSourceType(TYP(packed))) return 0;
	auto const targetType = TYP(simulation->parts[ID(packed)].ctype);
	if (targetType <= PT_NONE || targetType >= PT_NUM) return 0;
	auto const target = ToStillroomType(targetType);
	// ToStillroomType deliberately phase-projects unknown native products for
	// rendering. A configured-source query must never report such a projection
	// as an exact target, so require the public mapping to round-trip.
	return target && ToPowderType(target) == targetType ? target : 0;
}
__attribute__((visibility("default"))) void powder_set_wall(int x, int y, int wall, int radius)
{
	EnsureSimulation();
	if (x < 0 || y < 0 || x >= XRES || y >= YRES) return;
	if (wall < WL_ERASE || wall >= UI_WALLCOUNT || wall == WL_FAN || wall == WL_GRAV || wall == WL_ERASEALL) return;
	auto const cellRadius = std::max(0, radius) / CELL;
	auto const centerX = x / CELL;
	auto const centerY = y / CELL;
	for (int wallY = std::max(0, centerY - cellRadius); wallY <= std::min(YCELLS - 1, centerY + cellRadius); ++wallY)
	{
		for (int wallX = std::max(0, centerX - cellRadius); wallX <= std::min(XCELLS - 1, centerX + cellRadius); ++wallX)
		{
			simulation->bmap[wallY][wallX] = wall;
			RefreshAirBlockCell(wallY, wallX);
		}
	}
}
__attribute__((visibility("default"))) int powder_apply_tool(int tool, int x, int y, int radius, int deltaX, int deltaY)
{
	EnsureSimulation();
	if (x < 0 || y < 0 || x >= XRES || y >= YRES || radius < 0 || radius > 64) return -1;
	if (tool < STILLROOM_TOOL_AIR || tool > STILLROOM_TOOL_COOL) return -1;
	if (tool == STILLROOM_TOOL_WIND && (deltaX < -XRES || deltaX > XRES || deltaY < -YRES || deltaY > YRES)) return -1;
	if (tool == STILLROOM_TOOL_WIND && !deltaX && !deltaY) return 0;
	if (tool == STILLROOM_TOOL_WIND && !windPending)
	{
		// AIR_VELOCITYOFF intentionally leaves particle-authored vx/vy behind after
		// UpdateParticles. A new Wind gesture owns its one AIR_ON frame, so discard
		// those inactive residuals before accumulating the authored drag segments.
		for (int airY = 0; airY < YCELLS; ++airY)
		{
			std::fill_n(simulation->vx[airY], XCELLS, 0.0f);
			std::fill_n(simulation->vy[airY], XCELLS, 0.0f);
		}
	}
	int applied = 0;
	auto const radiusSquared = radius * radius;
	for (int targetY = std::max(0, y - radius); targetY <= std::min(YRES - 1, y + radius); ++targetY)
	{
		for (int targetX = std::max(0, x - radius); targetX <= std::min(XRES - 1, x + radius); ++targetX)
		{
			auto const offsetX = targetX - x;
			auto const offsetY = targetY - y;
			if (offsetX * offsetX + offsetY * offsetY > radiusSquared) continue;
			auto const airX = targetX / CELL;
			auto const airY = targetY / CELL;
			if (tool == STILLROOM_TOOL_AIR || tool == STILLROOM_TOOL_VACUUM)
			{
				auto const pressureDelta = tool == STILLROOM_TOOL_AIR ? 0.05f : -0.05f;
				simulation->pv[airY][airX] = std::clamp(simulation->pv[airY][airX] + pressureDelta, MIN_PRESSURE, MAX_PRESSURE);
				++applied;
			}
			else if (tool == STILLROOM_TOOL_WIND)
			{
				simulation->vx[airY][airX] += deltaX * 0.01f;
				simulation->vy[airY][airX] += deltaY * 0.01f;
				++applied;
			}
			else if (auto *part = ParticleAt(targetX, targetY))
			{
				auto const magnitude = (part->type == PT_PUMP || part->type == PT_GPMP) ? 0.1f : 2.0f;
				auto const temperatureDelta = tool == STILLROOM_TOOL_HEAT ? magnitude : -magnitude;
				part->temp = std::clamp(part->temp + temperatureDelta, 0.0f, MAX_TEMP);
				++applied;
			}
		}
	}
	if (tool == STILLROOM_TOOL_WIND && applied)
	{
		// Match upstream WIND storage so paused native saves retain the authored
		// vector. The next step enables velocity processing for exactly one frame.
		windPending = true;
		simulation->air->airMode = AIR_ON;
	}
	return applied;
}
__attribute__((visibility("default"))) void powder_step()
{
	EnsureSimulation();
	simulation->air->airMode = windPending ? AIR_ON : AIR_VELOCITYOFF;
	simulation->BeforeSim(true);
	// Ordinary headless air velocity remains disabled for stable liquid settling,
	// but authored WIND has now passed through TPT's diffusion, pressure coupling,
	// clamping, and air-blocking wall logic before particle advection.
	simulation->air->airMode = AIR_VELOCITYOFF;
	windPending = false;
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
		save->stillroomWindPending = windPending;
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
		auto candidate = Simulation::Factory();
		candidate->Load(&save, true, { 0, 0 });
		candidate->frameCount = save.frameCount;
		candidate->currentTick = int(save.frameCount & 0x7FFFFFFF);
		if (save.hasRngState) candidate->rng.state(save.rngState);
		else candidate->rng.seed(STILLROOM_SEED);
		candidate->ensureDeterminism = true;
		auto const candidateWindPending = save.stillroomWindPending;
		candidate->air->airMode = candidateWindPending ? AIR_ON : AIR_VELOCITYOFF;
		candidate->air->vorticityCoeff = 0.0f;
		simulation = std::move(candidate);
		windPending = candidateWindPending;
		ExtractFields();
		return 1;
	}
	catch (...) { return 0; }
}
}
