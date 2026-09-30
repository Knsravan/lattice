/**
 * Minimal types for the parts of Three.js r170 that Scene 4 uses.
 * Three.js is loaded at runtime from the CDN via the import map in index.html — never installed —
 * so these declarations stand in for @types/three.
 */
declare module "three" {
  type ColorLike = string | number | Color;
  export class Vector2 {
    constructor(x?: number, y?: number);
    x: number; y: number;
    set(x: number, y: number): this;
  }
  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number; y: number; z: number;
    set(x: number, y: number, z: number): this;
    setScalar(s: number): this;
    clone(): Vector3;
    length(): number;
    multiplyScalar(s: number): this;
    lerpVectors(a: Vector3, b: Vector3, t: number): this;
  }
  export class Euler { x: number; y: number; z: number }
  export class Quaternion { setFromUnitVectors(from: Vector3, to: Vector3): this }
  export class Matrix4 {}
  export class Color {
    constructor(c?: ColorLike);
    lerpColors(a: Color, b: Color, t: number): this;
  }
  export class Object3D {
    position: Vector3; scale: Vector3; rotation: Euler; quaternion: Quaternion; matrix: Matrix4;
    visible: boolean;
    add(...objects: Object3D[]): this;
    updateMatrix(): void;
    lookAt(x: number, y: number, z: number): void;
  }
  export class Group extends Object3D {}
  export class Scene extends Object3D { fog: Fog | null }
  export class Fog { constructor(color: ColorLike, near?: number, far?: number) }
  export class Camera extends Object3D { getWorldDirection(target: Vector3): Vector3 }
  export class PerspectiveCamera extends Camera {
    constructor(fov: number, aspect: number, near: number, far: number);
    aspect: number;
    updateProjectionMatrix(): void;
  }
  export class AmbientLight extends Object3D { constructor(color?: ColorLike, intensity?: number) }
  export class DirectionalLight extends Object3D { constructor(color?: ColorLike, intensity?: number) }
  export class BufferAttribute {
    constructor(array: Float32Array, itemSize: number);
    array: Float32Array;
    needsUpdate: boolean;
    setXYZ(i: number, x: number, y: number, z: number): this;
  }
  export class BufferGeometry { setAttribute(name: string, a: BufferAttribute): this; setIndex(index: number[]): this; setDrawRange(start: number, count: number): void; dispose(): void }
  export const DoubleSide: number;
  export class ShaderMaterial extends Material {
    constructor(p: { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string;
      transparent?: boolean; depthWrite?: boolean; depthTest?: boolean; blending?: number; side?: number });
    uniforms: Record<string, { value: unknown }>;
  }
  export class Texture { dispose(): void }
  export class CanvasTexture extends Texture { constructor(canvas: HTMLCanvasElement) }
  export const AdditiveBlending: number;
  export class PointsMaterial extends Material {
    constructor(p?: MaterialParams & { size?: number; sizeAttenuation?: boolean; vertexColors?: boolean; map?: Texture; depthWrite?: boolean; blending?: number });
    opacity: number;
    size: number;
  }
  export class Points extends Object3D { constructor(g: BufferGeometry, m: Material); frustumCulled: boolean; renderOrder: number }
  export class SphereGeometry extends BufferGeometry { constructor(radius?: number, wSeg?: number, hSeg?: number) }
  export class CylinderGeometry extends BufferGeometry { constructor(rTop?: number, rBottom?: number, height?: number, seg?: number) }
  export class ConeGeometry extends BufferGeometry { constructor(radius?: number, height?: number, seg?: number) }
  interface MaterialParams { color?: ColorLike; wireframe?: boolean; transparent?: boolean; opacity?: number; blending?: number; depthWrite?: boolean; depthTest?: boolean; map?: Texture }
  export class Material { opacity: number; dispose(): void }
  export class MeshBasicMaterial extends Material { constructor(p?: MaterialParams); color: Color }
  export class MeshLambertMaterial extends Material { constructor(p?: MaterialParams); color: Color }
  export class LineBasicMaterial extends Material { constructor(p?: MaterialParams); color: Color }
  export class Mesh extends Object3D { constructor(g: BufferGeometry, m: Material); renderOrder: number }
  export class InstancedMesh extends Mesh {
    constructor(g: BufferGeometry, m: Material, count: number);
    count: number;
    instanceMatrix: BufferAttribute;
    instanceColor: BufferAttribute | null;
    setMatrixAt(i: number, m: Matrix4): void;
    setColorAt(i: number, c: Color): void;
  }
  export class Line extends Object3D { constructor(g: BufferGeometry, m: Material); renderOrder: number }
  export class Plane { constructor(normal?: Vector3, constant?: number) }
  export class Ray { intersectPlane(plane: Plane, target: Vector3): Vector3 | null }
  export class Raycaster { ray: Ray; setFromCamera(ndc: Vector2, camera: Camera): void }
  export class WebGLRenderer {
    constructor(p?: { antialias?: boolean; alpha?: boolean });
    domElement: HTMLCanvasElement;
    setPixelRatio(r: number): void;
    getPixelRatio(): number;
    setSize(w: number, h: number, updateStyle?: boolean): void;
    render(scene: Scene, camera: Camera): void;
    dispose(): void;
  }
}

declare module "three/addons/controls/OrbitControls.js" {
  import type { Camera } from "three";
  export class OrbitControls {
    constructor(camera: Camera, dom: HTMLElement);
    enableDamping: boolean; enablePan: boolean; minDistance: number; maxDistance: number;
    update(): boolean;
    dispose(): void;
  }
}
