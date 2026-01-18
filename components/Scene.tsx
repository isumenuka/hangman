import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Sparkles, Cloud } from '@react-three/drei';
import * as THREE from 'three';

// Fix for missing JSX types for react-three-fiber elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      spotLight: any;
      group: any;
      mesh: any;
      cylinderGeometry: any;
      boxGeometry: any;
      sphereGeometry: any;
      torusGeometry: any;
      planeGeometry: any;
      meshStandardMaterial: any;
      color: any;
      fog: any;
    }
  }
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        ambientLight: any;
        pointLight: any;
        directionalLight: any;
        spotLight: any;
        group: any;
        mesh: any;
        cylinderGeometry: any;
        boxGeometry: any;
        sphereGeometry: any;
        torusGeometry: any;
        planeGeometry: any;
        meshStandardMaterial: any;
        color: any;
        fog: any;
      }
    }
  }
}

// --- Materials ---
const WoodMaterial = new THREE.MeshStandardMaterial({
  color: '#3d2817', // Slightly lighter wood
  roughness: 0.9,
  metalness: 0,
});

const RopeMaterial = new THREE.MeshStandardMaterial({
  color: '#a08060', // Lighter rope
  roughness: 1
});

const BoneMaterial = new THREE.MeshStandardMaterial({
  color: '#e2e8f0', // Whiter bone for better contrast
  roughness: 0.4,
  metalness: 0.1
});

const EyeGlowMaterial = new THREE.MeshStandardMaterial({
  color: '#ff0000',
  emissive: '#ff0000',
  emissiveIntensity: 3, // Brighter eyes
  toneMapped: false
});

const EyeWinMaterial = new THREE.MeshStandardMaterial({
  color: '#00ffaa',
  emissive: '#00ffaa',
  emissiveIntensity: 3,
  toneMapped: false
});

// --- Components ---

const Lantern = () => {
  const lightRef = useRef<THREE.PointLight>(null);
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (lightRef.current && meshRef.current) {
      // Flicker - brighter base intensity
      lightRef.current.intensity = 4 + Math.random() * 3;
      // Sway
      const time = state.clock.elapsedTime;
      meshRef.current.rotation.z = Math.sin(time * 2) * 0.1;
      meshRef.current.rotation.x = Math.sin(time * 1.5) * 0.05;
    }
  });

  return (
    <group position={[1.5, 4.8, 0.4]}>
      {/* Rope holding lantern */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <group ref={meshRef}>
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.1, 0.15, 0.4, 4]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <pointLight ref={lightRef} color="#ffaa00" distance={25} decay={2} castShadow shadow-bias={-0.0001} />
      </group>
    </group>
  );
}

const Gallows = () => {
  return (
    <group position={[0, -3, 0]}>
      {/* Base Platform */}
      <mesh material={WoodMaterial} position={[0, 0.2, 0]} receiveShadow castShadow>
        <boxGeometry args={[5, 0.4, 5]} />
      </mesh>

      {/* Trapdoor detail */}
      <mesh material={WoodMaterial} position={[-1, 0.25, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.5, 0.05, 1.5]} />
      </mesh>

      {/* Main Post */}
      <mesh material={WoodMaterial} position={[1.5, 3, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.5, 6, 0.5]} />
      </mesh>

      {/* Top Beam */}
      <mesh material={WoodMaterial} position={[0, 5.8, 0]} receiveShadow castShadow>
        <boxGeometry args={[4, 0.4, 0.4]} />
      </mesh>

      {/* Support Beam */}
      <mesh material={WoodMaterial} position={[0.8, 5, 0]} rotation={[0, 0, Math.PI / 4]} receiveShadow castShadow>
        <boxGeometry args={[0.3, 1.8, 0.3]} />
      </mesh>

      {/* Noose Rope Base */}
      <mesh material={RopeMaterial} position={[-1, 5.2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.5]} />
      </mesh>

      <Lantern />
    </group>
  );
};

// --- Skeleton Parts ---

const Bone = ({ height = 1, radius = 0.08, ...props }) => (
  <group {...props}>
    {/* Bone shaft */}
    <mesh material={BoneMaterial} castShadow>
      <cylinderGeometry args={[radius * 0.7, radius * 0.7, height]} />
    </mesh>
    {/* Joint top */}
    <mesh material={BoneMaterial} position={[0, height / 2, 0]} castShadow>
      <sphereGeometry args={[radius * 1.2]} />
    </mesh>
    {/* Joint bottom */}
    <mesh material={BoneMaterial} position={[0, -height / 2, 0]} castShadow>
      <sphereGeometry args={[radius * 1.2]} />
    </mesh>
  </group>
);

const Skull = ({ isDead, isWon }: { isDead: boolean, isWon: boolean }) => {
  return (
    <group>
      {/* Cranium */}
      <mesh material={BoneMaterial} position={[0, 0.1, 0]} castShadow>
        <sphereGeometry args={[0.35, 16, 16]} />
      </mesh>
      {/* Jaw */}
      <mesh material={BoneMaterial} position={[0, -0.25, 0.05]} castShadow>
        <boxGeometry args={[0.3, 0.2, 0.3]} />
      </mesh>
      {/* Eyes */}
      <mesh
        material={isWon ? EyeWinMaterial : (isDead ? EyeGlowMaterial : new THREE.MeshStandardMaterial({ color: '#111' }))}
        position={[-0.12, 0.1, 0.25]}
      >
        <sphereGeometry args={[0.08]} />
      </mesh>
      <mesh
        material={isWon ? EyeWinMaterial : (isDead ? EyeGlowMaterial : new THREE.MeshStandardMaterial({ color: '#111' }))}
        position={[0.12, 0.1, 0.25]}
      >
        <sphereGeometry args={[0.08]} />
      </mesh>
    </group>
  )
}

const Ribcage = () => (
  <group>
    {/* Spine */}
    <mesh material={BoneMaterial} castShadow>
      <cylinderGeometry args={[0.08, 0.08, 1.4]} />
    </mesh>
    {/* Ribs */}
    {[0.4, 0.2, 0, -0.2].map((y, i) => (
      <mesh key={i} material={BoneMaterial} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.25 - (i * 0.02), 0.04, 8, 16, Math.PI * 1.5]} />
      </mesh>
    ))}
  </group>
)

interface HangmanFigureProps {
  wrongGuesses: number;
  isDead: boolean;
  isWon: boolean;
}

const HangmanFigure: React.FC<HangmanFigureProps> = ({ wrongGuesses, isDead, isWon }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Animation Logic
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    if (isWon) {
      // Ascension animation
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 4, 0.02);
      groupRef.current.rotation.y += 0.02;
      groupRef.current.rotation.z = Math.sin(t) * 0.1;
    } else if (isDead) {
      // Death twitch then limp
      const shake = Math.sin(t * 20) * Math.exp(-1 * (t % 5)) * 0.2;
      groupRef.current.rotation.z = Math.sin(t * 1.5) * 0.2;
      groupRef.current.rotation.x = Math.sin(t) * 0.1;
      groupRef.current.position.y = -3 + 4.45;
    } else {
      // Alive: Nervous shivering
      groupRef.current.rotation.z = Math.sin(t * 5) * 0.02;
      groupRef.current.position.y = -3 + 4.45 + Math.sin(t * 2) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={[-1, -3 + 4.45, 0]}>
      {/* 1. Head (Guesses >= 1) */}
      {wrongGuesses >= 1 && (
        <group position={[0, -0.4, 0]}>
          <Skull isDead={isDead} isWon={isWon} />
        </group>
      )}

      {/* 2. Torso (Guesses >= 2) */}
      {wrongGuesses >= 2 && (
        <group position={[0, -1.3, 0]}>
          <Ribcage />
        </group>
      )}

      {/* 3. Left Arm (Guesses >= 3) */}
      {wrongGuesses >= 3 && (
        <group position={[-0.4, -1, 0]} rotation={[0, 0, Math.PI / 6]}>
          <Bone height={0.9} radius={0.06} position={[0, -0.45, 0]} />
        </group>
      )}

      {/* 4. Right Arm (Guesses >= 4) */}
      {wrongGuesses >= 4 && (
        <group position={[0.4, -1, 0]} rotation={[0, 0, -Math.PI / 6]}>
          <Bone height={0.9} radius={0.06} position={[0, -0.45, 0]} />
        </group>
      )}

      {/* 5. Left Leg (Guesses >= 5) */}
      {wrongGuesses >= 5 && (
        <group position={[-0.2, -2, 0]} rotation={[0, 0, Math.PI / 12]}>
          <Bone height={1.2} radius={0.07} position={[0, -0.6, 0]} />
        </group>
      )}

      {/* 6. Right Leg (Guesses >= 6 - GAME OVER usually) */}
      {wrongGuesses >= 6 && (
        <group position={[0.2, -2, 0]} rotation={[0, 0, -Math.PI / 12]}>
          <Bone height={1.2} radius={0.07} position={[0, -0.6, 0]} />
        </group>
      )}
    </group>
  );
};

interface SceneProps {
  wrongGuesses: number;
  isWon: boolean;
  isLost: boolean;
}

export const GameScene: React.FC<SceneProps> = ({ wrongGuesses, isWon, isLost }) => {
  return (
    <Canvas shadows camera={{ position: [0, 2, 9], fov: 45 }}>
      {/* Background - Lighter Moonlight Blue */}
      <color attach="background" args={['#1a1d29']} />
      {/* Fog - much lighter and further back */}
      <fog attach="fog" args={['#1a1d29', 12, 45]} />

      {/* --- Lighting Overhaul (High Visibility) --- */}

      {/* Ambient: Strong base illumination so nothing is pitch black */}
      <ambientLight intensity={1.5} color="#c7d2fe" />

      {/* Main Spot (Moonlight): Very Bright */}
      <spotLight
        position={[-5, 10, 10]}
        angle={0.6}
        penumbra={0.5}
        intensity={4}
        color="#a5b4fc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      />

      {/* Fill Light (Warm): Hits the face/front directly */}
      <pointLight position={[2, 3, 5]} intensity={2} color="#e0e7ff" />

      {/* Rim Light (Cyan): Pop the silhouette against the dark background */}
      <spotLight position={[0, 5, -8]} intensity={5} color="#22d3ee" />

      {/* Ground illumination */}
      <directionalLight position={[0, -5, 0]} intensity={1} color="#334155" />

      {/* --- Environment --- */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
      <Sparkles count={100} scale={15} size={4} speed={0.4} opacity={0.5} color="#818cf8" />
      <Cloud position={[-4, -2, -5]} speed={0.2} opacity={0.1} color="#94a3b8" />
      <Cloud position={[4, 2, -5]} speed={0.2} opacity={0.1} color="#94a3b8" />

      <group position={[0, -1, 0]}>
        <Gallows />
        <HangmanFigure wrongGuesses={wrongGuesses} isDead={isLost} isWon={isWon} />
      </group>

      {/* Floor - Slate Blue, faintly reflective */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>

      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.8}
        minDistance={6}
        maxDistance={14}
      />
    </Canvas>
  );
};