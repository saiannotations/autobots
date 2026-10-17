import { generateAll } from './texgen';

self.onmessage = (e: MessageEvent<{ hi: boolean }>) => {
  const list = generateAll(e.data.hi);
  const transfer: ArrayBuffer[] = [];
  for (const t of list) { transfer.push(t.albedo.buffer as ArrayBuffer, t.normal.buffer as ArrayBuffer); }
  (self as unknown as Worker).postMessage(list, transfer);
};
