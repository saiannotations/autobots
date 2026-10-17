import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ITEMS, type ItemKey } from '../sim/constants';

type Part = [THREE.BufferGeometry, THREE.Material, number, number, number, [number, number, number]?, [number, number, number]?];
const cache: Partial<Record<ItemKey, Part[]>> = {};
const std = (color: number, roughness: number, extra: THREE.MeshPhysicalMaterialParameters = {}) => new THREE.MeshPhysicalMaterial({ color, roughness, ...extra });

function parts(t: ItemKey): Part[] {
  if (cache[t]) return cache[t]!;
  let p: Part[];
  if (t === 'tomato') p = [[new THREE.SphereGeometry(0.15, 20, 14), std(0xc22f1c, 0.28, { clearcoat: 0.6, clearcoatRoughness: 0.2 }), 0, 0.13, 0, [1, 0.85, 1]], [new THREE.ConeGeometry(0.07, 0.06, 6), std(0x3d7a30, 0.7), 0, 0.27, 0]];
  else if (t === 'apple') p = [[new THREE.SphereGeometry(0.16, 20, 14), std(0xb0232a, 0.32, { clearcoat: 0.5, clearcoatRoughness: 0.25 }), 0, 0.15, 0, [1, 0.92, 1]], [new THREE.CylinderGeometry(0.012, 0.012, 0.12, 5), std(0x5b3b22, 0.8), 0, 0.33, 0]];
  else if (t === 'corn') p = [[new THREE.CapsuleGeometry(0.08, 0.32, 4, 12), std(0xe6bd3c, 0.55), 0, 0.1, 0, [1, 1, 1], [0, 0, Math.PI / 2]], [new THREE.ConeGeometry(0.1, 0.26, 7), std(0x7aa54f, 0.7), -0.3, 0.1, 0, [1, 1, 1], [0, 0, Math.PI / 2]]];
  else if (t === 'rice') p = [[new RoundedBoxGeometry(0.32, 0.36, 0.24, 2, 0.06), std(0xd9c79a, 0.95, { sheen: 1, sheenColor: new THREE.Color(0xfff2d0) }), 0, 0.18, 0], [new THREE.BoxGeometry(0.33, 0.05, 0.25), std(0x7a5230, 0.8), 0, 0.3, 0]];
  else { const col = ITEMS[t].color!; p = [[new THREE.SphereGeometry(0.2, 20, 12), std(col, 0.22, { metalness: t === 'koi' ? 0.55 : 0.1, clearcoat: 1, clearcoatRoughness: 0.1, iridescence: t === 'trout' ? 0.6 : 0 }), 0, 0.13, 0, [1.6, 0.6, 0.55]], [new THREE.ConeGeometry(0.12, 0.2, 8), std(col, 0.4), -0.36, 0.13, 0, [1, 1, 0.3], [0, 0, -Math.PI / 2]]]; }
  cache[t] = p; return p;
}

export function makeItem(t: ItemKey) {
  const g = new THREE.Group();
  for (const p of parts(t)) { const m = new THREE.Mesh(p[0], p[1]); m.position.set(p[2], p[3], p[4]); if (p[5]) m.scale.set(...p[5]); if (p[6]) m.rotation.set(...p[6]); m.castShadow = true; g.add(m); }
  return g;
}
