import * as THREE from 'three';
import type { Textures, TexSet } from './textures';
import { repeated } from './textures';

/** Uniforms shared by every patched material: wind, snow cover, wetness, time. */
export const U = {
  uTime: { value: 0 },
  uWind: { value: 0.5 },
  uSnow: { value: 0 },
  uWet: { value: 0 },
  uGrassH: { value: 1 },
};

export const NOISE_GLSL = /* glsl */ `
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
`;

export interface EnhanceOpts { snow?: number; sway?: number; grass?: boolean; wet?: number }

/** Adds wind sway, snow accumulation and rain wetness to a standard/physical material. */
export function enhance<T extends THREE.MeshStandardMaterial>(m: T, o: EnhanceOpts = {}): T {
  const snowK = o.snow ?? 1, sway = o.sway ?? 0, grass = !!o.grass, wetK = o.wet ?? 1;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { ...U, uSnowK: { value: snowK }, uSway: { value: sway }, uWetK: { value: wetK } });
    sh.vertexShader = 'uniform float uTime,uWind,uSway,uGrassH;\nvarying vec3 vWN;\nvarying vec3 vWP;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        ${grass ? 'objectNormal=vec3(0.0,1.0,0.0);' : ''}
        vec3 wN0=objectNormal;
        #ifdef USE_INSTANCING
        wN0=mat3(instanceMatrix)*wN0;
        #endif
        vWN=normalize(mat3(modelMatrix)*wN0);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${grass ? 'transformed.y*=uGrassH;' : ''}
        {
          mat4 MM=modelMatrix;
          #ifdef USE_INSTANCING
          MM=modelMatrix*instanceMatrix;
          #endif
          vec4 wp0=MM*vec4(transformed,1.0);
          if(uSway>0.0){
            float h=${grass ? 'pow(clamp(position.y/0.7,0.0,1.0),1.6)' : 'max(position.y,0.0)'};
            float ph=wp0.x*0.19+wp0.z*0.23;
            float gust=sin(uTime*0.45+wp0.x*0.05-wp0.z*0.03)*0.5+0.5;
            float g=sin(uTime*1.3+ph)*0.55+sin(uTime*2.9+ph*1.9)*0.25+gust*0.6;
            vec3 off=vec3(1.0,0.0,0.4)*(uWind*0.7+g*(0.2+uWind*0.6))*uSway*h;
            off+=vec3(sin(uTime*8.0+ph*6.0),0.0,cos(uTime*7.0+ph*5.0))*0.025*uSway*h*(0.3+uWind);
            vec3 c0=MM[0].xyz,c1=MM[1].xyz,c2=MM[2].xyz;float s2=max(dot(c0,c0),1e-4);
            transformed+=vec3(dot(c0,off),dot(c1,off),dot(c2,off))/s2;
            wp0=MM*vec4(transformed,1.0);
          }
          vWP=wp0.xyz;
        }`);
    sh.fragmentShader = 'uniform float uSnow,uWet,uSnowK,uWetK,uTime;\nvarying vec3 vWN;\nvarying vec3 vWP;\n' + NOISE_GLSL + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float snowA=0.0;
        if(uSnow*uSnowK>0.001){
          float nn=vn(vWP.xz*1.3)*0.6+vn(vWP.xz*6.0)*0.4;
          snowA=smoothstep(0.45,0.75,vWN.y*0.85+nn*0.35-(1.0-uSnow)*1.1)*uSnowK;
          float sparkle=step(0.985,hsh(floor(vWP.xz*40.0)))*0.15;
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.78,0.81,0.86)*(0.92+0.08*nn)+sparkle,snowA);
        }
        float wetA=uWet*uWetK*(1.0-snowA);
        float puddle=smoothstep(0.62,0.7,vn(vWP.xz*0.35)+vn(vWP.xz*1.7)*0.2)*smoothstep(0.85,0.98,vWN.y);
        diffuseColor.rgb*=1.0-0.32*wetA-0.25*wetA*puddle;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,roughnessFactor*0.45,wetA*smoothstep(0.3,0.9,vWN.y));
        roughnessFactor=mix(roughnessFactor,0.05,wetA*puddle);
        roughnessFactor=mix(roughnessFactor,0.8,snowA);`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        ${grass ? 'normal=normalize((viewMatrix*vec4(0.0,1.0,0.0,0.0)).xyz);' : ''}`);
  };
  m.customProgramCacheKey = () => 'enh' + (grass ? 'g' : '') + (sway ? 's' : '');
  return m;
}

export function pbr(set: TexSet | null, p: THREE.MeshStandardMaterialParameters = {}, o?: EnhanceOpts) {
  const m = new THREE.MeshStandardMaterial({ ...(set ? { map: set.map, normalMap: set.normal, roughnessMap: set.rough } : {}), ...p });
  return enhance(m, o);
}

/** Water with two scrolling normal layers; turns into ice in winter. */
export const WATER_U = { uOff1: { value: new THREE.Vector2() }, uOff2: { value: new THREE.Vector2() } };
export function waterMaterial(normal: THREE.Texture) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0x0b2a33, roughness: 0.06, metalness: 0, normalMap: normal, normalScale: new THREE.Vector2(0.14, 0.14), transparent: true, opacity: 0.94, envMapIntensity: 0.55 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, WATER_U);
    sh.fragmentShader = 'uniform vec2 uOff1,uOff2;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `
      vec3 mapN=texture2D(normalMap,vNormalMapUv+uOff1).xyz*2.0-1.0;
      vec3 mapN2=texture2D(normalMap,vNormalMapUv*1.73+uOff2).xyz*2.0-1.0;
      mapN=normalize(vec3(mapN.xy+mapN2.xy,mapN.z*mapN2.z));mapN.xy*=normalScale;
      normal=normalize(tbn*mapN);`);
  };
  m.customProgramCacheKey = () => 'water';
  return m;
}

export type Mats = ReturnType<typeof buildMaterials>;
let current: Mats | null = null;
export const getMats = () => current!;

export function buildMaterials(T: Textures) {
  const grassGround = repeated(T.grass, 70), orchard = repeated(T.grass, 1), soil = repeated(T.soil, 1), stone = repeated(T.stone, 4, 2.2),
    path = repeated(T.path, 1), wood = repeated(T.wood, 1), bark = repeated(T.bark, 2, 1), leaf = repeated(T.leaf, 2), barn = repeated(T.barn, 3, 1),
    metal = repeated(T.metal, 4, 1), knit = repeated(T.knit, 3), fabric = repeated(T.fabric, 2), paint = repeated(T.paint, 1), rock = repeated(T.stone, 1);
  const waterN = repeated(T.water, 4).map;
  const M = {
    ground: pbr(grassGround, { normalScale: new THREE.Vector2(0.9, 0.9), color: 0xd2ecb0 }),
    orchard: pbr(orchard, { color: 0xd2ecb0 }),
    soil: pbr(soil, { normalScale: new THREE.Vector2(1.2, 1.2) }, { wet: 1.2 }),
    stone: pbr(stone, { normalScale: new THREE.Vector2(1.1, 1.1) }, { snow: 0.75 }),
    path: pbr(path, {}, { snow: 0.8 }),
    wood: pbr(wood, {}),
    woodDark: pbr(wood, { color: 0x8a7a6a }),
    bark: pbr(bark, { normalScale: new THREE.Vector2(1.4, 1.4) }),
    pine: pbr(leaf, { color: 0x31593a }, { sway: 0.06 }),
    treeLeaf: pbr(leaf, { color: 0xffffff }, { sway: 0.1 }),
    barn: pbr(barn, {}),
    metal: pbr(metal, { metalness: 0.75 }),
    white: pbr(paint, { color: 0xece6da, roughness: 0.55 }),
    rock: pbr(rock, { color: 0xbdb6aa, normalScale: new THREE.Vector2(1.5, 1.5) }),
    sand: pbr(path, { color: 0xe9dcc0 }),
    crop: pbr(leaf, { color: 0xffffff, side: THREE.DoubleSide }, { sway: 0.18 }),
    fruit: pbr(null, { color: 0xffffff, roughness: 0.3 }, { snow: 0.3 }),
    grain: pbr(null, { color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }, { sway: 0.18 }),
    hay: pbr(path, { color: 0xd8b96a }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.55, metalness: 0.35 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.18, metalness: 1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x07090c, roughness: 0.05, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 }),
    water: waterMaterial(waterN),
    bulb: new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc77a, emissiveIntensity: 0 }),
    tex: { knit, fabric, paint, leaf },
  };
  current = M;
  return M;
}
