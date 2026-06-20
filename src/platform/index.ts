import type { PlatformPorts } from './ports';
import { createBrowserPorts } from './browserAdapters';

export async function createPlatformPorts(): Promise<PlatformPorts> {
  const isTauri = '__TAURI_INTERNALS__' in window;
  if (isTauri) {
    const { createTauriPorts } = await import('./tauriAdapters');
    return createTauriPorts();
  }

  return createBrowserPorts();
}
