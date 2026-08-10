// SPDX-License-Identifier: GPL-3.0-only
// Synchronous Emscripten adaptation of The Powder Toy's FFT gravity solver.
// The desktop implementation delegates the transform to a worker thread; the
// headless browser core deliberately stays single-threaded, so Exchange owns
// the same FFT convolution directly at the simulation step boundary.

#include "simulation/gravity/Gravity.h"
#include "SimulationConfig.h"

#include <algorithm>
#include <cmath>
#include <complex>
#include <cstring>
#include <fftw3.h>
#include <memory>
#include <utility>

namespace
{
constexpr auto blocks = CELLS * 2;
constexpr auto transSize = (blocks.X / 2 + 1) * blocks.Y;
constexpr auto scaleFactor = -float(M_GRAV) / (NCELL * 4);

static_assert(sizeof(std::complex<float>) == sizeof(fftwf_complex));

struct FftwArrayDeleter
{
	void operator ()(float pointer[]) const { fftwf_free(pointer); }
};
struct FftwComplexArrayDeleter
{
	void operator ()(std::complex<float> pointer[]) const { fftwf_free(pointer); }
};
struct FftwPlanDeleter
{
	void operator ()(fftwf_plan pointer) const { fftwf_destroy_plan(pointer); }
};

using FftwArrayPtr = std::unique_ptr<float[], FftwArrayDeleter>;
using FftwComplexArrayPtr = std::unique_ptr<std::complex<float>[], FftwComplexArrayDeleter>;
using FftwPlanPtr = std::unique_ptr<std::remove_pointer<fftwf_plan>::type, FftwPlanDeleter>;

FftwArrayPtr FftwArray(size_t size)
{
	return FftwArrayPtr(reinterpret_cast<float *>(fftwf_malloc(size * sizeof(float))));
}

FftwComplexArrayPtr FftwComplexArray(size_t size)
{
	return FftwComplexArrayPtr(reinterpret_cast<std::complex<float> *>(
		fftwf_malloc(size * sizeof(std::complex<float>))));
}

struct GravityImpl final : public Gravity
{
	FftwArrayPtr massBig, forceXBig, forceYBig;
	FftwComplexArrayPtr kernelXT, kernelYT, massBigT, forceXBigT, forceYBigT;
	FftwPlanPtr massForward, forceXInverse, forceYInverse;
	GravityInput previousInput;
	GravityOutput solvedOutput;
	bool initialized = false;
	bool hasPreviousInput = false;
	bool outputPending = false;

	void Init();
	void Solve(GravityInput const &input, GravityOutput &output);
};

void GravityImpl::Init()
{
	kernelXT = FftwComplexArray(transSize);
	kernelYT = FftwComplexArray(transSize);
	massBig = FftwArray(blocks.X * blocks.Y);
	massBigT = FftwComplexArray(transSize);
	forceXBig = FftwArray(blocks.X * blocks.Y);
	forceYBig = FftwArray(blocks.X * blocks.Y);
	forceXBigT = FftwComplexArray(transSize);
	forceYBigT = FftwComplexArray(transSize);

	// FFTW_MEASURE is unreliable under Emscripten and makes first use needlessly
	// expensive. This is the same platform choice as upstream TPT.
	constexpr auto flags = FFTW_ESTIMATE;
	massForward = FftwPlanPtr(fftwf_plan_dft_r2c_2d(
		blocks.Y, blocks.X, massBig.get(), reinterpret_cast<fftwf_complex *>(massBigT.get()), flags));
	forceXInverse = FftwPlanPtr(fftwf_plan_dft_c2r_2d(
		blocks.Y, blocks.X, reinterpret_cast<fftwf_complex *>(forceXBigT.get()), forceXBig.get(), flags));
	forceYInverse = FftwPlanPtr(fftwf_plan_dft_c2r_2d(
		blocks.Y, blocks.X, reinterpret_cast<fftwf_complex *>(forceYBigT.get()), forceYBig.get(), flags));

	auto kernelXRaw = FftwArray(blocks.X * blocks.Y);
	auto kernelYRaw = FftwArray(blocks.X * blocks.Y);
	auto kernelXForward = FftwPlanPtr(fftwf_plan_dft_r2c_2d(
		blocks.Y, blocks.X, kernelXRaw.get(), reinterpret_cast<fftwf_complex *>(kernelXT.get()), flags));
	auto kernelYForward = FftwPlanPtr(fftwf_plan_dft_r2c_2d(
		blocks.Y, blocks.X, kernelYRaw.get(), reinterpret_cast<fftwf_complex *>(kernelYT.get()), flags));

	auto kernelX = MakePlane<blocks.X, blocks.Y>(blocks, kernelXRaw.get());
	auto kernelY = MakePlane<blocks.X, blocks.Y>(blocks, kernelYRaw.get());
	for (auto point : blocks.OriginRect())
	{
		auto delta = point - CELLS;
		if (delta == Vec2{ 0, 0 })
		{
			kernelX[point] = 0.0f;
			kernelY[point] = 0.0f;
		}
		else
		{
			auto distance = std::hypot(float(delta.X), float(delta.Y));
			auto distanceCubed = distance * distance * distance;
			kernelX[point] = scaleFactor * delta.X / distanceCubed;
			kernelY[point] = scaleFactor * delta.Y / distanceCubed;
		}
	}

	fftwf_execute(kernelXForward.get());
	fftwf_execute(kernelYForward.get());
	initialized = true;
}

void GravityImpl::Solve(GravityInput const &input, GravityOutput &output)
{
	std::fill(massBig.get(), massBig.get() + blocks.X * blocks.Y, 0.0f);
	auto massPlane = MakePlane<blocks.X, blocks.Y>(blocks, massBig.get());
	for (auto point : CELLS.OriginRect())
		massPlane[point + CELLS] = input.mask[point] ? input.mass[point] : 0.0f;

	fftwf_execute(massForward.get());
	for (int index = 0; index < transSize; ++index)
	{
		forceXBigT[index] = massBigT[index] * kernelXT[index];
		forceYBigT[index] = massBigT[index] * kernelYT[index];
	}
	fftwf_execute(forceXInverse.get());
	fftwf_execute(forceYInverse.get());

	auto forceXPlane = MakePlane<blocks.X, blocks.Y>(blocks, forceXBig.get());
	auto forceYPlane = MakePlane<blocks.X, blocks.Y>(blocks, forceYBig.get());
	for (auto point : CELLS.OriginRect())
	{
		output.forceX[point] = input.mask[point] ? forceXPlane[point] : 0.0f;
		output.forceY[point] = input.mask[point] ? forceYPlane[point] : 0.0f;
	}
}
}

void Gravity::Exchange(GravityOutput &gravOut, GravityInput &gravIn, bool forceRecalc)
{
	auto *implementation = static_cast<GravityImpl *>(this);
	if (!implementation->initialized)
	{
		auto const *massBegin = &gravIn.mass[{ 0, 0 }];
		// Merely exposing the capability must not make every ordinary world pay
		// the FFT allocation/planning cost. Native sources populate this plane
		// during particle update; initialize on their first nonzero exchange.
		if (std::none_of(massBegin, massBegin + NCELL, [](float mass) { return mass != 0.0f; }))
			return;
		implementation->Init();
	}
	// Match upstream's asynchronous exchange contract: one exchange publishes
	// the prior solve, then this exchange prepares the current field for the
	// following simulation step.
	if (implementation->outputPending)
	{
		std::swap(gravOut, implementation->solvedOutput);
		implementation->outputPending = false;
	}

	auto const massBytes = NCELL * sizeof(float);
	auto const maskBytes = NCELL * sizeof(uint32_t);
	auto changed = forceRecalc || !implementation->hasPreviousInput
		|| std::memcmp(&implementation->previousInput.mass[{ 0, 0 }], &gravIn.mass[{ 0, 0 }], massBytes)
		|| std::memcmp(&implementation->previousInput.mask[{ 0, 0 }], &gravIn.mask[{ 0, 0 }], maskBytes);
	if (!changed)
		return;

	std::memcpy(&implementation->previousInput.mass[{ 0, 0 }], &gravIn.mass[{ 0, 0 }], massBytes);
	std::memcpy(&implementation->previousInput.mask[{ 0, 0 }], &gravIn.mask[{ 0, 0 }], maskBytes);
	implementation->hasPreviousInput = true;
	implementation->Solve(gravIn, implementation->solvedOutput);
	implementation->outputPending = true;
}

GravityPtr Gravity::Create()
{
	return GravityPtr(new GravityImpl());
}

void GravityDeleter::operator ()(Gravity *pointer) const
{
	delete static_cast<GravityImpl *>(pointer);
}
