
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { generateShader } from '../services/shaderGen';

interface Props {
    mood?: string;
    active: boolean;
}

const ShaderBackground: React.FC<Props> = ({ mood = "eerie", active }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [shaderCode, setShaderCode] = useState<string>('');
    const [loading, setLoading] = useState(false);

    // Default Vertex Shader (Pass-through)
    const vertexShader = `
    void main() {
      gl_Position = vec4( position, 1.0 );
    }
  `;

    // Fetch Shader when mood changes
    useEffect(() => {
        if (!active) return;

        let mounted = true;
        setLoading(true);

        generateShader(mood).then(code => {
            if (mounted) {
                setShaderCode(code);
                setLoading(false);
            }
        });

        return () => { mounted = false; };
    }, [mood, active]);


    // Three.js Setup
    useEffect(() => {
        if (!containerRef.current || !shaderCode || !active) return;

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        containerRef.current.appendChild(renderer.domElement);

        const geometry = new THREE.PlaneGeometry(2, 2);

        const uniforms = {
            time: { value: 1.0 },
            resolution: { value: new THREE.Vector2() }
        };

        const material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: shaderCode,
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        const onWindowResize = () => {
            renderer.setSize(window.innerWidth, window.innerHeight);
            uniforms.resolution.value.x = renderer.domElement.width;
            uniforms.resolution.value.y = renderer.domElement.height;
        };
        window.addEventListener('resize', onWindowResize);
        onWindowResize(); // Init size

        let animationId: number;
        const startTime = Date.now();

        const animate = () => {
            animationId = requestAnimationFrame(animate);
            uniforms.time.value = (Date.now() - startTime) / 1000;
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            window.removeEventListener('resize', onWindowResize);
            cancelAnimationFrame(animationId);
            if (containerRef.current) {
                containerRef.current.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, [shaderCode, active]);

    if (!active) return null;

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: -1, // Behind everything
                opacity: loading ? 0.0 : 0.4, // Fade in
                transition: 'opacity 1s ease-in-out',
                pointerEvents: 'none'
            }}
        />
    );
};

export default ShaderBackground;
