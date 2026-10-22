import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';

function createEraserFaceTexture(letter, isWin, widthPx = 256, heightPx = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');

  // Classic two-tone red/blue school eraser + cardboard sleeve feel
  const grad = ctx.createLinearGradient(0, 0, widthPx, heightPx);
  if (isWin) {
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(0.7, '#e2e8f0');
    grad.addColorStop(1, '#cbd5e1');
  } else {
    grad.addColorStop(0, '#fff1f2');
    grad.addColorStop(0.7, '#ffe4e6');
    grad.addColorStop(1, '#fecdd3');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Colored stripe at ends (iconic blue/red eraser tip)
  ctx.fillStyle = isWin ? '#2563eb' : '#e11d48';
  ctx.fillRect(0, 0, widthPx * 0.22, heightPx);

  // Border
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, widthPx - 10, heightPx - 10);

  // Hand-drawn pen 'W' or 'L' in center
  ctx.fillStyle = isWin ? '#15803d' : '#be123c';
  ctx.font = `900 ${Math.floor(Math.min(widthPx, heightPx) * 0.62)}px "Comic Neue", "Inter", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, widthPx * 0.56, heightPx * 0.52);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Target quaternion so the chosen face normal points straight UP (+Y in world space)
function getTargetQuaternion(faceId, yaw = 0.25) {
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const qFace = new THREE.Quaternion();

  switch (faceId) {
    case 'wide_W': // +Y up
      qFace.setFromEuler(new THREE.Euler(0, 0, 0));
      break;
    case 'wide_L': // -Y up
      qFace.setFromEuler(new THREE.Euler(Math.PI, 0, 0));
      break;
    case 'side_W': // +Z up
      qFace.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
      break;
    case 'side_L': // -Z up
      qFace.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
      break;
    case 'stand_W': // +X up
      qFace.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
      break;
    case 'stand_L': // -X up
      qFace.setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2));
      break;
    default:
      qFace.setFromEuler(new THREE.Euler(0, 0, 0));
  }

  return qYaw.multiply(qFace);
}

export default function Eraser3D({ eraserToss, territories }) {
  const bodyRef = useRef(null);
  const tossStartRef = useRef(0);
  const targetQuatRef = useRef(new THREE.Quaternion());
  const targetPosRef = useRef(new THREE.Vector3(0, 0.35, 0));

  // Generate the 6 textures: 3 faces 'W' (+X, +Y, +Z), 3 faces 'L' (-X, -Y, -Z)
  const materials = useMemo(() => {
    const texStandW = createEraserFaceTexture('W', true, 160, 220); // +X
    const texStandL = createEraserFaceTexture('L', false, 160, 220); // -X
    const texWideW = createEraserFaceTexture('W', true, 360, 220); // +Y
    const texWideL = createEraserFaceTexture('L', false, 360, 220); // -Y
    const texSideW = createEraserFaceTexture('W', true, 360, 140); // +Z
    const texSideL = createEraserFaceTexture('L', false, 360, 140); // -Z

    return [
      new THREE.MeshStandardMaterial({ map: texStandW, roughness: 0.55 }), // 0: +X (stand_W)
      new THREE.MeshStandardMaterial({ map: texStandL, roughness: 0.55 }), // 1: -X (stand_L)
      new THREE.MeshStandardMaterial({ map: texWideW, roughness: 0.55 }),  // 2: +Y (wide_W)
      new THREE.MeshStandardMaterial({ map: texWideL, roughness: 0.55 }),  // 3: -Y (wide_L)
      new THREE.MeshStandardMaterial({ map: texSideW, roughness: 0.55 }),  // 4: +Z (side_W)
      new THREE.MeshStandardMaterial({ map: texSideL, roughness: 0.55 }),  // 5: -Z (side_L)
    ];
  }, []);

  useEffect(() => {
    if (!eraserToss || !bodyRef.current) return;

    const rb = bodyRef.current;
    tossStartRef.current = performance.now();

    // Map 2D coordinates (0..1000, 0..700) to 3D table coordinates (-5..5, -3.5..3.5)
    const sourceTerr = territories?.[eraserToss.sourceId];
    const targetTerr = territories?.[eraserToss.targetId];

    const sx = sourceTerr ? (sourceTerr.center[0] - 500) / 100 : 0;
    const sz = sourceTerr ? (sourceTerr.center[1] - 350) / 100 : 2.8;

    const tx = targetTerr ? (targetTerr.center[0] - 500) / 100 : 0;
    const tz = targetTerr ? (targetTerr.center[1] - 350) / 100 : 0;

    targetPosRef.current.set(tx, 0.28, tz);

    const yaw = ((eraserToss.seed % 360) * Math.PI) / 180;
    targetQuatRef.current.copy(getTargetQuaternion(eraserToss.faceId, yaw));

    // Spawn above source territory and throw toward target territory
    rb.setTranslation({ x: sx, y: 2.3, z: sz }, true);
    rb.setRotation({ x: 0.3, y: 0.5, z: -0.2, w: 0.8 }, true);

    const vx = (tx - sx) * 1.45;
    const vz = (tz - sz) * 1.45;
    rb.setLinvel({ x: vx, y: 2.4, z: vz }, true);
    rb.setAngvel(
      {
        x: 11 + (eraserToss.seed % 7),
        y: 6 + ((eraserToss.seed >> 3) % 5),
        z: -10 - ((eraserToss.seed >> 6) % 6),
      },
      true
    );
  }, [eraserToss?.id]);

  // Guide the eraser after its initial real physics bounces (t > 1.25s) so all clients see the exact same W/L face
  useFrame(() => {
    if (!eraserToss || !bodyRef.current) return;
    const elapsed = (performance.now() - tossStartRef.current) / 1000;
    const rb = bodyRef.current;

    if (elapsed > 1.25 && elapsed < 2.6) {
      const alpha = Math.min(1, (elapsed - 1.25) / 0.85);
      const curRot = rb.rotation();
      const qCur = new THREE.Quaternion(curRot.x, curRot.y, curRot.z, curRot.w);
      qCur.slerp(targetQuatRef.current, alpha * 0.28);
      rb.setRotation(
        { x: qCur.x, y: qCur.y, z: qCur.z, w: qCur.w },
        true
      );

      // Dampen velocity smoothly so it rests cleanly on the target region
      const lv = rb.linvel();
      rb.setLinvel({ x: lv.x * 0.82, y: lv.y * 0.88, z: lv.z * 0.82 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  });

  // Dimensions of the eraser: Width 0.78, Height/Thickness 0.26, Depth 0.46
  return (
    <RigidBody
      ref={bodyRef}
      position={[4.3, 0.35, 3.0]}
      colliders="cuboid"
      restitution={0.48}
      friction={0.65}
      mass={1.5}
    >
      <mesh castShadow receiveShadow material={materials}>
        <boxGeometry args={[0.78, 0.26, 0.46]} />
      </mesh>

      {eraserToss && (
        <Html position={[0, 0.65, 0]} center distanceFactor={10}>
          <div
            className={`px-3 py-1 rounded-full font-black text-xs whitespace-nowrap shadow-xl border-2 transition-all ${
              !eraserToss.resolved
                ? 'bg-slate-900/90 text-amber-300 border-amber-400 animate-pulse'
                : eraserToss.outcome === 'W'
                ? 'bg-emerald-600 text-white border-white scale-110'
                : 'bg-rose-600 text-white border-white'
            }`}
          >
            {!eraserToss.resolved
              ? '🎲 SİLGİ DÖNÜYOR...'
              : `${eraserToss.outcome} — ${eraserToss.faceLabel}`}
          </div>
        </Html>
      )}
    </RigidBody>
  );
}
