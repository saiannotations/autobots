import { forwardRef, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, N8AO, ToneMapping, Vignette, SMAA, Noise } from '@react-three/postprocessing';
import { Effect, ToneMappingMode, BlendFunction } from 'postprocessing';
import { useHud, quality } from '../ui/store';

/** Live colour-grade parameters, written by the atmosphere every frame. */
export const grade = { exposure: 1, saturation: 1, haze: 0, flash: 0, tint: new THREE.Vector3(1, 1, 1), bloom: 0.35 };

const gradeFrag = /* glsl */`
uniform float uExp, uSat, uHaze, uFlash, uTime;
uniform vec3 uTint;
void mainUv(inout vec2 uv){
  if(uHaze > 0.001){
    float m = smoothstep(0.82, 0.3, uv.y) * smoothstep(0.02, 0.28, uv.y);
    uv.x += (sin(uv.y * 170.0 + uTime * 7.0) * 0.0011 + sin(uv.y * 63.0 - uTime * 4.3 + uv.x * 24.0) * 0.0009) * uHaze * m;
    uv.y += cos(uv.x * 115.0 + uTime * 5.2) * 0.0007 * uHaze * m;
  }
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec3 c = inputColor.rgb * uExp * uTint + uFlash;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, uSat), 0.0);
  vec3 lg = log2(c + 1e-4); c = exp2((lg + 3.0) * 1.08 - 3.0);
  outputColor = vec4(c, inputColor.a);
}`;

class GradeEffectImpl extends Effect {
  constructor() {
    super('GradeEffect', gradeFrag, {
      uniforms: new Map<string, THREE.Uniform<any>>([
        ['uExp', new THREE.Uniform(1)], ['uSat', new THREE.Uniform(1)], ['uHaze', new THREE.Uniform(0)],
        ['uFlash', new THREE.Uniform(0)], ['uTime', new THREE.Uniform(0)], ['uTint', new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
      ]),
    });
  }
  update(_r: THREE.WebGLRenderer, _i: THREE.WebGLRenderTarget, dt?: number) {
    const u = this.uniforms;
    u.get('uExp')!.value = grade.exposure; u.get('uSat')!.value = grade.saturation; u.get('uHaze')!.value = grade.haze;
    u.get('uFlash')!.value = grade.flash; u.get('uTime')!.value += dt || 0.016; (u.get('uTint')!.value as THREE.Vector3).copy(grade.tint);
  }
}
const Grade = forwardRef<GradeEffectImpl>(function Grade(_, ref) {
  const effect = useMemo(() => new GradeEffectImpl(), []);
  return <primitive ref={ref} object={effect} dispose={null} />;
});

export function Effects() {
  const bloom = useRef<any>(null);
  const level = useHud(s => s.qLevel);
  useFrame(() => { if (bloom.current) bloom.current.intensity = grade.bloom; });
  // Ambient occlusion is decided once at start; rebuilding the effect chain live causes a black frame.
  const ao = useMemo(() => quality.ao, []);
  const fx: JSX.Element[] = [];
  if (ao) fx.push(<N8AO key="ao" aoRadius={1.6} distanceFalloff={0.8} intensity={2.4} quality={level >= 3 ? 'medium' : 'performance'} halfRes color={new THREE.Color(0x101418)} />);
  fx.push(
    <Bloom key="bloom" ref={bloom} mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.15} intensity={0.35} radius={0.7} />,
    <Grade key="grade" />,
    <ToneMapping key="tm" mode={ToneMappingMode.ACES_FILMIC} />,
    <Vignette key="vig" eskil={false} offset={0.28} darkness={0.55} />,
    <Noise key="noise" premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.04} />,
    <SMAA key="smaa" />,
  );
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
      {fx}
    </EffectComposer>
  );
}
