// three.js r186 n'existe plus qu'en modules ES. L'éditeur, lui, est fait de scripts classiques
// qui partagent une portée globale : ce module expose three et ses extensions sous `THREE`,
// puis charge les scripts de l'éditeur un par un, dans l'ordre, comme le faisaient les balises.
import * as core from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

globalThis.THREE = Object.assign({}, core, { GLTFLoader, GLTFExporter, RoomEnvironment, RoundedBoxGeometry, EffectComposer, RenderPass, GTAOPass, OutputPass, BufferGeometryUtils });

const EDITOR_MODULES = ['defaults', 'catalog-extra', 'catalog-detail', 'architecture-core', 'architecture-ui', 'navigation', 'manipulation', 'equipment', 'building', 'circulation', 'project', 'rooms', 'presentation', 'editor'];
function load(name) {
 return new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = 'editor-assets/' + name + '.js';
  script.async = false;
  script.onload = resolve;
  script.onerror = () => reject(Error('Module introuvable : ' + name + '.js'));
  document.body.appendChild(script);
 });
}
try { for (const name of EDITOR_MODULES) await load(name); }
catch (error) {
 const loading = document.getElementById('loading');
 if (loading) { loading.hidden = false; loading.textContent = error.message + ' Rechargez la page.'; }
 throw error;
}
