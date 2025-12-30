
import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BreathPhase, ColorTheme, QualityTier, QualityConfig } from '../types';
import { useSessionStore } from '../stores/sessionStore';

type Props = {
  phase: BreathPhase;
  theme: ColorTheme;
  quality: QualityTier;
  reduceMotion: boolean;
  progressRef: React.MutableRefObject<number>;
  isActive: boolean;
};

// --- COLOR PALETTE (Refined for Zen/Eye Comfort) ---
const COLOR_PALETTES = {
  warm: {
    // Sunset / Ember
    core: new THREE.Color('#c74832'), 
    rim: new THREE.Color('#f4a460'),
    ambient: new THREE.Color('#2a1410')
  },
  cool: {
    // Twilight / Deep Ocean
    core: new THREE.Color('#0d5f7e'),
    rim: new THREE.Color('#4ecdc4'),
    ambient: new THREE.Color('#0a1929')
  },
  neutral: {
    // Moonstone / Silver
    core: new THREE.Color('#525266'),
    rim: new THREE.Color('#b8b8cc'),
    ambient: new THREE.Color('#0f0f14')
  }
};

// --- SHADER CODE BLOCKS ---

const NOISE_CHUNK = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}
`;

const NEBULA_VERT = `
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const NEBULA_FRAG = `
varying vec2 vUv;
varying vec3 vWorldPos;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uDensity;

${NOISE_CHUNK}

void main() {
  float noise1 = snoise(vWorldPos * 0.15 + vec3(uTime * 0.03, uTime * 0.01, 0.0));
  float noise2 = snoise(vWorldPos * 0.3 - vec3(0.0, uTime * 0.05, uTime * 0.005));
  
  float combined = (noise1 + noise2) * 0.5; 
  float mist = smoothstep(-0.2, 0.8, combined); 
  
  // Richer mixing
  vec3 finalColor = mix(uColorA, uColorB, combined * 0.6 + 0.4);
  
  float dist = length(vUv - 0.5);
  float alpha = uDensity * mist * (1.0 - smoothstep(0.1, 0.8, dist));

  // Dithering to prevent banding
  float dither = fract(sin(dot(vUv.xy, vec2(12.9898,78.233))) * 43758.5453);
  gl_FragColor = vec4(finalColor + (dither * 0.01), alpha * 0.35);
}
`;

const VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying float vNoise;

uniform float uTime;
uniform float uNoiseStrength;
uniform float uNoiseSpeed;

${NOISE_CHUNK}

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  
  // More organic flow
  float noiseVal = snoise(position * 1.2 + vec3(uTime * uNoiseSpeed));
  vNoise = noiseVal;
  
  vec3 newPos = position + normal * (noiseVal * uNoiseStrength);
  vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAGMENT_SHADER = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying float vNoise;

uniform vec3 uColorCore;
uniform vec3 uColorRim;
uniform float uFresnelBias;
uniform float uFresnelScale;
uniform float uFresnelPower;
uniform float uOpacity;

void main() {
  vec3 viewDir = normalize(vViewPosition);
  vec3 normal = normalize(vNormal);

  float fresnelTerm = uFresnelBias + uFresnelScale * pow(1.0 + dot(-viewDir, normal), uFresnelPower);
  
  vec3 finalColor = mix(uColorCore, uColorRim, fresnelTerm);
  
  // Highlights
  finalColor += vec3(1.0) * smoothstep(0.45, 0.95, vNoise) * 0.15; 

  float alpha = uOpacity * (fresnelTerm + 0.1); 
  gl_FragColor = vec4(finalColor, min(alpha, 1.0));
}
`;

// --- NEBULA COMPONENT ---
const Nebula = ({ theme }: { theme: ColorTheme }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  
  const colors = useMemo(() => {
     const palette = COLOR_PALETTES[theme] || COLOR_PALETTES.neutral;
     return { a: palette.ambient, b: palette.core };
  }, [theme]);

  // Clean up
  useEffect(() => {
    return () => {
      matRef.current?.dispose();
    }
  }, []);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      matRef.current.uniforms.uColorA.value.lerp(colors.a, 0.015);
      matRef.current.uniforms.uColorB.value.lerp(colors.b, 0.015);
    }
    if (meshRef.current) {
        meshRef.current.lookAt(state.camera.position);
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -8]} scale={[25, 25, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={NEBULA_VERT}
        fragmentShader={NEBULA_FRAG}
        uniforms={{
          uTime: { value: 0 },
          uColorA: { value: colors.a },
          uColorB: { value: colors.b },
          uDensity: { value: 1.0 }
        }}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
};

// --- PARTICLES ---
const Particles = ({ isActive, theme, quality, reduceMotion }: { isActive: boolean, theme: ColorTheme, quality: QualityTier, reduceMotion: boolean }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const particleCount = useMemo(() => {
    if (reduceMotion) return 30;
    if (quality === 'low') return 40;
    if (quality === 'medium') return 80;
    return 140; 
  }, [quality, reduceMotion]);
  
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < particleCount; i++) {
      const r = 4 + Math.random() * 8; 
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      temp.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
        speed: 0.05 + Math.random() * 0.2, // Slower, more zen
        offset: Math.random() * 100,
        size: Math.random()
      });
    }
    return temp;
  }, [particleCount]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    
    // Subtle coloring
    let color = new THREE.Color(1, 1, 1);
    if (theme === 'warm') color.setHSL(0.08, 0.8, 0.7);
    else if (theme === 'cool') color.setHSL(0.5, 0.8, 0.7);
    else color.setHSL(0.6, 0.1, 0.8);

    meshRef.current.setColorAt(0, color); 

    particles.forEach((p, i) => {
      const t = time * p.speed * (isActive ? 0.6 : 0.2) + p.offset;
      
      dummy.position.set(
        p.x + Math.sin(t) * 0.5,
        p.y + Math.cos(t * 0.8) * 0.5,
        p.z + Math.sin(t * 0.3) * 0.5
      );
      dummy.lookAt(0, 0, 5); 
      // Breathing effect on stars themselves
      const breathe = isActive ? (Math.sin(time) * 0.2 + 1) : 1;
      const s = ((Math.sin(t * 3) + 1) * 0.02 + 0.005) * p.size * breathe;
      
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh key={particleCount} ref={meshRef} args={[undefined, undefined, particleCount]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} color="white" side={THREE.DoubleSide} />
    </instancedMesh>
  );
};

// --- ORB LOGIC ---

function resolveQuality(tier: QualityTier): QualityConfig {
  const baseDpr = Math.min(window.devicePixelRatio || 1, 2);
  switch (tier) {
      case 'low': return { tier, dpr: 1, segments: 48 };
      case 'medium': return { tier, dpr: 1.5, segments: 72 };
      case 'high': return { tier, dpr: 2, segments: 128 };
      default: // auto
        return { 
          tier: 'auto', 
          dpr: baseDpr, 
          segments: baseDpr < 1.5 ? 48 : baseDpr < 2 ? 72 : 128 
        };
  }
}

function LivingOrb({ phase, theme, reduceMotion, progressRef, segments, isActive }: Props & { segments: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const isPaused = useSessionStore(s => s.isPaused);
  const targetScale = useRef(1);
  const currentScale = useRef(1);
  
  const colors = useMemo(() => {
     return COLOR_PALETTES[theme] || COLOR_PALETTES.neutral;
  }, [theme]);

  // Cleanup material
  useEffect(() => {
      return () => {
          materialRef.current?.dispose();
      }
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current || !materialRef.current) return;
    
    const time = state.clock.getElapsedTime();
    const p = progressRef.current; 
    
    // Improved Breathing Curve (Ease In/Out)
    if (!isActive) {
      targetScale.current = 1.0 + Math.sin(time * 0.5) * 0.05;
    } else {
      if (phase === 'inhale') targetScale.current = 0.8 + (p * 1.4); // 0.8 -> 2.2
      else if (phase === 'exhale') targetScale.current = 2.2 - (p * 1.4); 
      else if (phase === 'holdIn') {
          // Heartbeat pulse
          targetScale.current = 2.2 + Math.sin(time * 4) * 0.015; 
      }
      else if (phase === 'holdOut') {
          targetScale.current = 0.8 + Math.sin(time * 2) * 0.01;
      }
    }

    const lerpSpeed = isPaused ? 1.0 : (isActive ? 3.0 : 1.0); 
    currentScale.current = THREE.MathUtils.lerp(currentScale.current, targetScale.current, delta * lerpSpeed);
    meshRef.current.scale.setScalar(currentScale.current);

    // Shader Dynamics
    const mat = materialRef.current;
    
    let targetNoise = 0.15;
    let targetSpeed = 0.2;
    
    if (isActive && !isPaused) {
      if (phase === 'inhale') {
        targetNoise = 0.2 + p * 0.25;
        targetSpeed = 0.4 + p * 0.8;
      } else if (phase === 'holdIn') {
        targetNoise = 0.5; 
        targetSpeed = 0.2; 
      } else if (phase === 'exhale') {
        targetNoise = 0.45 - p * 0.3;
        targetSpeed = 0.8 - p * 0.6;
      }
    }

    if (reduceMotion) { targetNoise *= 0.3; targetSpeed *= 0.5; }

    mat.uniforms.uTime.value = time;
    mat.uniforms.uNoiseStrength.value = THREE.MathUtils.lerp(mat.uniforms.uNoiseStrength.value, targetNoise, delta * 2);
    mat.uniforms.uNoiseSpeed.value = THREE.MathUtils.lerp(mat.uniforms.uNoiseSpeed.value, targetSpeed, delta * 2);
    mat.uniforms.uOpacity.value = isPaused ? 0.6 : 1.0;
    
    // Smoother color transitions
    mat.uniforms.uColorCore.value.lerp(colors.core, 0.04);
    mat.uniforms.uColorRim.value.lerp(colors.rim, 0.04);

    meshRef.current.rotation.y = time * 0.05;
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, segments, segments]} /> 
        <shaderMaterial
          ref={materialRef}
          vertexShader={VERTEX_SHADER}
          fragmentShader={FRAGMENT_SHADER}
          uniforms={{
            uTime: { value: 0 },
            uColorCore: { value: colors.core },
            uColorRim: { value: colors.rim },
            uNoiseStrength: { value: 0.1 },
            uNoiseSpeed: { value: 0.5 },
            uFresnelBias: { value: 0.02 },
            uFresnelScale: { value: 1.8 },
            uFresnelPower: { value: 2.2 },
            uOpacity: { value: 1.0 }
          }}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      
      {/* Inner Glow Core */}
      <mesh scale={[0.4, 0.4, 0.4]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color={colors.core} transparent opacity={0.5} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

export default function OrbBreathViz(props: Props) {
  const { dpr, segments } = useMemo(() => resolveQuality(props.quality), [props.quality]);
  
  return (
    <Canvas 
      dpr={dpr} 
      camera={{ position: [0, 0, 6], fov: 45 }} 
      gl={{ 
        antialias: true, 
        alpha: true, 
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        preserveDrawingBuffer: false
      }}
      className="transition-opacity duration-1000"
    >
      <Nebula theme={props.theme} />
      <Particles isActive={props.isActive} theme={props.theme} quality={props.quality} reduceMotion={props.reduceMotion} />
      <LivingOrb {...props} segments={segments} />
    </Canvas>
  );
}
