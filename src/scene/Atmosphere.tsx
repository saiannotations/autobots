import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { sim } from '../sim/instance';
import { env, blendEnv } from './envState';
import { U, NOISE_GLSL, getMats, WATER_U } from '../gfx/materials';
import { grade } from './Effects';
import { quality } from '../ui/store';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (v: number) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };

function makeSky() {
  const sky = new Sky();
  sky.scale.setScalar(2500);
  const u = sky.material.uniforms;
  u.mieDirectionalG.value = 0.82;
  u.uSkyGain = { value: 1.6 }; u.uSkySat = { value: 1.3 };
  sky.material.fragmentShader = 'uniform float uSkyGain,uSkySat;\n' + sky.material.fragmentShader.replace(
    'gl_FragColor = vec4( retColor, 1.0 );',
    'retColor=mix(vec3(dot(retColor,vec3(0.2126,0.7152,0.0722))),retColor,uSkySat)*uSkyGain;gl_FragColor = vec4( retColor, 1.0 );');
  return sky;
}

const cloudShader = {
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: NOISE_GLSL + /* glsl */`
  uniform float uCover,uOpacity;uniform vec3 uLit,uShade;uniform vec2 uWindOff;varying vec2 vUv;
  float fbm(vec2 p){float s=0.0,a=0.5;for(int i=0;i<6;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=0.5;}return s;}
  void main(){vec2 p=vUv*9.0+uWindOff;float n=fbm(p);float n2=fbm(p*2.3+3.1+uWindOff*0.5);float d=n*0.72+n2*0.28;
    float c=smoothstep(1.0-uCover-0.05,1.0-uCover+0.28,d);float edge=smoothstep(0.5,0.18,length(vUv-0.5));
    float self=smoothstep(0.2,0.95,d+0.12);vec3 col=mix(uShade,uLit,self);gl_FragColor=vec4(col,c*edge*uOpacity);}`,
};

export function Atmosphere() {
  const { gl, scene, camera } = useThree();
  const controls = useThree(s => s.controls) as any;
  const sun = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const lamps = useRef<THREE.PointLight[]>([]);

  const sky = useMemo(makeSky, []);
  const envScene = useMemo(() => { const s = new THREE.Scene(); const m = new THREE.Mesh(sky.geometry, sky.material); m.scale.setScalar(100); s.add(m); return s; }, [sky]);
  const pmrem = useMemo(() => new THREE.PMREMGenerator(gl), [gl]);
  const envState = useRef({ rt: null as THREE.WebGLRenderTarget | null, t: 99, sun: new THREE.Vector3(9, 9, 9), cloud: -1 });

  const cloudMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uCover: { value: 0.3 }, uLit: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.6, 0.65, 0.7) }, uOpacity: { value: 1 }, uWindOff: { value: new THREE.Vector2() } },
    ...cloudShader,
  }), []);

  const stars = useMemo(() => {
    const n = 2200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.acos(0.05 + Math.random() * 0.95);
      pos.set([Math.sin(v) * Math.cos(u) * 1400, Math.cos(v) * 1400, Math.sin(v) * Math.sin(u) * 1400], i * 3);
      const t = Math.random(); const b = 0.5 + Math.pow(Math.random(), 3) * 2.5; col.set([b * (t < 0.2 ? 1 : 0.9), b * 0.95, b * (t > 0.8 ? 1.15 : 1)], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false });
    return new THREE.Points(g, m);
  }, []);
  const moon = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!;
    const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,248,1)'); gr.addColorStop(0.16, 'rgba(246,246,236,1)'); gr.addColorStop(0.2, 'rgba(210,222,255,.4)'); gr.addColorStop(0.45, 'rgba(180,200,255,.08)'); gr.addColorStop(1, 'rgba(180,200,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgba(200,200,190,.35)';
    for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(128 + (Math.random() - 0.5) * 30, 128 + (Math.random() - 0.5) * 30, 3 + Math.random() * 6, 0, Math.PI * 2); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, fog: false, depthWrite: false, opacity: 0, color: new THREE.Color(4, 4, 4) }));
    s.scale.setScalar(170); return s;
  }, []);

  useEffect(() => { scene.fog = new THREE.FogExp2(0xbcd3e6, 0.002); return () => { scene.fog = null; }; }, [scene]);
  useEffect(() => () => { envState.current.rt?.dispose(); pmrem.dispose(); }, [pmrem]);

  const tv = useMemo(() => new THREE.Vector3(), []);
  const ct = useMemo(() => new THREE.Color(), []);
  const ct2 = useMemo(() => new THREE.Color(), []);
  const cNight = useMemo(() => new THREE.Color(0x0a1120), []);
  const cDusk = useMemo(() => new THREE.Color(0xe39a6b), []);
  const light = useRef({ lightning: 0, timer: 8 });

  useFrame((state, rdt) => {
    const dt = Math.min(rdt, 0.1) * sim.speed;
    U.uTime.value += Math.min(rdt, 0.1);
    blendEnv(sim.season, dt);
    const E = env.n; const M = getMats();
    const h = sim.hour; env.hour = h;
    const dayF = (h - 6) / 14;
    const elev = h >= 6 && h <= 20 ? Math.sin(dayF * Math.PI) : -Math.min(1, Math.min(Math.abs(h - 6), Math.abs(h - 20), Math.abs(h + 4)) / 3) * 0.4;
    const az = lerp(-1.9, 1.9, clamp(dayF, 0, 1));
    env.sunDir.set(Math.sin(az) * Math.sqrt(Math.max(0, 1 - elev * elev)), elev, -Math.cos(az) * 0.55).normalize();
    const daylight = smooth((elev + 0.08) / 0.35); const night = 1 - daylight;
    const dusk = smooth(1 - Math.abs(elev) / 0.28) * (h > 4 && h < 22 ? 1 : 0);
    env.daylight = daylight; env.night = night; env.dusk = dusk;

    const su = sky.material.uniforms;
    su.sunPosition.value.copy(env.sunDir); su.turbidity.value = E.turb; su.rayleigh.value = E.ray * (0.3 + 0.7 * daylight) + 0.05; su.mieCoefficient.value = E.mie;

    const target = controls?.target ?? new THREE.Vector3(0, 0, -6);
    const sd = daylight > 0.02 ? env.sunDir : tv.set(-env.sunDir.x, Math.max(0.35, -env.sunDir.y), -env.sunDir.z).normalize();
    sun.current.position.copy(target).addScaledVector(sd, 110); sun.current.target.position.copy(target); sun.current.target.updateMatrixWorld();
    sun.current.color.setRGB(1, 0.95, 0.88).lerp(ct.setRGB(1, 0.58, 0.32), dusk * 0.85).lerp(ct.setRGB(0.5, 0.62, 1), night);
    sun.current.intensity = Math.PI * lerp(0.25, E.sun * (0.3 + 0.7 * smooth(elev / 0.35)), daylight);
    hemi.current.intensity = Math.PI * lerp(0.18, E.hemi * 0.8, daylight);
    hemi.current.color.setRGB(0.78, 0.86, 1).lerp(ct.setRGB(0.3, 0.4, 0.68), night);
    hemi.current.groundColor.copy(env.grass).multiplyScalar(0.3);

    const fog = scene.fog as THREE.FogExp2;
    ct.copy(env.fogDay).lerp(cDusk, dusk * 0.45 * (1 - E.cloud * 0.7)).lerp(cNight, night);
    fog.color.copy(ct); fog.density = E.fog * (1 + night * 0.3);

    const cu = cloudMat.uniforms;
    cu.uCover.value = E.cloud * 0.85 + 0.08;
    (cu.uLit.value as THREE.Color).setRGB(1, 0.97, 0.93).lerp(ct2.setRGB(1, 0.68, 0.48), dusk * 0.6).multiplyScalar(lerp(0.05, 1.5, daylight) * lerp(1, 0.6, E.cloud));
    (cu.uShade.value as THREE.Color).copy(cu.uLit.value as THREE.Color).multiplyScalar(lerp(0.72, 0.48, E.cloud));
    (cu.uWindOff.value as THREE.Vector2).x += dt * 0.004 * (0.4 + E.wind);

    (stars.material as THREE.PointsMaterial).opacity = night * (1 - E.cloud * 0.92);
    (moon.material as THREE.SpriteMaterial).opacity = night * (1 - E.cloud * 0.8);
    moon.position.copy(camera.position).addScaledVector(tv.set(-env.sunDir.x, Math.max(0.3, -env.sunDir.y), -env.sunDir.z).normalize(), 1200);

    const lamp = smooth((0.45 - daylight) / 0.35) + E.rain * 0.15 * daylight;
    lamps.current.forEach(l => { if (l) l.intensity = lamp * 9; });
    M.bulb.emissiveIntensity = lamp * 5;

    M.ground.color.copy(env.grass); M.orchard.color.copy(env.grass); M.treeLeaf.color.copy(env.leaf);
    U.uWind.value = E.wind; U.uSnow.value = env.snowCover; U.uWet.value = E.wet; U.uGrassH.value = E.grassH;

    const fr = E.frozen; const w = M.water;
    w.color.setRGB(0.025, 0.09, 0.12).lerp(ct.setRGB(0.72, 0.8, 0.86), fr);
    w.roughness = lerp(0.06, 0.32, fr); w.normalScale.setScalar(lerp(0.12 + E.wind * 0.06, 0.03, fr)); w.opacity = lerp(0.93, 1, fr);
    WATER_U.uOff1.value.x += dt * 0.012 * (1 - fr) * (0.5 + E.wind); WATER_U.uOff1.value.y += dt * 0.007 * (1 - fr);
    WATER_U.uOff2.value.x -= dt * 0.009 * (1 - fr); WATER_U.uOff2.value.y += dt * 0.011 * (1 - fr) * (0.5 + E.wind);

    const L = light.current;
    if (E.rain > 0.6) { L.timer -= dt; if (L.timer <= 0) { L.lightning = 1; L.timer = 9 + Math.random() * 14; } }
    L.lightning = Math.max(0, L.lightning - dt * 3.2);
    env.flash = L.lightning > 0 ? Math.max(0, Math.sin(L.lightning * 20)) * L.lightning : 0;

    grade.exposure = 0.56 * E.exp * lerp(2.5, 1, daylight);
    grade.saturation = E.sat * lerp(0.75, 1, daylight);
    grade.haze = env.n.haze * daylight;
    grade.flash = env.flash * 0.4;
    grade.tint.copy(env.tint).lerp(tv.set(0.8, 0.9, 1.18), night * 0.8);
    grade.bloom = E.bloom * (1 + night * 0.7);

    // Image-based lighting from the live sky, refreshed as the sun moves.
    const es = envState.current; es.t += rdt; const cq = Math.round(E.cloud * 20);
    if (es.t > 1.5 && (env.sunDir.distanceTo(es.sun) > 0.03 || cq !== es.cloud)) {
      es.t = 0; es.sun.copy(env.sunDir); es.cloud = cq;
      const rt = pmrem.fromScene(envScene, 0, 0.1, 1000); es.rt?.dispose(); es.rt = rt; scene.environment = rt.texture;
      scene.environmentIntensity = lerp(0.12, 0.55, daylight) * lerp(1, 0.75, E.cloud);
    }
    const sm = quality.shadowMap;
    if (sun.current.shadow.mapSize.x !== sm) { sun.current.shadow.mapSize.set(sm, sm); sun.current.shadow.map?.dispose(); (sun.current.shadow as any).map = null; }
  }, -1);

  return (
    <>
      <primitive object={sky} />
      <primitive object={stars} />
      <primitive object={moon} />
      <mesh material={cloudMat} rotation={[Math.PI / 2, 0, 0]} position={[0, 170, 0]} renderOrder={-1}>
        <planeGeometry args={[3200, 3200]} />
      </mesh>
      <directionalLight ref={sun} castShadow intensity={3} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-normalBias={0.035}
        shadow-camera-left={-55} shadow-camera-right={55} shadow-camera-top={55} shadow-camera-bottom={-55} shadow-camera-near={1} shadow-camera-far={280} />
      <hemisphereLight ref={hemi} args={[0xcfe3ff, 0x5a6b45, 0.6]} />
      {[[-7, 3.6, 8], [7, 3.6, 8], [0, 3.2, 2.6]].map((p, i) => (
        <pointLight key={i} ref={el => { if (el) lamps.current[i] = el; }} position={p as [number, number, number]} color={0xffc27a} intensity={0} distance={22} decay={1.6} />
      ))}
    </>
  );
}
