import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { U } from '../gfx/materials';
import { env } from './envState';
import { excluded, srand } from './terrain';
import { POND } from '../sim/constants';
import { isLowEnd } from '../ui/store';

/* GPU particle systems: positions are computed in the vertex shader, so the CPU cost is zero. */
function points(n: number, o: { mode: number; fall: number; drift: number; wind: number; size: number; box: number; h: number; add?: boolean }) {
  const g = new THREE.BufferGeometry(); const seed = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) seed[i] = Math.random();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uTime: U.uTime, uCenter: { value: new THREE.Vector3() }, uOpacity: { value: 0 }, uLight: { value: 1 }, uPR: { value: 1 }, uWind: { value: o.wind }, uFall: { value: o.fall }, uDrift: { value: o.drift }, uSize: { value: o.size }, uBox: { value: o.box }, uH: { value: o.h }, uMode: { value: o.mode } },
    vertexShader: /* glsl */`uniform float uTime,uWind,uFall,uDrift,uSize,uBox,uH,uPR;uniform vec3 uCenter;attribute vec4 aSeed;varying float vA;varying float vRot;varying float vK;
    void main(){float t=uTime*(0.75+aSeed.w*0.5);vec3 p=vec3(aSeed.x*uBox,aSeed.y*uH,aSeed.z*uBox);
      p.y=mod(p.y-t*uFall,uH);
      p.x+=t*uWind+sin(t*1.3+aSeed.w*30.0)*uDrift;p.z+=cos(t*1.1+aSeed.x*20.0)*uDrift*0.7+t*uWind*0.25;
      float ox=uCenter.x-uBox*0.5,oz=uCenter.z-uBox*0.5;p.x=mod(p.x-ox,uBox)+ox;p.z=mod(p.z-oz,uBox)+oz;
      vec4 mv=modelViewMatrix*vec4(p,1.0);float dist=-mv.z;
      gl_PointSize=uSize*uPR*(320.0/max(dist,1.0))*(0.6+aSeed.w*0.8);gl_Position=projectionMatrix*mv;
      vA=smoothstep(uBox*0.75,uBox*0.3,dist)*smoothstep(0.5,2.0,dist)*smoothstep(0.0,1.2,p.y);
      vRot=t*(1.0+aSeed.x*3.0)+aSeed.y*6.28;vK=aSeed.z;}`,
    fragmentShader: /* glsl */`uniform float uOpacity,uLight,uMode;varying float vA;varying float vRot;varying float vK;
    void main(){vec2 pc=gl_PointCoord-0.5;float a=0.0;vec3 col=vec3(1.0);
      if(uMode<1.5){float r=length(pc);a=smoothstep(0.5,0.05,r);col=vec3(1.0)*(0.9+0.1*smoothstep(0.3,0.0,r));}
      else if(uMode<2.5){float c=cos(vRot),s=sin(vRot);vec2 q=vec2(c*pc.x-s*pc.y,s*pc.x+c*pc.y);q.y*=2.4;float l=length(q);a=smoothstep(0.42,0.34,l);
        col=vK<0.45?vec3(0.98,0.72,0.8):(vK<0.75?vec3(0.55,0.75,0.3):vec3(0.86,0.6,0.25));col*=0.7+0.3*smoothstep(0.4,0.0,abs(q.x))+0.2*sin(vRot*3.0);}
      else{a=smoothstep(0.5,0.0,length(pc))*0.55;col=vec3(1.0,0.9,0.7);}
      gl_FragColor=vec4(col*uLight,a*vA*uOpacity);if(gl_FragColor.a<0.01)discard;}`,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; p.renderOrder = 2; return p;
}

function rainLines(n: number) {
  const g = new THREE.BufferGeometry(); const seed = new Float32Array(n * 8), end = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { const s = [Math.random(), Math.random(), Math.random(), Math.random()]; seed.set(s, i * 8); seed.set(s, i * 8 + 4); end[i * 2] = 0; end[i * 2 + 1] = 1; }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: U.uTime, uCenter: { value: new THREE.Vector3() }, uOpacity: { value: 0 }, uLight: { value: 1 }, uPR: { value: 1 }, uWind: { value: -2.5 } },
    vertexShader: /* glsl */`uniform float uTime,uWind;uniform vec3 uCenter;attribute vec4 aSeed;attribute float aEnd;varying float vA;
    void main(){const float B=70.0,H=34.0;float sp=22.0+aSeed.w*8.0;vec3 p=vec3(aSeed.x*B,aSeed.y*H,aSeed.z*B);
      p.y=mod(p.y-uTime*sp,H);p.x+=uTime*uWind;float ox=uCenter.x-B*0.5,oz=uCenter.z-B*0.5;p.x=mod(p.x-ox,B)+ox;p.z=mod(p.z-oz,B)+oz;
      vec3 v=normalize(vec3(uWind,-sp,0.0));p-=v*aEnd*(0.55+aSeed.w*0.4);
      vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;float d=-mv.z;
      vA=smoothstep(B*0.62,B*0.2,d)*smoothstep(0.3,1.5,d)*(1.0-aEnd*0.6);}`,
    fragmentShader: /* glsl */`uniform float uOpacity,uLight;varying float vA;void main(){gl_FragColor=vec4(vec3(0.78,0.84,0.9)*uLight,vA*uOpacity*0.42);}`,
  });
  const l = new THREE.LineSegments(g, mat); l.frustumCulled = false; l.renderOrder = 2; return l;
}

/** Fireflies over the meadow and pond, moths around the plaza lamps. */
function fireflies() {
  const anchors: number[] = []; const R = srand(311);
  const lampSpots = [[-11.6, 4.2, 2.4], [11.6, 4.2, 2.4], [-11.6, 4.2, 14.8], [11.6, 4.2, 14.8], [-4.6, 2.9, 2.1], [4.6, 2.9, 2.1]];
  let n = 0; const N = isLowEnd ? 140 : 260, MOTHS = 48;
  while (n < N) {
    let x: number, z: number;
    if (n < N * 0.3) { const a = R() * Math.PI * 2; x = POND.cx + Math.cos(a) * (POND.rx + 1 + R() * 4); z = POND.cz + Math.sin(a) * (POND.rz + 1 + R() * 4); }
    else { x = (R() * 2 - 1) * 55; z = (R() * 2 - 1) * 55; if (excluded(x, z) && R() < 0.85) continue; }
    anchors.push(x, 0.4 + R() * 1.8, z, 0); n++;
  }
  for (let i = 0; i < MOTHS; i++) { const l = lampSpots[i % lampSpots.length]; anchors.push(l[0], l[1], l[2], 1); }
  const count = anchors.length / 4; const g = new THREE.BufferGeometry(); const seed = new Float32Array(count * 4); for (let i = 0; i < count * 4; i++) seed[i] = Math.random();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)); g.setAttribute('aAnchor', new THREE.BufferAttribute(new Float32Array(anchors), 4)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.uTime, uOpacity: { value: 0 }, uMoth: { value: 0 }, uPR: { value: 1 } },
    vertexShader: /* glsl */`uniform float uTime,uPR,uOpacity,uMoth;attribute vec4 aAnchor;attribute vec4 aSeed;varying float vB;varying float vMoth;
    void main(){float t=uTime;vec3 p=aAnchor.xyz;float moth=aAnchor.w;vMoth=moth;
      if(moth<0.5){
        float r=1.5+aSeed.x*2.5;
        p+=vec3(sin(t*(0.21+aSeed.y*0.2)+aSeed.z*30.0)*r+sin(t*0.9+aSeed.w*9.0)*0.35, sin(t*(0.33+aSeed.w*0.3)+aSeed.x*20.0)*0.5+sin(t*1.7+aSeed.y*5.0)*0.12, cos(t*(0.19+aSeed.z*0.2)+aSeed.y*40.0)*r+cos(t*1.1+aSeed.x*7.0)*0.35);
        float ph=t*(0.6+aSeed.y*0.9)+aSeed.z*50.0;float f=pow(max(0.0,sin(ph)),8.0);float slow=0.25+0.75*smoothstep(-0.2,0.6,sin(t*0.17+aSeed.w*20.0));
        vB=f*slow*uOpacity;
      } else {
        float a=t*(2.2+aSeed.x*2.0)+aSeed.y*6.28;float r=0.25+aSeed.z*0.45;
        p+=vec3(cos(a)*r+sin(t*7.0+aSeed.w*9.0)*0.06, sin(a*1.7)*0.2+sin(t*9.0+aSeed.x*4.0)*0.05, sin(a)*r);
        vB=uMoth*(0.5+0.5*sin(t*20.0+aSeed.w*30.0));
      }
      vec4 mv=modelViewMatrix*vec4(p,1.0);gl_PointSize=(moth<0.5?0.32:0.12)*uPR*320.0/max(-mv.z,1.0);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: /* glsl */`varying float vB;varying float vMoth;void main(){vec2 pc=gl_PointCoord-0.5;float r=length(pc);
      float core=smoothstep(0.18,0.0,r);float halo=smoothstep(0.5,0.0,r)*0.35;
      vec3 col=vMoth<0.5?vec3(0.82,1.0,0.32)*(core*6.0+halo*2.0):vec3(1.0,0.95,0.85)*(smoothstep(0.5,0.1,r)*0.9);
      float a=vMoth<0.5?(core+halo):smoothstep(0.5,0.1,r);gl_FragColor=vec4(col*vB,a*vB);if(vB<0.01)discard;}`,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; p.renderOrder = 3; return p;
}

export function Weather() {
  const { camera, gl } = useThree();
  const controls = useThree(s => s.controls) as any;
  const sys = useMemo(() => {
    const low = isLowEnd;
    return {
      rain: rainLines(low ? 5000 : 12000),
      snow: points(low ? 2500 : 6000, { mode: 1, fall: 1.5, drift: 1.3, wind: 0.8, size: 0.28, box: 80, h: 36 }),
      leaves: points(low ? 500 : 1200, { mode: 2, fall: 1.1, drift: 1.6, wind: 5.5, size: 0.6, box: 80, h: 22 }),
      dust: points(low ? 400 : 900, { mode: 3, fall: -0.25, drift: 0.6, wind: 0.4, size: 0.15, box: 70, h: 12, add: true }),
      flies: fireflies(),
    };
  }, []);

  useFrame((_, rdt) => {
    const dt = Math.min(rdt, 0.1);
    const want: Record<string, number> = { rain: env.n.rain, snow: env.n.snow, leaves: env.leafFall, dust: env.n.haze * env.daylight };
    const cx = controls ? camera.position.x * 0.5 + controls.target.x * 0.5 : 0, cz = controls ? camera.position.z * 0.5 + controls.target.z * 0.5 : 0;
    for (const k of ['rain', 'snow', 'leaves', 'dust'] as const) {
      const o = sys[k] as THREE.Points | THREE.LineSegments; const u = (o.material as THREE.ShaderMaterial).uniforms;
      u.uOpacity.value += (Math.min(1, want[k] || 0) - u.uOpacity.value) * (1 - Math.exp(-dt * 0.8)); o.visible = u.uOpacity.value > 0.01;
      u.uCenter.value.set(cx, 0, cz); u.uLight.value = 0.25 + 0.75 * env.daylight + env.flash; u.uPR.value = gl.getPixelRatio();
    }
    const fu = (sys.flies.material as THREE.ShaderMaterial).uniforms;
    const nightK = Math.max(0, (env.night - 0.35) / 0.65);
    fu.uOpacity.value += (nightK * env.n.fireflies * (1 - env.n.rain * 0.6) - fu.uOpacity.value) * (1 - Math.exp(-dt * 0.5));
    fu.uMoth.value += (nightK * (1 - env.n.snow) - fu.uMoth.value) * (1 - Math.exp(-dt * 0.5));
    fu.uPR.value = gl.getPixelRatio(); sys.flies.visible = fu.uOpacity.value > 0.01 || fu.uMoth.value > 0.01;
  });

  return <>{Object.values(sys).map((o, i) => <primitive key={i} object={o} />)}</>;
}
