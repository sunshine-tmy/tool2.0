/** Source startup uses the same verified dependency resolvers as the desktop installer. */
import { ComponentManager, type ComponentManagerOptions } from "../modules/components/component-manager";
import { createDesktopComponentSelfTest } from "../modules/components/desktop-component-self-test";

export function createSourceComponentManager(
  options: Omit<ComponentManagerOptions, "selfTest">,
  runProcess?: Parameters<typeof createDesktopComponentSelfTest>[0]
) {
  const manager: ComponentManager = new ComponentManager({
    ...options,
    selfTest: createDesktopComponentSelfTest(
      runProcess,
      async (relative) => (await manager.resolveInstalledAsset("ffmpeg", relative)).path,
      (componentId) => manager.resolveInstalledPython(componentId)
    )
  });
  return manager;
}
