import React, { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import Eraser3D from './Eraser3D';

// CK3-style Camera Controller:
// Zoomed Out (cameraZoom = 1.0) -> High bird's-eye top-down view (nearly 90 deg)
// Zoomed In  (cameraZoom = 0.0) -> Lower angled isometric tabletop view (~45 deg)
function CK3CameraController() {
  const { camera } = useThree();
  const cameraZoom = useGameStore((s) => s.cameraZoom);
  const eraserToss = useGameStore((s) => s.room?.eraserToss);

  const currentPos = useRef(new THREE.Vector3(0, 7.8, 4.2));
  const currentLook = useRef(new THREE.Vector3(0, 0, 0.2));

  useFrame((_, delta) => {
    // When an eraser toss is active, bias zoom slightly closer so the 3D flip looks cinematic
    const effectiveZoom = eraserToss ? Math.min(cameraZoom, 0.35) : cameraZoom;

    // Interpolate camera position between Isometric (zoom=0) and Bird's Eye Top-Down (zoom=1)
    const targetY = THREE.MathUtils.lerp(5.2, 11.2, effectiveZoom);
    const targetZ = THREE.MathUtils.lerp(5.4, 0.15, effectiveZoom);
    const lookZ = THREE.MathUtils.lerp(0.35, 0.0, effectiveZoom);

    const desiredPos = new THREE.Vector3(0, targetY, targetZ);
    const desiredLook = new THREE.Vector3(0, 0, lookZ);

    const smooth = 1 - Math.exp(-6.5 * delta);
    currentPos.current.lerp(desiredPos, smooth);
    currentLook.current.lerp(desiredLook, smooth);

    camera.position.copy(currentPos.current);
    camera.lookAt(currentLook.current);
  });

  return null;
}

function TerritoryMesh3D({
  territory,
  owner,
  isSource,
  isTarget,
  isValidTarget,
  isInitialPickable,
  onSelect,
}) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef();

  const { geometry, borderPoints, center3D } = useMemo(() => {
    const [cx2d, cy2d] = territory.center;
    const cx = (cx2d - 500) / 100;
    const cz = (cy2d - 350) / 100;

    // Inset polygon slightly toward centroid so pen border gaps show cleanly
    const insetScale = 0.945;
    const pts2D = territory.polygon.map(([px, py]) => {
      const wx = (px - 500) / 100;
      const wz = (py - 350) / 100;
      return [
        cx + (wx - cx) * insetScale,
        cz + (wz - cz) * insetScale,
      ];
    });

    // Note: mesh is rotated [-Math.PI / 2, 0, 0], where local (x, y) maps to world (x, -z)
    const shape = new THREE.Shape();
    pts2D.forEach(([wx, wz], idx) => {
      if (idx === 0) shape.moveTo(wx, -wz);
      else shape.lineTo(wx, -wz);
    });
    shape.closePath();

    const extrudeSettings = {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.018,
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    const bPts = pts2D.map(([wx, wz]) => new THREE.Vector3(wx, 0.15, wz));
    if (bPts.length > 0) bPts.push(bPts[0].clone());

    return {
      geometry: geo,
      borderPoints: bPts,
      center3D: [cx, 0.16, cz],
    };
  }, [territory]);

  // Smooth elevation animation on hover/select
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    let targetY = 0.02;
    if (isSource) targetY = 0.16;
    else if (isTarget) targetY = 0.13;
    else if (hovered) targetY = 0.09;
    else if (isValidTarget || isInitialPickable) targetY = 0.05;

    meshRef.current.position.y = THREE.MathUtils.lerp(
      meshRef.current.position.y,
      targetY,
      1 - Math.exp(-12 * delta)
    );
  });

  let color = '#efe8d5';
  if (owner) {
    color = isSource || hovered ? owner.color : owner.lightColor;
  } else if (isTarget) {
    color = '#fde047';
  } else if (hovered && (isValidTarget || isInitialPickable)) {
    color = '#fef08a';
  } else if (isValidTarget || isInitialPickable) {
    color = '#fef3c7';
  }

  let borderColor = '#334155';
  let borderWidth = 1.5;
  if (isSource) {
    borderColor = '#ffffff';
    borderWidth = 3.5;
  } else if (isTarget) {
    borderColor = '#ef4444';
    borderWidth = 3.5;
  } else if (isValidTarget) {
    borderColor = '#f59e0b';
    borderWidth = 2.5;
  }

  return (
    <group ref={meshRef}>
      <mesh
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect(territory.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <meshStandardMaterial
          color={color}
          roughness={0.72}
          metalness={0.05}
        />
      </mesh>

      {/* Hand-drawn style outline around the territory */}
      {borderPoints.length > 2 && (
        <Line
          points={borderPoints}
          color={borderColor}
          lineWidth={borderWidth}
        />
      )}

      {/* Territory Number Badge */}
      <Html position={center3D} center distanceFactor={11} zIndexRange={[10, 0]}>
        <div
          onClick={() => onSelect(territory.id)}
          className={`cursor-pointer select-none px-1.5 py-0.5 rounded-full text-[11px] font-extrabold border shadow-md transition-transform ${
            isSource
              ? 'scale-125 bg-white text-slate-950 border-amber-400 ring-2 ring-white'
              : isTarget
              ? 'scale-125 bg-rose-600 text-white border-white animate-pulse'
              : 'text-white border-white/80'
          }`}
          style={{
            backgroundColor: isSource
              ? '#ffffff'
              : isTarget
              ? '#e11d48'
              : owner
              ? owner.color
              : '#1e293b',
          }}
        >
          #{territory.label}
        </div>
      </Html>
    </group>
  );
}

export default function TableScene3D() {
  const room = useGameStore((s) => s.room);
  const mySocketId = useGameStore((s) => s.mySocketId);
  const onTerritoryClick = useGameStore((s) => s.onTerritoryClick);
  const setCameraZoom = useGameStore((s) => s.setCameraZoom);

  const map = room?.map;
  const playersMap = useMemo(() => {
    const m = {};
    room?.players?.forEach((p) => {
      m[p.id] = p;
    });
    return m;
  }, [room?.players]);

  if (!map) return null;

  const isMyTurn = room.activePlayerId === mySocketId;
  const selectedSource =
    room.selectedSourceId !== null ? map.territories[room.selectedSourceId] : null;
  const selectedTarget =
    room.selectedTargetId !== null ? map.territories[room.selectedTargetId] : null;

  const validTargetIds = new Set();
  if (isMyTurn && room.phase === 'TURN_SELECT') {
    if (selectedSource) {
      selectedSource.neighbors.forEach((nId) => {
        const nTerr = map.territories[nId];
        if (nTerr && nTerr.owner !== mySocketId) validTargetIds.add(nId);
      });
    } else {
      map.territories.forEach((t) => {
        if (t.owner === mySocketId) {
          t.neighbors.forEach((nId) => {
            const nTerr = map.territories[nId];
            if (nTerr && nTerr.owner !== mySocketId) validTargetIds.add(nId);
          });
        }
      });
    }
  }

  // 3D Attack/Target connector line points
  const actionLinePoints = useMemo(() => {
    if (!selectedSource || !selectedTarget) return null;
    const sx = (selectedSource.center[0] - 500) / 100;
    const sz = (selectedSource.center[1] - 350) / 100;
    const tx = (selectedTarget.center[0] - 500) / 100;
    const tz = (selectedTarget.center[1] - 350) / 100;
    const midX = (sx + tx) / 2;
    const midZ = (sz + tz) / 2;
    return [
      new THREE.Vector3(sx, 0.32, sz),
      new THREE.Vector3(midX, 0.65, midZ),
      new THREE.Vector3(tx, 0.32, tz),
    ];
  }, [selectedSource, selectedTarget]);

  const handleWheel = (e) => {
    const delta = e.deltaY > 0 ? 0.08 : -0.08;
    setCameraZoom((prev) => prev + delta);
  };

  return (
    <div
      onWheel={handleWheel}
      className="relative w-full h-full bg-gradient-to-b from-slate-950 via-slate-900 to-amber-950/30 select-none"
    >
      <Canvas
        shadows
        camera={{ position: [0, 7.8, 4.2], fov: 42, near: 0.1, far: 50 }}
      >
        <CK3CameraController />

        {/* Classroom / Strategy Table Lighting */}
        <ambientLight intensity={0.68} />
        <directionalLight
          castShadow
          position={[5, 11, 6]}
          intensity={1.25}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-7}
          shadow-camera-right={7}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
        />
        <pointLight position={[-5, 5, -4]} intensity={0.35} color="#fde68a" />

        {/* Wooden School Desk Surface */}
        <mesh position={[0, -0.22, 0]} receiveShadow>
          <boxGeometry args={[14.5, 0.4, 10.2]} />
          <meshStandardMaterial color="#78350f" roughness={0.85} />
        </mesh>

        {/* Notebook Paper Sheet Under the Territories */}
        <mesh position={[0, 0.0, 0]} receiveShadow>
          <boxGeometry args={[10.5, 0.04, 7.5]} />
          <meshStandardMaterial color="#f5f0dc" roughness={0.9} />
        </mesh>

        {/* Decorative School Pencils on the Desk Edge */}
        <group position={[-5.7, 0.1, 0]} rotation={[0, 0.08, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.08, 0.08, 4.2, 12]} />
            <meshStandardMaterial color="#eab308" roughness={0.5} />
          </mesh>
        </group>
        <group position={[5.7, 0.1, -0.6]} rotation={[0, -0.12, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.08, 0.08, 3.8, 12]} />
            <meshStandardMaterial color="#2563eb" roughness={0.5} />
          </mesh>
        </group>

        {/* Voronoi 3D Territories */}
        <group>
          {map.territories.map((t) => {
            const owner = t.owner ? playersMap[t.owner] : null;
            const isSource = room.selectedSourceId === t.id;
            const isTarget = room.selectedTargetId === t.id;
            const isValidTarget = validTargetIds.has(t.id);
            const isInitialPickable =
              room.phase === 'INITIAL_PICK' && isMyTurn && t.owner === null;

            return (
              <TerritoryMesh3D
                key={t.id}
                territory={t}
                owner={owner}
                isSource={isSource}
                isTarget={isTarget}
                isValidTarget={isValidTarget}
                isInitialPickable={isInitialPickable}
                onSelect={onTerritoryClick}
              />
            );
          })}
        </group>

        {/* 3D Action Arc between Source and Target */}
        {actionLinePoints && (
          <Line
            points={actionLinePoints}
            color={selectedTarget?.owner ? '#ef4444' : '#10b981'}
            lineWidth={4}
            dashed
            dashSize={0.2}
            gapSize={0.1}
          />
        )}

        {/* Rapier 3D Physics World for the School Eraser */}
        <Suspense fallback={null}>
          <Physics gravity={[0, -14, 0]}>
            {/* Table Floor Collider */}
            <RigidBody type="fixed" restitution={0.45} friction={0.65}>
              <CuboidCollider args={[7, 0.2, 5]} position={[0, -0.02, 0]} />
              {/* Invisible Rim Walls so the eraser stays on the table */}
              <CuboidCollider args={[7, 2, 0.2]} position={[0, 1.5, -4.2]} />
              <CuboidCollider args={[7, 2, 0.2]} position={[0, 1.5, 4.2]} />
              <CuboidCollider args={[0.2, 2, 5]} position={[-5.5, 1.5, 0]} />
              <CuboidCollider args={[0.2, 2, 5]} position={[5.5, 1.5, 0]} />
            </RigidBody>

            <Eraser3D
              eraserToss={room.eraserToss}
              territories={map.territories}
            />
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  );
}
