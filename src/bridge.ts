import { createClient, type TreasureClient } from './client';
import { ProductionBridge } from './bridge-impl/production';
import type { BridgeTransport } from './transport';

let transport: BridgeTransport | null = null;
let client: TreasureClient | null = null;

/** Initializes the SDK's typed 2.0 client. */
export function initTreasure(): TreasureClient {
  if (client) return client;
  // Plugins have one runtime: an iframe hosted by Treasure. The local Vite
  // server is only the source served to a registered debug plugin; it is not
  // a browser-host simulator.
  transport = new ProductionBridge();
  // Native dialogs are user-paced. They must remain pending until the user
  // explicitly confirms, cancels or closes the system window.
  client = createClient((operation, payload) => transport!.call(operation, payload, operation === 'files.openDialog' || operation === 'files.saveDialog' ? 0 : undefined), transport);
  return client;
}

/** Returns the typed client after initTreasure has been called. */
export function getTreasure(): TreasureClient {
  if (!client) throw new Error('Treasure 未初始化，请先调用 initTreasure()');
  return client;
}

export function destroyTreasure() {
  transport?.destroy?.();
  transport = null;
  client = null;
}
