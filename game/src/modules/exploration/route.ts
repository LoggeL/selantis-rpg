import type { NavigationContext, Pt } from "./navigation";

export type RouteHead = { destination?: Pt; remaining: Pt[] };
/** Immutable route arrival lets scenes apply their own interaction/exit policies. */
export function advanceWalkingRoute(route: readonly Pt[]): RouteHead {
  return { destination: route[0], remaining: route.slice(1) };
}

export function withinInteractionRange(from: Pt, at: Pt, radius: number): boolean {
  return Math.hypot(from[0] - at[0], from[1] - at[1]) <= radius;
}

/** Search the complete interaction circle when the nearest edge is disconnected. */
export function findInteractionPath(context: NavigationContext, from: Pt, goal: Pt, radius: number): Pt[] {
  let path = context.findPath(from, goal, radius);
  if (path.length && withinInteractionRange(path.at(-1)!, goal, radius)) return path;
  const toward = Math.atan2(from[1] - goal[1], from[0] - goal[0]);
  for (const distance of [radius * 0.85, radius * 0.55, radius * 0.25]) {
    for (let i = 0; i < 32; i++) {
      const angle = toward + i * Math.PI / 16;
      const approach: Pt = [goal[0] + Math.cos(angle) * distance, goal[1] + Math.sin(angle) * distance];
      if (!context.walkable(...approach)) continue;
      path = context.findPath(from, approach, 0);
      if (path.length) return path;
    }
  }
  return [];
}
