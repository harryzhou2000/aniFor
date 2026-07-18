import type { Point } from '../renderer/view-transform';
import type { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import type { SimToolInfo, WallToolInfo } from '../ui/tool-catalog';

export interface ActiveToolSelection {
  readonly material: Material;
  readonly wallTool?: WallToolInfo;
  readonly simulationTool?: SimToolInfo;
  readonly radius: number;
}

/** Routes one sampled brush point without collapsing semantic tools into particles. */
export function drawToolPoint(
  simulation: SimulationBackend,
  point: Point,
  selection: ActiveToolSelection,
  erase: boolean,
): void {
  if (selection.wallTool) {
    if (simulation.paintWall && simulation.eraseWall) {
      if (erase) simulation.eraseWall(point.x, point.y, selection.radius + 1);
      else simulation.paintWall(point.x, point.y, selection.wallTool.nativeWall, selection.radius);
    }
    return;
  }
  if (erase) {
    simulation.erase(point.x, point.y, selection.radius + 1);
    return;
  }
  if (selection.simulationTool) {
    if (selection.simulationTool.gesture === 'brush') {
      simulation.applySimulationTool?.(
        selection.simulationTool.nativeTool, point.x, point.y, selection.radius,
      );
    }
    // Vector tools act on raw segments only. In particular, they must never
    // fall through and paint the previously selected particle material.
    return;
  }
  simulation.paint(point.x, point.y, selection.material, selection.radius);
}

/** Routes the un-interpolated drag vector used by native vector tools. */
export function drawToolSegment(
  simulation: SimulationBackend,
  start: Point,
  end: Point,
  selection: ActiveToolSelection,
  erase: boolean,
): void {
  if (erase || selection.simulationTool?.gesture !== 'vector') return;
  simulation.applySimulationTool?.(
    selection.simulationTool.nativeTool, start.x, start.y, selection.radius,
    end.x - start.x, end.y - start.y,
  );
}
