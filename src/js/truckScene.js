import * as THREE from './vendor/three.module.js';
import { FBXLoader } from './vendor/FBXLoader.js';
import { DecalGeometry } from './vendor/DecalGeometry.js';

// The supplied FBX model and textures are served locally with the homepage.
(() => {
  const host = document.getElementById('truckStage');
  const fallback = document.getElementById('truckFallback');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch (error) {
    console.warn('Truck rendering unavailable:', error);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  fallback.querySelector('strong').textContent = 'Loading your truck…';
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    fallback.hidden = false;
    renderer.domElement.hidden = true;
  });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, .1, 100);
  camera.position.set(0, 3.5, 12.5);
  camera.lookAt(0, 1.1, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x718078, 2.6));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(-3, 8, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
  sun.shadow.bias = -.001;
  scene.add(sun);
  const truck = new THREE.Group();
  scene.add(truck);
  const manager = new THREE.LoadingManager();
  let modelLoaded = false;
  manager.onLoad = () => {
    if (modelLoaded) fallback.hidden = true;
    schedule();
  };
  // These optional maps are referenced by the FBX but absent from the supplied folder.
  const neutralMap = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><path fill="#808080" d="M0 0h1v1H0z"/></svg>');
  manager.setURLModifier((url) => {
    if (/(?:Reflections_1_ENV\.jpg|Carbadges_misc_U_height\.jpg)$/i.test(url)) return neutralMap;
    if (/\.(jpg|png)$/i.test(url)) return 'assets/textures/' + url.replaceAll('\\', '/').split('/').pop();
    return url;
  });
  const loader = new FBXLoader(manager);
  loader.load('assets/source/LCT13_07.fbx', (model) => {
    // The supplied truck points along +X; turn its front toward the +Z camera.
    model.rotation.y = -Math.PI / 2;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    model.scale.multiplyScalar(5.8 / Math.max(size.x, size.y, size.z));
    bounds.setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
    model.traverse((part) => {
      if (!part.isMesh) return;
      part.castShadow = true;
      part.receiveShadow = true;
      const materials = Array.isArray(part.material) ? part.material : [part.material];
      materials.forEach((material) => {
        material.envMap = null;
        // The source assigns grayscale height images as normal maps.
        material.normalMap = null;
        if (material.name === 'LCT13_07_Bodymat') material.color.set('#1e6b4d');
        material.needsUpdate = true;
      });
    });
    // Project branding onto the cargo body so it follows the panel contours.
    // Build in the model's neutral pose before the scrolling parent rotates it.
    model.updateMatrixWorld(true);
    const body = model.getObjectByName('LCT300007_Body');
    if (body) {
      const branding = new THREE.MeshStandardMaterial({
        color: '#dff1e8', roughness: .65, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -4
      });
      for (const side of [-1, 1]) {
        const decal = new THREE.Mesh(new DecalGeometry(
          body, new THREE.Vector3(side * 1.02, 1.9, -1.2),
          new THREE.Euler(0, side * Math.PI / 2, 0),
          new THREE.Vector3(2.35, 1.4, .5)
        ), branding);
        truck.add(decal);
      }
      new THREE.TextureLoader().load('assets/images/el_logo_brand.png', (texture) => {
        // Compose a readable livery panel without changing the supplied image.
        const canvas = document.createElement('canvas');
        canvas.width = 1200; canvas.height = 715;
        const context = canvas.getContext('2d');
        context.fillStyle = '#dff1e8';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(texture.image, 121, 373, 1016, 559, 60, 60, 1080, 594);
        texture.image = canvas;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.needsUpdate = true;
        branding.color.set('#ffffff');
        branding.map = texture;
        branding.needsUpdate = true;
        schedule();
      }, undefined, (error) => console.error('Could not load truck branding:', error));
    }
    truck.add(model);
    modelLoaded = true;
    schedule();
  }, undefined, (error) => {
    fallback.hidden = false;
    fallback.querySelector('strong').textContent = 'Truck preview unavailable. Please reload to try again.';
    console.error('Could not load truck model:', error);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .13 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const journey = document.getElementById('journey');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const smooth = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); };
  let frame = 0;
  const render = () => {
    frame = 0;
    const p = reduced.matches ? 0 : clamp((84 - journey.getBoundingClientRect().top) / Math.max(1, journey.offsetHeight - window.innerHeight));
    truck.rotation.y = reduced.matches ? .9 : smooth(p / .6) * Math.PI / 2;
    truck.position.x = reduced.matches ? 0 : smooth((p - .62) / .38) * 15;
    document.getElementById('journeyProgress').style.transform = `scaleX(${p})`;
    document.getElementById('journeyLabel').textContent = p < .3 ? '01 / AGREE ON THE JOURNEY' : p < .65 ? '02 / MOVE THROUGH EACH MILESTONE' : '03 / VERIFIED PROGRESS. RELEASED PAYMENT.';
    renderer.render(scene, camera);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
  const resize = () => {
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.position.z = Math.max(12.5, 8 / camera.aspect);
    camera.updateProjectionMatrix();
    schedule();
  };
  new ResizeObserver(resize).observe(host);
  window.addEventListener('scroll', schedule, { passive: true });
  reduced.addEventListener('change', schedule);
  resize();
})();
