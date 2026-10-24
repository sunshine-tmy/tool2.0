import type { ComponentPackageStatus } from "@toolbox/shared/system";

/** Pure display projection; it never installs capabilities or changes their health. */
export function getToolComponentReadiness(toolId: string, components: ComponentPackageStatus[]) {
  const byId = new Map(components.map((component) => [component.id, component]));
  const requiredIds = new Set<string>();
  const unresolvedIds = new Set<string>();
  const visit = (componentId: string) => {
    if (requiredIds.has(componentId)) return;
    requiredIds.add(componentId);
    const component = byId.get(componentId);
    if (!component) {
      unresolvedIds.add(componentId);
      return;
    }
    for (const dependencyId of component.dependencyIds) visit(dependencyId);
  };

  const direct = components.filter((component) => component.taskToolIds.includes(toolId));
  direct.forEach((component) => visit(component.id));
  const required = [...requiredIds]
    .map((id) => byId.get(id))
    .filter((item): item is ComponentPackageStatus => Boolean(item));
  const missing = required.filter(
    (component) => !component.installed || component.health !== "healthy" || component.state !== "ready"
  );
  return { registered: direct.length > 0, required, missing, unresolvedIds: [...unresolvedIds] };
}
