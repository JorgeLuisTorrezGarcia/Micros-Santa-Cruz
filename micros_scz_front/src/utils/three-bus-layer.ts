import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import type { Coordinates } from '../types.ts';

/**
 * ThreeBusLayer:
 * Custom WebGL layer for MapLibre GL JS rendering an ultra-crisp, stylized 3D
 * Microbús cruceño (Toyota Coaster style) and a 3D walking pedestrian avatar.
 *
 * Uses MapLibre's Mercator unit space multiplied with Three.js camera projection
 * matrix (m.multiply(l)) to ensure zero float-precision loss on modern GPUs.
 * Features dynamic soft shadows, forward headlight projection, and PBR lighting.
 */
export class ThreeBusLayer implements maplibregl.CustomLayerInterface {
  public id = 'three-bus-3d-layer';
  public type: 'custom' = 'custom';
  public renderingMode: '3d' = '3d';

  private map: maplibregl.Map | null = null;
  private camera = new THREE.Camera();
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer | null = null;

  // 3D Subject Groups (anchored at local (0, 0, 0))
  private busGroup = new THREE.Group();
  private pedestrianGroup = new THREE.Group();

  // Dynamic Mesh References for Real-time Branding Updates
  private busStripeMesh: THREE.Mesh | null = null;
  private roofSignCanvas: HTMLCanvasElement | null = null;
  private roofSignTexture: THREE.CanvasTexture | null = null;
  private pedJacketMesh: THREE.Mesh | null = null;

  // Animation & Transform State
  private currentCoords: Coordinates = [-63.18, -17.78];
  private currentBearing = 0;
  private isBusActive = true;
  private isPedestrianActive = false;
  private currentLineLabel = 'L-72';
  private currentLineColor = '#10b981';

  constructor() {
    this.camera.matrixAutoUpdate = false;
    this.setupScene();
  }

  private setupScene() {
    // 1. High-illumination Lighting Rig to guarantee vibrant visibility at all camera angles
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffdf5, 2.8);
    sunLight.position.set(25, -35, 60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -15;
    sunLight.shadow.camera.right = 15;
    sunLight.shadow.camera.top = 15;
    sunLight.shadow.camera.bottom = -15;
    sunLight.shadow.bias = -0.001;
    this.scene.add(sunLight);

    const skyFillLight = new THREE.DirectionalLight(0xdbeafe, 1.5);
    skyFillLight.position.set(-25, 35, 40);
    this.scene.add(skyFillLight);

    const groundReflectLight = new THREE.DirectionalLight(0xfef3c7, 0.9);
    groundReflectLight.position.set(0, 0, -20);
    this.scene.add(groundReflectLight);

    // 2. Build Procedural 3D Microbús Cruceño
    this.buildBusModel();

    // 3. Build Procedural 3D Walking Pedestrian Character
    this.buildPedestrianModel();

    this.scene.add(this.busGroup);
    this.scene.add(this.pedestrianGroup);
  }

  /**
   * Procedural Toyota Coaster / Santa Cruz microbus model.
   * Model units are in meters:
   * Width (X): ~3.2m, Length (Y): ~8.6m, Height (Z): ~3.4m
   * +Y faces forward (North when bearing = 0)
   * +Z is Up
   */
  private buildBusModel() {
    this.busGroup.clear();

    const width = 3.2;
    const length = 8.6;
    const height = 3.2;

    // --- 1. Lower Chassis (Bright Glossy White/Off-White) ---
    const lowerBodyGeo = new THREE.BoxGeometry(width, length, height * 0.52);
    const lowerBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.22,
      metalness: 0.12,
    });
    const lowerBody = new THREE.Mesh(lowerBodyGeo, lowerBodyMat);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    lowerBody.position.set(0, 0, height * 0.26 + 0.5);
    this.busGroup.add(lowerBody);

    // --- 2. Iconic Santa Cruz Transit Line Color Stripe ---
    const stripeGeo = new THREE.BoxGeometry(width + 0.06, length * 0.98, height * 0.24);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.currentLineColor),
      roughness: 0.18,
      metalness: 0.25,
      emissive: new THREE.Color(this.currentLineColor),
      emissiveIntensity: 0.28,
    });
    this.busStripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
    this.busStripeMesh.castShadow = true;
    this.busStripeMesh.position.set(0, 0, height * 0.28 + 0.5);
    this.busGroup.add(this.busStripeMesh);

    // --- 3. Cabin & Panoramic Tinted Windows ---
    const windowGeo = new THREE.BoxGeometry(width - 0.08, length * 0.92, height * 0.44);
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.08,
      metalness: 0.88,
    });
    const windows = new THREE.Mesh(windowGeo, windowMat);
    windows.castShadow = true;
    windows.position.set(0, 0, height * 0.68 + 0.5);
    this.busGroup.add(windows);

    // --- 4. Aerodynamic Curved White Roof ---
    const roofGeo = new THREE.BoxGeometry(width + 0.02, length * 0.96, 0.28);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.28,
      metalness: 0.15,
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.castShadow = true;
    roof.position.set(0, 0, height + 0.55);
    this.busGroup.add(roof);

    // Roof AC Climate Unit (Metallic Silver with Dual Fans)
    const acBaseGeo = new THREE.BoxGeometry(width * 0.65, 2.4, 0.45);
    const acMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.35,
      metalness: 0.65,
    });
    const acUnit = new THREE.Mesh(acBaseGeo, acMat);
    acUnit.castShadow = true;
    acUnit.position.set(0, -0.6, height + 0.82);
    this.busGroup.add(acUnit);

    // AC Fan Grilles
    const fanGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16);
    const fanMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    const fan1 = new THREE.Mesh(fanGeo, fanMat);
    fan1.rotation.x = Math.PI / 2;
    fan1.position.set(0, -0.2, height + 1.05);
    this.busGroup.add(fan1);

    const fan2 = new THREE.Mesh(fanGeo, fanMat);
    fan2.rotation.x = Math.PI / 2;
    fan2.position.set(0, -1.0, height + 1.05);
    this.busGroup.add(fan2);

    // --- 5. Front & Rear Chrome Bumpers ---
    const bumperMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.1,
    });

    const frontBumperGeo = new THREE.BoxGeometry(width + 0.1, 0.45, 0.45);
    const frontBumper = new THREE.Mesh(frontBumperGeo, bumperMat);
    frontBumper.castShadow = true;
    frontBumper.position.set(0, length / 2 + 0.2, 0.45);
    this.busGroup.add(frontBumper);

    const rearBumperGeo = new THREE.BoxGeometry(width + 0.1, 0.45, 0.45);
    const rearBumper = new THREE.Mesh(rearBumperGeo, bumperMat);
    rearBumper.castShadow = true;
    rearBumper.position.set(0, -length / 2 - 0.2, 0.45);
    this.busGroup.add(rearBumper);

    // --- 6. Four Sturdy Wheels with Chrome Hubcaps ---
    const tireRadius = 0.62;
    const tireWidth = 0.42;
    const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 20);
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
      metalness: 0.1,
    });

    const hubcapGeo = new THREE.CylinderGeometry(tireRadius * 0.52, tireRadius * 0.52, tireWidth + 0.04, 16);
    const hubcapMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.88,
      roughness: 0.18,
    });

    const wheelPositions = [
      [-width / 2 - 0.08, length * 0.32, tireRadius], // Front Left
      [width / 2 + 0.08, length * 0.32, tireRadius],  // Front Right
      [-width / 2 - 0.08, -length * 0.28, tireRadius], // Rear Left
      [width / 2 + 0.08, -length * 0.28, tireRadius],  // Rear Right
    ];

    wheelPositions.forEach(([wx, wy, wz]) => {
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(wx, wy, wz);
      tire.castShadow = true;
      this.busGroup.add(tire);

      const hubcap = new THREE.Mesh(hubcapGeo, hubcapMat);
      hubcap.rotation.z = Math.PI / 2;
      hubcap.position.set(wx, wy, wz);
      this.busGroup.add(hubcap);
    });

    // --- 7. Dual Headlights (Front Warm Beam Glow) ---
    const headlightGeo = new THREE.BoxGeometry(0.55, 0.15, 0.35);
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 2.5,
    });

    const leftHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
    leftHeadlight.position.set(-width * 0.34, length / 2 + 0.04, 0.95);
    this.busGroup.add(leftHeadlight);

    const rightHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
    rightHeadlight.position.set(width * 0.34, length / 2 + 0.04, 0.95);
    this.busGroup.add(rightHeadlight);

    // Forward Warm Headlight Beam illuminating the street in front
    const beamGeo = new THREE.ConeGeometry(3.2, 9.0, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const headlightBeam = new THREE.Mesh(beamGeo, beamMat);
    headlightBeam.rotation.x = -Math.PI / 2;
    headlightBeam.position.set(0, length / 2 + 4.5, 0.4);
    this.busGroup.add(headlightBeam);

    // --- 8. Dual Taillights (Rear Vivid Red Glow) ---
    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 2.5,
    });

    const leftTail = new THREE.Mesh(headlightGeo, taillightMat);
    leftTail.position.set(-width * 0.34, -length / 2 - 0.04, 1.05);
    this.busGroup.add(leftTail);

    const rightTail = new THREE.Mesh(headlightGeo, taillightMat);
    rightTail.position.set(width * 0.34, -length / 2 - 0.04, 1.05);
    this.busGroup.add(rightTail);

    // --- 9. Front Illuminated Route Sign (Canvas Texture) ---
    this.createRoofSign(width);

    // --- 10. Soft Asphalt Ground Shadow Disc ---
    const shadowGeo = new THREE.PlaneGeometry(width * 1.5, length * 1.35);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.set(0, 0, 0.08);
    shadow.receiveShadow = true;
    this.busGroup.add(shadow);
  }

  /**
   * Builds the illuminated front route destination sign.
   */
  private createRoofSign(width: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    this.roofSignCanvas = canvas;
    this.updateRoofSignCanvas();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    this.roofSignTexture = texture;

    const signMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: false,
    });

    const signGeo = new THREE.BoxGeometry(width * 0.85, 0.35, 0.75);
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.position.set(0, 3.8, 2.9);
    signMesh.castShadow = true;
    this.busGroup.add(signMesh);
  }

  private updateRoofSignCanvas() {
    if (!this.roofSignCanvas) return;
    const ctx = this.roofSignCanvas.getContext('2d');
    if (!ctx) return;

    // Premium dark border with line color accent
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 512, 192);

    // Vibrant line brand bar
    ctx.fillStyle = this.currentLineColor;
    ctx.fillRect(0, 0, 512, 34);

    // Inner glowing display plate
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(16, 44, 480, 134);

    // Route Number Text (e.g. L-72)
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.currentLineLabel.replace('Línea ', 'L-'), 256, 112);

    if (this.roofSignTexture) {
      this.roofSignTexture.needsUpdate = true;
    }
  }

  /**
   * Procedural 3D Walking Pedestrian Avatar with backpack, cap and walking posture.
   * Model units in meters: Height ~3.6m for clear visibility on map perspective.
   */
  private buildPedestrianModel() {
    this.pedestrianGroup.clear();

    const charHeight = 3.6;

    // --- Ground Glowing Pulse Disk ---
    const ringGeo = new THREE.RingGeometry(1.2, 2.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0, 0.1);
    ring.receiveShadow = true;
    this.pedestrianGroup.add(ring);

    const innerCircleGeo = new THREE.CircleGeometry(1.0, 32);
    const innerCircleMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const innerCircle = new THREE.Mesh(innerCircleGeo, innerCircleMat);
    innerCircle.position.set(0, 0, 0.08);
    this.pedestrianGroup.add(innerCircle);

    // --- Legs (Jeans & White Sneakers in Walking Stride) ---
    const legGeo = new THREE.CylinderGeometry(0.22, 0.2, 1.3, 12);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 });

    const shoeGeo = new THREE.BoxGeometry(0.35, 0.65, 0.25);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });

    // Left leg forward
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.rotation.x = -Math.PI / 10;
    leftLeg.position.set(-0.35, 0.25, 0.85);
    leftLeg.castShadow = true;
    this.pedestrianGroup.add(leftLeg);

    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(-0.35, 0.45, 0.16);
    leftShoe.castShadow = true;
    this.pedestrianGroup.add(leftShoe);

    // Right leg backward
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.rotation.x = Math.PI / 10;
    rightLeg.position.set(0.35, -0.25, 0.85);
    rightLeg.castShadow = true;
    this.pedestrianGroup.add(rightLeg);

    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rightShoe.position.set(0.35, -0.45, 0.16);
    rightShoe.castShadow = true;
    this.pedestrianGroup.add(rightShoe);

    // --- Torso & Jacket ---
    const torsoGeo = new THREE.BoxGeometry(1.1, 0.7, 1.3);
    const jacketMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.3,
      metalness: 0.1,
    });
    this.pedJacketMesh = new THREE.Mesh(torsoGeo, jacketMat);
    this.pedJacketMesh.position.set(0, 0, 2.05);
    this.pedJacketMesh.castShadow = true;
    this.pedestrianGroup.add(this.pedJacketMesh);

    // Backpack on the back (-Y)
    const packGeo = new THREE.BoxGeometry(0.85, 0.45, 1.0);
    const packMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const pack = new THREE.Mesh(packGeo, packMat);
    pack.position.set(0, -0.45, 2.05);
    pack.castShadow = true;
    this.pedestrianGroup.add(pack);

    // --- Arms (Walking Swing) ---
    const armGeo = new THREE.CylinderGeometry(0.16, 0.14, 1.1, 12);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4 });

    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.rotation.x = Math.PI / 8;
    leftArm.position.set(-0.7, -0.2, 1.85);
    leftArm.castShadow = true;
    this.pedestrianGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.rotation.x = -Math.PI / 8;
    rightArm.position.set(0.7, 0.2, 1.85);
    rightArm.castShadow = true;
    this.pedestrianGroup.add(rightArm);

    // --- Head & Stylized Baseball Cap ---
    const headGeo = new THREE.SphereGeometry(0.48, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.4 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0, 2.95);
    head.castShadow = true;
    this.pedestrianGroup.add(head);

    // Cap Dome & Visor
    const capGeo = new THREE.SphereGeometry(0.52, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 0, 3.02);
    cap.castShadow = true;
    this.pedestrianGroup.add(cap);

    const visorGeo = new THREE.BoxGeometry(0.65, 0.45, 0.08);
    const visor = new THREE.Mesh(visorGeo, capMat);
    visor.position.set(0, 0.48, 3.02);
    visor.castShadow = true;
    this.pedestrianGroup.add(visor);

    // --- Floating Destination Diamond / Aura Beacon Above Head ---
    const beaconGeo = new THREE.OctahedronGeometry(0.45, 0);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.8,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 0, charHeight + 0.4);
    this.pedestrianGroup.add(beacon);
  }

  /**
   * Updates state from animation trajectory sampler.
   */
  public updateState(params: {
    coords: Coordinates;
    bearingDeg: number;
    isBus: boolean;
    lineLabel: string;
    lineColor: string;
  }) {
    this.currentCoords = params.coords;
    this.currentBearing = params.bearingDeg;
    this.isBusActive = params.isBus;
    this.isPedestrianActive = !params.isBus;

    if (params.lineColor !== this.currentLineColor) {
      this.currentLineColor = params.lineColor;
      if (this.busStripeMesh) {
        (this.busStripeMesh.material as THREE.MeshStandardMaterial).color.set(params.lineColor);
        (this.busStripeMesh.material as THREE.MeshStandardMaterial).emissive.set(params.lineColor);
      }
      if (this.pedJacketMesh) {
        (this.pedJacketMesh.material as THREE.MeshStandardMaterial).color.set(params.lineColor);
      }
    }

    if (params.lineLabel !== this.currentLineLabel) {
      this.currentLineLabel = params.lineLabel;
      this.updateRoofSignCanvas();
    }
  }

  // --- MapLibre CustomLayerInterface methods ---

  public onAdd(map: maplibregl.Map, gl: WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    });
    this.renderer.autoClear = false;
    this.renderer.autoClearDepth = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public render: maplibregl.CustomLayerInterface['render'] = (_gl: WebGL2RenderingContext, options: any) => {
    if (!this.map || !this.renderer) return;

    // Convert geographic coordinates [lon, lat] to Mercator coordinates
    const mercator = maplibregl.MercatorCoordinate.fromLngLat(
      this.currentCoords,
      0
    );

    const scale = mercator.meterInMercatorCoordinateUnits();

    // MapLibre GL v6 passes options containing defaultProjectionData.mainMatrix or modelViewProjectionMatrix
    const rawMatrix =
      options?.defaultProjectionData?.mainMatrix ||
      options?.modelViewProjectionMatrix ||
      options?.projectionMatrix ||
      (Array.isArray(options) ? options : null);

    if (!rawMatrix) return;

    // Optimal scale multiplier: 2.8x ensures the 3D subject is prominently visible
    // and easily readable in vertical (9:16) video and desktop playback
    const modelScale = scale * 2.8;

    // MapLibre's projection matrix
    const m = new THREE.Matrix4().fromArray(rawMatrix);

    // Compute model transform matrix l:
    // 1. Translate to Mercator coordinate
    // 2. Scale by (modelScale, -modelScale, modelScale) to invert Y southwards
    // 3. Rotate around Z axis by vehicle bearing (-rad)
    const rad = (this.currentBearing * Math.PI) / 180;
    const l = new THREE.Matrix4()
      .makeTranslation(mercator.x, mercator.y, mercator.z)
      .scale(new THREE.Vector3(modelScale, -modelScale, modelScale))
      .multiply(new THREE.Matrix4().makeRotationZ(-rad));

    // Bind combined projection matrix to Three.js camera
    this.camera.projectionMatrix = m.multiply(l);

    // Toggle active subject
    this.busGroup.visible = this.isBusActive;
    this.pedestrianGroup.visible = this.isPedestrianActive;

    // Render Three.js overlay
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);

    this.map.triggerRepaint();
  };

  public onRemove() {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.map = null;
  }
}
