import * as THREE from 'three';
import { gsap } from "gsap";
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import * as CameraUtils from 'three/addons/utils/CameraUtils.js';
import colorsea from 'colorsea'

//Needed hack for pivot points
THREE.Object3D.prototype.updateMatrix = function () {

  this.matrix.compose( this.position, this.quaternion, this.scale );

  if ( this.pivot && this.pivot.isVector3 ) {

    var px = this.pivot.x;
    var py = this.pivot.y;
    var pz = this.pivot.z;

    var te = this.matrix.elements;

    te[ 12 ] += px - te[ 0 ] * px - te[ 4 ] * py - te[ 8 ] * pz;
    te[ 13 ] += py - te[ 1 ] * px - te[ 5 ] * py - te[ 9 ] * pz;
    te[ 14 ] += pz - te[ 2 ] * px - te[ 6 ] * py - te[ 10 ] * pz;

  }

  this.matrixWorldNeedsUpdate = true;

};


const loader = new FontLoader();
const gltfLoader = new GLTFLoader();
let posVar = new THREE.Vector3();
let scaleVar = new THREE.Vector3();
let draggable = [];
let mouseOverable = [];
let clickable = [];
let inputPrompts = [];
let inputText = [];
let selectorElems = [];
let toggles = [];
let clippedMeshes = [];//Everything that is clipped locally needs to have the tranform matrixes updated in render
let stencilRefs = [];//For assigning a unique stencil ref to each clipped material
let meshViews = [];
let portals = [];
let panels = [];

//Need pools for scenes to manage meshView content
const SCENE_MAX = 32;
let scenePool = [];
let cameraPool = [];

//Interaction variables
let mouseDown = false;
let isDragging = false;
let lastDragged = undefined;
let previousMouseX = 0;
let previousMouseY = 0;
let moveDir = 1;
let dragDistX = 0;
let dragDistY = 0;
let lastClick = 0;
let mouseOver = [];

//CUSTOM GEOMOETRIES
function RoundedPlaneGeometry( width, height, radius, smoothness ) {
    
    const pi2 = Math.PI * 2;
    const n = ( smoothness + 1 ) * 4; // number of segments    
    let indices = [];
    let positions = [];
  let uvs = [];   
    let qu, sgx, sgy, x, y;
    
  for ( let j = 1; j < n + 1; j ++ ) indices.push( 0, j, j + 1 ); // 0 is center
    indices.push( 0, n, 1 );   
    positions.push( 0, 0, 0 ); // rectangle center
    uvs.push( 0.5, 0.5 );   
    for ( let j = 0; j < n ; j ++ ) contour( j );
    
    const geometry = new THREE.BufferGeometry( );
    geometry.setIndex( new THREE.BufferAttribute( new Uint32Array( indices ), 1 ) );
  geometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array( positions ), 3 ) );
  geometry.setAttribute( 'uv', new THREE.BufferAttribute( new Float32Array( uvs ), 2 ) );
  geometry.center();
    
    return geometry;
    
    function contour( j ) {
        
        qu = Math.trunc( 4 * j / n ) + 1 ;      // quadrant  qu: 1..4         
        sgx = ( qu === 1 || qu === 4 ? 1 : -1 ) // signum left/right
        sgy =  qu < 3 ? 1 : -1;                 // signum  top / bottom
        x = sgx * ( width / 2 - radius ) + radius * Math.cos( pi2 * ( j - qu + 1 ) / ( n - 4 ) ); // corner center + circle
        y = sgy * ( height / 2 - radius ) + radius * Math.sin( pi2 * ( j - qu + 1 ) / ( n - 4 ) );   
 
        positions.push( x, y, 0 );       
        uvs.push( 0.5 + x / width, 0.5 + y / height );       
        
    }
    
}

function RoundedBoxGeometry(width, height, depth, radius, smoothness, zOffset=1){
  const shape = new THREE.Shape();
  let eps = 0.00001;
  let _radius = radius - eps;
  shape.absarc( eps, eps, eps, -Math.PI / 2, -Math.PI, true );
  shape.absarc( eps, height -  radius * 2, eps, Math.PI, Math.PI / 2, true );
  shape.absarc( width - radius * 2, height -  radius * 2, eps, Math.PI / 2, 0, true );
  shape.absarc( width - radius * 2, eps, eps, 0, -Math.PI / 2, true );

  const extrudeSettings = {
    depth: depth,
    bevelEnabled: true,
    bevelSegments: smoothness * 2,
    steps: 1,
    bevelSize: _radius,
    bevelThickness: zOffset*radius,
    curveSegments: smoothness
  };

  const geometry = new THREE.ExtrudeGeometry( shape, extrudeSettings );
  geometry.center();
  BufferGeometryUtils.mergeVertices(geometry);
  geometry.computeVertexNormals();


  return geometry
}

function addMorphToGeometry(geometry, morphGeometry, morphName){
  let verts  = [...morphGeometry.attributes.position.array];
  geometry.morphAttributes[Object.keys(geometry.morphAttributes).length-1] = {name: morphName, vertices: verts};
}

export function attachToInnerTop(parent, elem, depth){
  elem.box.position.set(elem.box.position.x, elem.box.position.y+parent.height/2, depth);
};

export function attachToOuterTop(parent, elem, depth){
  elem.box.position.set(elem.box.position.x, elem.box.position.y+parent.height/2+elem.height/2, depth);
};

export function attachToInnerBottom(parent, elem, depth){
  elem.box.position.set(elem.box.position.x, elem.box.position.y-parent.height/2, depth);
};

export function attachToOuterBottom(parent, elem, depth){
  elem.box.position.set(elem.box.position.x, elem.box.position.y-parent.height/2-elem.height/2, depth);
};

export function attachToInnerLeft(parent, elem, depth){
  elem.box.position.set(elem.box.position.x-parent.height/2, elem.box.position.y, elem.box.position.z);
};

export function attachToOuterLeft(parent, elem, depth){
  elem.box.position.set(elem.box.position.x-parent.height/2-elem.height/2, elem.box.position.y, elem.box.position.z);
};

export function attachToInnerRight(parent, elem, depth){
  elem.box.position.set(elem.box.position.x+parent.width/2, elem.box.position.y, elem.box.position.z);
};

export function attachToOuterRight(parent, elem, depth){
  elem.box.position.set(elem.box.position.x+parent.width/2+elem.width/2, elem.box.position.y, elem.box.position.z);
};

export function createMainSceneLighting(scene){
  const ambientLight = new THREE.AmbientLight(0x404040);
  ambientLight.name = 'MAIN_AMBIENT_LIGHT'
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.name = 'MAIN_DIRECTIONAL_LIGHT'
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);
};

function getMainCam(scene){
  const cameras = scene.getObjectsByProperty( 'isCamera', true );
  let result = undefined;

  cameras.forEach((cam) => {
    if(cam.name=='MAIN_CAM'){
      result = cam;
    }
  });

  return result
}

function getMainAmbientLight(scene){
  const lights = scene.getObjectsByProperty( 'isLight', true );
  let result = undefined;

  lights.forEach((light) => {
    if(light.name == 'MAIN_AMBIENT_LIGHT'){
      result = light;
    }
  });

  return result
}

function getMainDirectionalLight(scene){
  const lights = scene.getObjectsByProperty( 'isLight', true );
  let result = undefined;

  lights.forEach((light) => {
    if(light.name == 'MAIN_DIRECTIONAL_LIGHT'){
      result = light;
    }
  });

  return result
}

function addSceneToPool(){
  
  if (scenePool.length >= SCENE_MAX)
    return;

  const scene = new THREE.Scene();
  scenePool.push(scene);
  const layer_index = scenePool.indexOf(scene)+1;
  scene.userData.layer_index = layer_index;

  return scene
}

function removeSceneFromPool(scene){
  index = scenePool.indexOf(scene);
  scenePool.splice(index, 1);
}

function addCameraToPool(scene){
  
  if (cameraPool.length >= SCENE_MAX)
    return;

  const mainCam = getMainCam(scene);
  const camera = mainCam.clone();
  mainCam.add(camera);
  cameraPool.push(camera);
  const layer_index = cameraPool.indexOf(camera)+1;
  camera.userData.layer_index = layer_index;

  return camera
}

function removeCameraFromPool(camera){
  index = cameraPool.indexOf(camera);
  cameraPool.splice(index, 1);
}

function computeScreenSpaceBoundingBox(boundingBox, meshView, camera) {

  const positionAttribute = meshView.box.geometry.getAttribute( 'position' );
  const vertex = new THREE.Vector3();
  let min = new THREE.Vector3(1, 1, 1);
  let max = new THREE.Vector3(-1, -1, -1);
  
  boundingBox.set(min, max);

  for ( let vertexIndex = 0; vertexIndex < positionAttribute.count; vertexIndex ++ ) {

    let vertexWorldCoord = vertex.copy(vertex.fromBufferAttribute( positionAttribute, vertexIndex )).applyMatrix4(meshView.box.matrixWorld);
    vertexWorldCoord.y -= meshView.height;
    let vertexScreenSpace = vertexWorldCoord.project(camera);

    boundingBox.min.min(vertexScreenSpace);
    boundingBox.max.max(vertexScreenSpace);
  }

  return boundingBox
}

function normalizedToPixels(boundingBox) {
  const renderWidth = window.innerWidth;
  const renderHeight = window.innerHeight;
  const renderWidthHalf = renderWidth / 2;
  const renderHeightHalf = renderHeight / 2;

  const bboxHeight =  boundingBox.max.y - boundingBox.min.y;

  //console.log(bboxHeight)

  // Convert normalized screen coordinates [-1, 1] to pixel coordinates:
  const x = (1 + boundingBox.min.x) * renderWidthHalf;
  const y = (1 + boundingBox.max.y) * renderHeightHalf;
  const w = (boundingBox.max.x - boundingBox.min.x) * renderWidthHalf;
  const h = (boundingBox.max.y - boundingBox.min.y) * renderHeightHalf;
  // const x = (boundingBox.min.x + 1) * renderWidthHalf;
  // const y = (1 - boundingBox.max.y) * renderHeightHalf;
  // const w = (boundingBox.max.x - boundingBox.min.x) * renderWidthHalf;
  // const h = (boundingBox.max.y - boundingBox.min.y) * renderHeightHalf;

  return {'x': x, 'y': y, 'w': w, 'h': h}
}


function randomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

function* range(from, to, step = 1) {
  let value = from;
  while (value <= to) {
    yield value;
    value += step;
  }
}

export function listItemConfig(boxProps, textProps=undefined,  animProps=undefined, infoProps=undefined, useTimeStamp=true, spacing=0, childInset=0.9, index=0){
  return {
    'boxProps': boxProps,
    'textProps': textProps,
    'animProps': animProps,
    'infoProps': infoProps,
    'useTimeStamp': true,
    'spacing': spacing,
    'childInset': childInset,
    'index': index
  }
}

export function animationProperties(anim='FADE', action='IN', duration=0.07, ease="power1.inOut", delay=0.007, onComplete=undefined){
  return {
    'anim': anim,
    'action': action,
    'duration': duration,
    'ease': ease,
    'delay': delay,
    'onComplete': onComplete
  }
};

export function infoProperties(title, author){
  return {
    'title': title,
    'author': author
  }
};

function txtAnimation(box, txt, anim='FADE', action='IN', duration=0.07, ease="power1.inOut", delay=0.007, delayIdx=0, onComplete=undefined){
  const top = box.userData.height/2+10;
  const bottom = top-box.userData.height-10;
  const right = box.userData.width;
  const left = -box.userData.width;
  let props = {};

  switch (anim) {
      case 'FADE':
        let opacityTarget = 1;
        if(action == 'OUT'){
          opacityTarget = 0;
        }else{
          txt.material.opacity=0;
        }
        props = {duration: duration, opacity: opacityTarget, ease: ease };
        if(onComplete != undefined){
          props.onComplete = onComplete;
        }
        gsap.to(txt.material, props).delay(delay*delayIdx);
        break;
      case 'SCALE':
        if(action == 'OUT'){
          scaleVar.set(0,0,0);
        }else{
          scaleVar.copy(txt.scale);
          txt.scale.set(0,0,0);
          txt.material.opacity=1;
        }
        props = {duration: duration, x: scaleVar.x, y: scaleVar.y, z: scaleVar.z, ease: ease };
        if(onComplete != undefined){
          props.onComplete = onComplete;
        }
        gsap.to(txt.scale, props).delay(delay*delayIdx);
        break;
      case 'SLIDE_DOWN':
        if(txt.position.y>bottom){
          if(action == 'OUT'){
            posVar.set(txt.position.x, top, txt.position.z);
            txt.material.opacity=1;
          }else{
            posVar.copy(txt.position);
            txt.position.set(txt.position.x, top, txt.position.z);
            txt.material.opacity=1;
          }
          props = {duration: duration, x: posVar.x, y: posVar.y, z: posVar.z, ease: ease };
          if(onComplete != undefined){
            props.onComplete = onComplete;
          }

          gsap.to(txt.position, props).delay(delay*delayIdx);
        }
        break;
      case 'SLIDE_UP':
        if(action == 'OUT'){
          posVar.set(txt.position.x, bottom, txt.position.z);
        }else{
          posVar.copy(txt.position);
          txt.position.set(txt.position.x, bottom, txt.position.z);
          txt.material.opacity=1;
        }
        props = {duration: duration, x: posVar.x, y: posVar.y, z: posVar.z, ease: ease };
        if(onComplete != undefined){
          props.onComplete = onComplete;
        }

          gsap.to(txt.position, props).delay(delay*delayIdx);
        break;
      case 'SLIDE_RIGHT':
        if(action == 'OUT'){
            posVar.set(right, txt.position.y, txt.position.z);
        }else{
          posVar.copy(txt.position);
          txt.position.set(right, txt.position.y, txt.position.z);
          txt.material.opacity=1;
        }
        props = {duration: duration, x: posVar.x, y: posVar.y, z: posVar.z, ease: ease };
        if(onComplete != undefined){
          props.onComplete = onComplete;
        }

          gsap.to(txt.position, props).delay(delay*delayIdx);
        break;
      case 'SLIDE_LEFT':
        if(action == 'OUT'){
          posVar.set(left, txt.position.y, txt.position.z);
        }else{
          posVar.copy(txt.position);
          txt.position.set(left, txt.position.y, txt.position.z);
          txt.material.opacity=1;
        }
        props = {duration: duration, x: posVar.x, y: posVar.y, z: posVar.z, ease: ease };
        if(onComplete != undefined){
          props.onComplete = onComplete;
        }

        gsap.to(txt.position, props).delay(delay*delayIdx);
        break;
      case 'UNSCRAMBLE0':
        if(action == 'OUT'){
          posVar.set(txt.position.x+randomNumber(-0.1, 0.1), txt.position.y+randomNumber(-0.1, 0.1), txt.position.z);
        }else{
          posVar.copy(txt.position);
          txt.position.set(txt.position.x+randomNumber(-0.1, 0.1), txt.position.y+randomNumber(-0.1, 0.1), txt.position.z);
          txt.material.opacity=1;
        }
        props = {duration: duration, x: posVar.x, y: posVar.y, z: posVar.z, ease: ease };
        if(onComplete != undefined){
          props.onComplete = onComplete;
        }

        gsap.to(txt.position, props).delay(delay*delayIdx);
        break;
      case 'UNSCRAMBLE1':
        if(action == 'OUT'){
          posVar.set(txt.position.x+randomNumber(-1, 1), txt.position.y+randomNumber(-1, 1), txt.position.z);
        }else{
          posVar.copy(txt.position);
          txt.position.set(txt.position.x+randomNumber(-1, 1), txt.position.y+randomNumber(-1, 1), txt.position.z);
          txt.material.opacity=1;
        }
        props = {duration: duration, x: posVar.x, y: posVar.y, z: posVar.z, ease: ease };
        if(onComplete != undefined){
          props.onComplete = onComplete;
        }

        gsap.to(txt.position, props).delay(delay*delayIdx);
        break;
      case 'UNSCRAMBLE2':
        if(action == 'OUT'){
          posVar.set(txt.position.x+randomNumber(-2, 2), txt.position.y+randomNumber(-2, 2), txt.position.z);
        }else{
          posVar.copy(txt.position);
          txt.position.set(txt.position.x+randomNumber(-2, 2), txt.position.y+randomNumber(-2, 2), txt.position.z);
          txt.material.opacity=1;
        }
        props = {duration: duration, x: posVar.x, y: posVar.y, z: posVar.z, ease: ease };
        if(onComplete != undefined){
          props.onComplete = onComplete;
        }

        gsap.to(txt.position, props).delay(delay*delayIdx);
        break;
      case 'SPIRAL':
        if(action == 'OUT'){
            posVar.set(right, top, txt.position.z);
        }else{
          posVar.copy(txt.position);
          txt.position.set(right, top, txt.position.z);
          txt.material.opacity=1;
        }
        props = {duration: duration, x: posVar.x, y: posVar.y, z: posVar.z, ease: 'cubic-bezier(0.55,0.055,0.675,0.19)' };
        if(onComplete != undefined){
          props.onComplete = onComplete;
        }

        gsap.to(txt.position, props).delay(delay*delayIdx);
        break;
      default:
        console.log("");
    }
}

function multiAnimation(box, txtArr, anim='FADE', action='IN', duration=0.07, ease="power1.inOut", delay=0.007, onComplete=undefined){
  let delayIdx=0;
  const top = box.userData.height/2+5;
  const bottom = top-box.userData.height-5;

  txtArr.forEach((txt, i) => {
    if(txt.position.y>bottom){
      txtAnimation(box, txt, anim, action, duration, ease, delay, delayIdx, onComplete);
      delayIdx+=1;
    }
  });

};

export function mouseOverAnimation(elem, anim='SCALE', duration=0.5, ease="power1.inOut", delay=0, onComplete=undefined){

  let doAnim = false;

  if(elem==undefined)
    return;

  if(elem.userData.hoverAnim != undefined && elem.userData.hoverAnim.isActive())
    return;

  if(elem.userData.mouseOver && (elem.scale.x == elem.userData.defaultScale.x && elem.scale.y == elem.userData.defaultScale.z)){
    scaleVar.set(elem.userData.defaultScale.x*1.1,elem.userData.defaultScale.y*1.1,elem.userData.defaultScale.z);
    elem.userData.mouseOverActive = true;
    doAnim=true;
  }else if (!elem.userData.mouseOver && elem.userData.mouseOverActive && (elem.scale.x != elem.userData.defaultScale.x || elem.scale.y != elem.userData.defaultScale.z)){
    elem.userData.mouseOverActive = false;
    scaleVar.copy(elem.userData.defaultScale);
    doAnim=true;
  }

  if(doAnim){
    let props = { duration: duration, x: scaleVar.x, y: scaleVar.y, z: scaleVar.z, ease: ease };
    elem.userData.hoverAnim = gsap.to(elem.scale, props);
  }

};

export function selectorAnimation(elem, anim='OPEN', duration=0.15, easeIn="power1.in", easeOut="elastic.Out", onComplete=undefined){

    let yPositions = [];
    let zPositions = [];
    let scales = [];
    let selected = undefined;

    elem.userData.selectors.forEach((c, idx) => {
      let size = getGeometrySize(c.geometry);
      let parentSize = getGeometrySize(c.parent.geometry);
      let yPos = size.height*idx;
      let zPos = c.userData.unselectedPos.z;
      let sel = c.children[0].userData.selected;
      c.material.renderOrder = 1;
      if(sel){
        selected = idx;
        scales.push(c.userData.selectedScale);
      }else{
        scales.push(c.userData.unselectedScale);
      }
      
      if(anim=='CLOSE'){
        yPos=0;
        if(sel){
          zPos = c.userData.selectedPos.z;
          c.material.renderOrder = 2;
        }
      }
      yPositions.push(-yPos);
      zPositions.push(zPos);
      if(idx>0){
        yPositions.push(yPos);
      }
    });

    elem.userData.open = true;
    let portalScale = 1*(elem.userData.selectors.length+1);
    if(anim=='CLOSE'){
      elem.userData.open = false;
      portalScale = 1;
    }

    if(anim=='OPEN' || anim=='CLOSE'){
      for (let i = 0; i < elem.userData.selectors.length; i++) {
        let current = elem.userData.selectors[i];
        let props = { duration: duration, x: current.position.x, y: yPositions[i], z: zPositions[i], ease: easeIn };
        gsap.to(current.position, props);
        props = { duration: duration, x: scales[i], y: scales[i], z: scales[i], ease: easeIn };
        gsap.to(current.scale, props);
      }

      if(elem.userData.properties.isPortal){
        let props = { duration: duration, x: 1, y: portalScale, z: 1, ease: easeIn };
        gsap.to(elem.userData.portal.scale, props);
      }
    }

    if(anim=='SELECT'){
      
      let current = elem.userData.selectors[selected];
      let currentY = current.position.y;
      let last = current.parent.userData.lastSelected;
      let props = { duration: duration, x: current.position.x, y: current.userData.selectedPos.y, z: current.userData.selectedPos.z, ease: easeIn };
      gsap.to(current.position, props);
      props = { duration: duration, x: current.userData.selectedScale, y: current.userData.selectedScale, z: current.userData.selectedScale, ease: easeIn };
      gsap.to(current.scale, props);

      if(last != undefined){
        props = { duration: duration, x: last.position.x, y: currentY, z: zPositions[selected], ease: easeIn };
        gsap.to(last.position, props);
        props = { duration: duration, x: last.userData.unselectedScale, y: last.userData.unselectedScale, z: last.userData.unselectedScale, ease: easeIn };
        gsap.to(last.scale, props);
      }
    }

};

export function toggleAnimation(elem, duration=0.15, easeIn="power1.in", easeOut="elastic.Out"){

  if(elem.handle.userData.anim != false && gsap.isTweening( elem.handle.userData.anim ))
  return;

  let pos = elem.handle.userData.onPos;

  if(elem.handle.userData.on){
    pos=elem.handle.userData.offPos;
  }

  let props = { duration: duration, x: pos.x, y: elem.handle.position.y, z: elem.handle.position.z, ease: easeIn, onComplete: updateToggleState, onCompleteParams:[elem] };

  if(!elem.handle.userData.horizontal){
    props = { duration: duration, x: elem.handle.position.x, y: pos.y, z: elem.handle.position.z, ease: easeIn, onComplete: updateToggleState, onCompleteParams:[elem] };
  }

  elem.handle.userData.anim = gsap.to(elem.handle.position, props);

};

export function panelAnimation(elem, anim='OPEN', duration=0.1, easeIn="power1.in", easeOut="elastic.Out"){

  function panelAnimComplete(elem, props){
    gsap.to(elem.scale, props);
  }

  function handleRotate(handle, props){
    gsap.to(handle.rotation, props);
  }


  if(anim == 'OPEN'){
    let onScale = elem.userData.onScale;
    let offScale = elem.userData.offScale;

    if(!elem.userData.properties.open){

      let rot = elem.userData.handleOpen.userData.onRotation;
      let props = { duration: duration, x: rot.x, y: rot.y, z: rot.z, ease: easeOut };
      handleRotate(elem.userData.handleOpen, props);

      let yprops = { duration: duration, x: onScale.x, y: onScale.y, z: onScale.z, ease: easeOut };
      let xprops = { duration: duration, x: onScale.x, y: offScale.y, z: onScale.z, ease: easeOut, onComplete: panelAnimComplete, onCompleteParams:[elem, yprops] };
      
      gsap.to(elem.scale, xprops);

    }else if(elem.userData.properties.open){

      let rot = elem.userData.handleOpen.userData.offRotation;
      let props = { duration: duration, x: rot.x, y: rot.y, z: rot.z, ease: easeOut };
      handleRotate(elem.userData.handleOpen, props);

      let xprops = { duration: duration, x: offScale.x, y: offScale.y, z: offScale.z, ease: easeOut};
      let yprops = { duration: duration, x: onScale.x, y: offScale.y, z: onScale.z, ease: easeOut, onComplete: panelAnimComplete, onCompleteParams:[elem, xprops] };
      
      gsap.to(elem.scale, yprops);

    }

    elem.userData.properties.open = !elem.userData.properties.open;
  }

  if(anim == 'EXPAND'){
    let idx = 1;
    let lastObj = undefined;
    
    let expanded = elem.userData.properties.expanded;
    let bottom = elem.userData.bottom;
    let topHeight = elem.userData.size.height;
    let bottomHeight = bottom.userData.size.height;
    let elemHeight = topHeight+bottomHeight;
    let yPos = -bottomHeight/2;

    for (const obj of elem.userData.sectionElements) {
      if(expanded){
        let pos = obj.userData.closedPos;
        let props = { duration: duration, x: pos.x, y: pos.y, z: pos.z, ease: easeOut };
        gsap.to(obj.position, props);

      }else if(!expanded){
        let pos = obj.userData.expandedPos;
        yPos += pos.y;
        let props = { duration: duration, x: pos.x, y: pos.y, z: pos.z, ease: easeOut };
        gsap.to(obj.position, props);

      }

      idx +=1;
      lastObj = obj;
    }
    
    if(!expanded){
      let rot = elem.userData.handleExpand.userData.onRotation;
      let props = { duration: duration, x: rot.x, y: rot.y, z: rot.z, ease: easeOut };
      handleRotate(elem.userData.handleExpand, props);
      let y = (bottomHeight/2+elemHeight * elem.userData.sectionElements.length) + bottomHeight;
      let pos = bottom.userData.expandedPos;
      props = { duration: duration, x: pos.x, y: -y, z: pos.z, ease: easeOut };
      gsap.to(bottom.position, props);
    }else if(expanded){
      let rot = elem.userData.handleExpand.userData.offRotation;
      let props = { duration: duration, x: rot.x, y: rot.y, z: rot.z, ease: easeOut };
      handleRotate(elem.userData.handleExpand, props);
      let pos = bottom.userData.closedPos;
      props = { duration: duration, x: pos.x, y: pos.y, z: pos.z, ease: easeOut };
      gsap.to(bottom.position, props);
    }

    //if a sub panel is opened, we need to manage positions of other sub panels and base panel elements
    if(elem.userData.properties.isSubPanel){
      let topPanel = elem.userData.properties.topPanel;
      let topPanelBottom = topPanel.userData.bottom;
      let subPanels = topPanel.userData.sectionElements;
      let elemCnt = subPanels.length;
      let startIdx = elem.userData.index+1;
      // console.log(topPanel)
      // console.log(elem.userData.index)
      // console.log(elemCnt)
      // console.log(subPanels)

      if(elem.userData.sectionElements.length == 0){
        if(!expanded){
   
          for (const i of range(startIdx, elemCnt)) {
            // let idx = i-1;
            // let subPanel = subPanels[idx];
            // yPos = (yPos-bottomHeight)-(elemHeight/2+bottomHeight);
            // let props = { duration: duration, x: subPanel.position.x, y: yPos, z: subPanel.position.z, ease: easeOut };
            // gsap.to(subPanel.position, props);
          }

          // yPos = yPos-bottomHeight;
          // let props = { duration: duration, x: topPanelBottom.position.x, y: yPos, z: topPanelBottom.position.z, ease: easeOut };
        }else if(expanded){
          for (const i of range(startIdx, elemCnt)) {
            // let idx = i-1;
            // let subPanel = subPanels[idx];
            // yPos = ((yPos-bottomHeight)-(elemHeight/2+bottomHeight);
            // let props = { duration: duration, x: subPanel.position.x, y: yPos, z: subPanel.position.z, ease: easeOut };
            // gsap.to(subPanel.position, props);
          }
        } 
      }

    }

    //textMesh.widget.base.userData.valueBox.dispatchEvent({type:'update'});

    elem.userData.properties.expanded = !elem.userData.properties.expanded;

  }

}

export function clickAnimation(elem, anim='SCALE', duration=0.15, easeIn="power1.in", easeOut="elastic.Out", onComplete=undefined){
    scaleVar.set(elem.userData.defaultScale.x*0.9,elem.userData.defaultScale.y*0.9,elem.userData.defaultScale.z);
    let props = { duration: duration, x: scaleVar.x, y: scaleVar.y, z: scaleVar.z, ease: easeIn, transformOrigin: '50% 50%' };
    props.onComplete = function(e){
      scaleVar.copy(elem.userData.defaultScale);
      let props = { duration: duration, x: scaleVar.x, y: scaleVar.y, z: scaleVar.z, ease: easeOut, transformOrigin: '50% 50%' };
      gsap.to(elem.scale, props);
    }
    gsap.to(elem.scale, props);
};

export function getGeometrySize(geometry) {
  const bbox = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
  const width = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;
  const depth = bbox.max.z - bbox.min.z;
  return { width, height, depth };
};

export function textProperties(font, letterSpacing, lineSpacing, wordSpacing, padding, size, height, zOffset=-1, matProps=materialProperties(), meshProps=textMeshProperties()) {
  return {
    font: font,
    letterSpacing: letterSpacing,
    lineSpacing: lineSpacing,
    wordSpacing: wordSpacing,
    padding: padding,
    size: size,
    height: height,
    zOffset: zOffset,
    matProps: matProps,
    meshProps: meshProps
  }
};

export function textMeshProperties(curveSegments=12, bevelEnabled=false, bevelThickness=0.1, bevelSize=0.1, bevelOffset=0, bevelSegments=3){
  return {
    'curveSegments': curveSegments,
    'bevelEnabled': bevelEnabled,
    'bevelThickness': bevelThickness,
    'bevelSize': bevelSize,
    'bevelOffset': bevelOffset,
    'bevelSegments': bevelSegments,
  }
}

export function createTextGeometry(character, font, size, height, curveSegments, bevelEnabled, bevelThickness, bevelSize, bevelOffset, bevelSegments) {
  return new TextGeometry(character, {
    font: font,
    size: size,
    height: height,
    curveSegments: curveSegments,
    bevelEnabled: bevelEnabled,
    bevelThickness: bevelThickness,
    bevelSize: bevelSize,
    bevelOffset: bevelOffset,
    bevelSegments: bevelSegments,
  });
};

//MATERIAL CREATION
//useCase='SIMPLE','STENCIL','STENCIL_CHILD'
export function materialProperties(type='BASIC', color='white', transparent=false, opacity=1, side=THREE.FrontSide, useCase='SIMPLE'){
  return {
    type: type,
    color: color,
    transparent: transparent,
    opacity: opacity,
    side: side,
    useCase: useCase
  }
};

export function basicMatProperties(color='white'){
  return materialProperties('BASIC', color, false, 1, THREE.FrontSide, 'SIMPLE');
};

export function basicStencilMatProperties(color='white'){
  return materialProperties('BASIC', color, false, 1, THREE.FrontSide, 'STENCIL');
};

export function basicStencilChildMatProperties(color='white'){
  return materialProperties('BASIC', color, false, 1, THREE.FrontSide, 'STENCIL_CHILD');
};

export function phongMatProperties(color='white'){
  return materialProperties('PHONG', color, false, 1, THREE.FrontSide, 'SIMPLE');
};

export function phongStencilMatProperties(color='white'){
  return materialProperties('PHONG', color, false, 1, THREE.FrontSide, 'STENCIL');
};

export function phongStencilChildMatProperties(color='white'){
  return materialProperties('PHONG', color, false, 1, THREE.FrontSide, 'STENCIL_CHILD');
};

export function lambertMatProperties(color='white'){
  return materialProperties('LAMBERT', color, false, 1, THREE.FrontSide, 'SIMPLE');
};

export function lambertStencilMatProperties(color='white'){
  return materialProperties('LAMBERT', color, false, 1, THREE.FrontSide, 'STENCIL');
};

export function lambertStencilChildMatProperties(color='white'){
  return materialProperties('LAMBERT', color, false, 1, THREE.FrontSide, 'STENCIL_CHILD');
};

export function standardMatProperties(color='white'){
  return materialProperties('STANDARD', color, false, 1, THREE.FrontSide, 'SIMPLE');
};

export function standardMatStencilProperties(color='white'){
  return materialProperties('STANDARD', color, false, 1, THREE.FrontSide, 'STENCIL');
};

export function standardMatStencilChildProperties(color='white'){
  return materialProperties('STANDARD', color, false, 1, THREE.FrontSide, 'STENCIL_CHILD');
};

export function toonMatProperties(color='white'){
  return materialProperties('TOON', color, false, 1, THREE.FrontSide, 'SIMPLE');
};

export function toonMatStencilProperties(color='white'){
  return materialProperties('TOON', color, false, 1, THREE.FrontSide, 'STENCIL');
};

export function toonMatStencilChildProperties(color='white'){
  return materialProperties('TOON', color, false, 1, THREE.FrontSide, 'STENCIL_CHILD');
};

export function getBaseMaterial(color='white', type='BASIC', side=THREE.FrontSide){
  let mat = undefined;
  switch (type) {
    case 'BASIC':
      mat = new THREE.MeshBasicMaterial({ color: color, side: side });
      
    case 'PHONG':
      mat = new THREE.MeshPhongMaterial({ color: color, side: side });

    case 'LAMBERT':
      mat = new THREE.MeshLambertMaterial({ color: color, side: side });

    case 'STANDARD':
      mat = new THREE.MeshStandardMaterial({ color: color, side: side });

    case 'TOON':
      mat = new THREE.MeshToonMaterial({ color: color, side: side });

    default:
      mat = new THREE.MeshBasicMaterial({ color: color, side: side });

  }

  return mat
};

export function getStencilRef(){
  let ref = stencilRefs.length+1;
  stencilRefs.push(ref);

  return stencilRefs[stencilRefs.length-1]
}

export function getMaterial(props, stencilRef=0){
  const mat = getBaseMaterial(props.color, props.type, props.side);
  mat.transparent = props.transparent;
  mat.opacity = props.opacity;

  if(props.useCase == 'STENCIL'){
    setupStencilMaterial(mat, stencilRef);
  }else if(props.useCase == 'STENCIL_CHILD'){
    setupStencilChildMaterial(mat, stencilRef);
  }

  return mat
};

export function transparentMaterial(){
  const mat = new THREE.MeshBasicMaterial();
  mat.transparent = true;
  mat.opacity = 0;

  return mat
};

export function setupClipMaterial(mat, clippingPlanes){
  mat.clippingPlanes = clippingPlanes;
  mat.stencilFail = THREE.DecrementWrapStencilOp;
  mat.stencilZFail = THREE.DecrementWrapStencilOp;
  mat.stencilZPass = THREE.DecrementWrapStencilOp;
};

export function setupStencilMaterial(mat, stencilRef){
  mat.depthWrite = false;
  mat.stencilWrite = true;
  mat.stencilRef = stencilRef;
  mat.stencilFunc = THREE.AlwaysStencilFunc;
  mat.stencilZPass = THREE.ReplaceStencilOp;
};

export function setupStencilChildMaterial(mat, stencilRef){
  mat.depthWrite = false;
  mat.stencilWrite = true;
  mat.stencilRef = stencilRef;
  mat.stencilFunc = THREE.EqualStencilFunc;
};

export function stencilMaterial(matProps){
  let stencilRef = getStencilRef();

  console.log("stencilRef")
  console.log(stencilRef)

  return getMaterial(matProps, stencilRef);
};

export function darkenMaterial(material, value, alpha=100){
  let c = colorsea('#'+material.color.getHexString(), alpha).darken(value);
  material.color.set(c.hex());
}

export function lightenMaterial(material, value, alpha=100){
  let c = colorsea('#'+material.color.getHexString(), alpha).lighten(value);
  material.color.set(c.hex());
}

export function getDraggable(obj){
  return draggable;
};

export function addToDraggable(obj){
  draggable.push(obj);
};

export function getMouseOverable(){
  return mouseOverable;
};

export function addToMouseOverable(obj){
  mouseOverable.push(obj);
};

export function getClickable(){
  return clickable;
};

export function addClickable(obj){
  clickable.push(obj);
};

export function getInputPrompts(){
  return inputPrompts;
};

export function addToInputPrompts(obj){
  inputPrompts.push(obj);
};

export function getInputText(){
  return inputText;
};

export function addToInputText(obj){
  inputText.push(obj);
};

export function getSelectorElems(){
  return selectorElems;
};

export function addToSelectorElems(obj){
  selectorElems.push(obj);
};

export function getToggles(){
  return toggles;
};

export function addToToggles(obj){
  toggles.push(obj);
};

export function getClippedMeshes(){
  return clippedMeshes;
};

export function addToClippedMeshes(obj){
  clippedMeshes.push(obj);
};

export function getMeshViews(){
  return meshViews;
};

export function addToMeshViews(obj){
  meshViews.push(obj);
};

export function getPortals(){
  return portals;
};

export function addToPortals(obj){
  portals.push(obj);
};

export function getScenePool(){
  return scenePool;
};

export function boxProperties(name, parent, color, width, height, depth, smoothness, radius, zOffset = 1, complexMesh=true, matProps=materialProperties(), pivot='CENTER', padding=0.01){
  return {
    'name': name,
    'parent': parent,
    'color': color,
    'width': width,
    'height': height,
    'depth': depth,
    'smoothness': smoothness,
    'radius': radius,
    'zOffset': zOffset,
    'complexMesh': complexMesh,
    'matProps': matProps,
    'pivot': pivot,
    'padding': padding
  }
};

function setGeometryPivot(mesh, boxProps){
  let geomSize = getGeometrySize(mesh.geometry);
  switch (boxProps.pivot) {
    case 'LEFT':
      mesh.pivot = new THREE.Vector3(-boxProps.width/2, boxProps.height/2, boxProps.depth/2);
      break;
    case 'RIGHT':
      mesh.pivot = new THREE.Vector3(boxProps.width/2, boxProps.height/2, boxProps.depth/2);
      break;
    case 'TOP':
      mesh.pivot = new THREE.Vector3(boxProps.width/2, -boxProps.height, boxProps.depth/2);
      break;
    case 'TOP_LEFT':
      mesh.pivot = new THREE.Vector3(-boxProps.width, -boxProps.height, boxProps.depth/2);
      break;
    case 'TOP_RIGHT':
      mesh.pivot = new THREE.Vector3(boxProps.width, -boxProps.height, boxProps.depth/2);
      break;
    case 'BOTTOM':
      mesh.pivot = new THREE.Vector3(boxProps.width/2, boxProps.height, boxProps.depth/2);
      break;
    case 'BOTTOM_LEFT':
      mesh.pivot = new THREE.Vector3(-boxProps.width, boxProps.height, boxProps.depth/2);
      break;
    case 'BOTTOM_RIGHT':
      mesh.pivot = new THREE.Vector3(boxProps.width, boxProps.height, boxProps.depth/2);
      break;
    default:
      //mesh.pivot = new THREE.Vector3(boxProps.width/2, boxProps.height/2, boxProps.depth/2);
  }
}

export function contentBox(boxProps){
  const mat = getMaterial(boxProps.matProps);
  let geometry = new THREE.BoxGeometry(boxProps.width, boxProps.height, boxProps.depth);
  
  if(boxProps.complexMesh){
    geometry = RoundedBoxGeometry(boxProps.width, boxProps.height, boxProps.depth, boxProps.radius, boxProps.smoothness, boxProps.zOffset);
  }

  const box = new THREE.Mesh(geometry, mat);
  setGeometryPivot(box, boxProps);

  box.userData.width = boxProps.width;
  box.userData.height = boxProps.height;
  box.userData.depth = boxProps.depth;
  box.userData.padding = boxProps.padding;

  let result = { 'box': box, 'width': boxProps.width, 'height': boxProps.height, 'depth': boxProps.depth, 'padding': boxProps.padding };


  return result

};

export function meshViewBox(boxProps, scene){
  const box = new THREE.Mesh(new THREE.PlaneGeometry(boxProps.width, boxProps.height), new THREE.MeshBasicMaterial() );
  box.userData.width = boxProps.width;
  box.userData.height = boxProps.height;
  box.userData.depth = boxProps.depth;
  box.userData.padding = boxProps.padding;
  const boundingBox = new THREE.Box2();

  let result = { 'box': box, 'width': boxProps.width, 'height': boxProps.height, 'boundingBox': boundingBox, 'scene': scene, 'padding': boxProps.padding  };

  meshViews.push(result);


  return result
};

export function roundedBox(boxProps){
  const mat = new THREE.MeshPhongMaterial();
  mat.color.set(boxProps.color);
  mat.depthWrite = false;
  let geometry = RoundedBoxGeometry(boxProps.width, boxProps.height, boxProps.depth, boxProps.radius, boxProps.smoothness, boxProps.zOffset);
  const box = new THREE.Mesh(geometry, mat );
  setGeometryPivot(box, boxProps);
  box.userData.width = boxProps.width;
  box.userData.height = boxProps.height;
  box.userData.depth = boxProps.depth;
  box.userData.padding = boxProps.padding;

  return box
};

export function portalBox(boxProps){
  const mat = stencilMaterial(boxProps.matProps);
  let geometry = new THREE.BoxGeometry(boxProps.width, boxProps.height, boxProps.depth);

  if(boxProps.complexMesh){
    geometry = RoundedBoxGeometry(boxProps.width, boxProps.height, boxProps.depth, boxProps.radius, boxProps.smoothness, boxProps.zOffset);
  }

  const box = new THREE.Mesh(geometry, mat );
  setGeometryPivot(box, boxProps);

  box.userData.width = boxProps.width;
  box.userData.height = boxProps.height;
  box.userData.depth = boxProps.depth;
  box.userData.padding = boxProps.padding;

  let result = { 'box': box, 'width': boxProps.width, 'height': boxProps.height, 'stencilRef': mat.stencilRef, 'padding': boxProps.padding  };

  portals.push(result);


  return result
};

export function portalWindow(boxProps){
  boxProps.matProps.useCase = 'STENCIL';
  const mat = stencilMaterial(boxProps.matProps);
  let geometry = new THREE.PlaneGeometry(boxProps.width, boxProps.height);

  if(boxProps.complexMesh){
    geometry = RoundedPlaneGeometry(boxProps.width, boxProps.height, boxProps.radius, boxProps.smoothness );
  }

  const box = new THREE.Mesh(geometry, mat );
  setGeometryPivot(box, boxProps);

  box.userData.width = boxProps.width;
  box.userData.height = boxProps.height;
  box.userData.depth = boxProps.depth;
  box.userData.padding = boxProps.padding;

  let result = { 'box': box, 'width': boxProps.width, 'height': boxProps.height, 'stencilRef': mat.stencilRef, 'padding': boxProps.padding  };

  portals.push(result);


  return result
};

export function contentWindow(boxProps){
  const mat = new THREE.MeshPhongMaterial();
  let geometry = new THREE.PlaneGeometry(boxProps.width, boxProps.height);

  if(boxProps.complexMesh){
    geometry = RoundedPlaneGeometry(boxProps.width, boxProps.height, boxProps.radius, boxProps.smoothness );
  }
  const box = new THREE.Mesh(geometry, mat );
  setGeometryPivot(box, boxProps);

  box.userData.width = boxProps.width;
  box.userData.height = boxProps.height;
  box.userData.depth = boxProps.depth;
  box.userData.padding = boxProps.padding;

  let result = { 'box': box, 'width': boxProps.width, 'height': boxProps.height, 'padding': boxProps.padding  };

  portals.push(result);


  return result
};


//Manage lighting, to be put into object scene, or to be put back for the main scene
function handleSceneLightSwap(object, mainScene, activate){
  const ambientLight = getMainAmbientLight(mainScene);
  const directionalLight = getMainDirectionalLight(mainScene);

  if(ambientLight == undefined || directionalLight == undefined)
    return;

  if(activate){
    object.scene.add(ambientLight);
    ambientLight.layers.set(object.box.layers.mask);
    object.scene.add(directionalLight);
    directionalLight.layers.set(object.box.layers.mask);

  }else{
    mainScene.add(ambientLight);
    ambientLight.layers.set(0);
    mainScene.add(directionalLight);
    directionalLight.layers.set(0);
  }
}

//Manage putting meshView and main camera on appropriate layers and scenes
function handleMeshViewScene(meshView, mainScene, mainCam, activate){
  if(meshView.box.parent == undefined || meshView.scene == undefined)
    return;

  if(activate){
    meshView.scene.add(mainCam);
    meshView.scene.add(meshView.box.parent);
    mainCam.layers.set(meshView.box.layers.mask);
  }else{
    mainCam.layers.set(0);
    mainScene.add(mainCam);
    mainScene.add(meshView.box.parent);
  }
}

export function renderMeshView(meshView, mainScene, mainCam, renderer){
  computeScreenSpaceBoundingBox(meshView.boundingBox, meshView, mainCam);

  let n = normalizedToPixels(meshView.boundingBox);

  renderer.setViewport(0, 0, window.innerWidth, 
  window.innerHeight);
  //renderer.autoClear = false;
  renderer.render(mainScene, mainCam);
  //renderer.clearDepth();
  renderer.setScissorTest(true);
  renderer.setScissor(
      n.x,
      n.y,
      n.w,
      n.h
  );
  renderer.setViewport(
      0,
      0,
      window.innerWidth,
      window.innerHeight
  );
  
  handleSceneLightSwap(meshView, mainScene, true);
  handleMeshViewScene(meshView, mainScene, mainCam, true);
  renderer.render(meshView.scene, mainCam);
  handleMeshViewScene(meshView, mainScene, mainCam, false);
  handleSceneLightSwap(meshView, mainScene, false);
  renderer.setScissorTest(false);
}

function calculateWidgetSize(boxProps, horizontal, useSubObject, operatorSizeDivisor, defaultSubOffset=0.65){
  console.log("boxProps====")
  console.log(boxProps)
  let subOffset = 1;
  if(useSubObject){
    subOffset = defaultSubOffset;
  }
  let baseWidth = boxProps.width*subOffset;
  let baseHeight = boxProps.height;
  let baseDepth=boxProps.depth/2;
  let handleWidth=boxProps.width/operatorSizeDivisor*subOffset;
  let handleHeight=boxProps.height;
  let handleDepth=boxProps.depth*2;
  let subWidth=baseWidth*(1-1*subOffset);
  let subHeight=baseHeight;
  let subDepth=baseDepth;

  if(horizontal==false){
    baseWidth = boxProps.width;
    baseHeight = boxProps.height*subOffset;
    handleWidth=boxProps.width;
    handleHeight=boxProps.height/operatorSizeDivisor*subOffset;
    subWidth=baseWidth;
    subHeight=baseHeight*(1-1*subOffset);
    subDepth=baseDepth;
  }

  return {baseWidth, baseHeight, baseDepth, handleWidth, handleHeight, handleDepth, subWidth, subHeight, subDepth}
}

export function panelProperties( boxProps, font, name='Panel', padding, textProps, matProps, attach='LEFT', sections={}, open=true, expanded=false, isSubPanel=false, topPanel=undefined){
  return {
    'type': 'PANEL',
    'boxProps': boxProps,
    'font': font,
    'name': name,
    'padding': padding,
    'textProps': textProps,
    'matProps': matProps,
    'attach': attach,
    'sections': sections,
    'open': open,
    'expanded': expanded,
    'isSubPanel': isSubPanel,
    'topPanel': topPanel
  }
};

function panelHandle(panelProps){
  let handleMat = getMaterial(panelProps.matProps, panelProps.matProps.stencilRef);
  let handleGeo = new THREE.OctahedronGeometry(panelProps.boxProps.height*0.2, 0);
  handleGeo.center()
  const handleSize = getGeometrySize(handleGeo);
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.userData.offRotation = new THREE.Vector3().copy(handle.rotation);
  handle.userData.onRotation = new THREE.Vector3(handle.rotation.x, handle.rotation.y, handle.rotation.z+0.8)
  handle.userData.size = handleSize;
  mouseOverUserData(handle);
  clickable.push(handle);

  return handle
}

function panelOpenHandle(panel, panelProps){
  const handleOpen = panelHandle(panelProps);
  const parentSize = getGeometrySize(panelProps.boxProps.parent.geometry);

  panelProps.boxProps.parent.add(handleOpen);

  if(panelProps.attach == 'CENTER'){
    handleOpen.position.set(panel.cBox.width/2, panel.cBox.height/2, parentSize.depth+panel.cBox.depth/2);
  }else if(panelProps.attach == 'LEFT'){
    handleOpen.position.set(-(parentSize.width/2), parentSize.height/2, parentSize.depth+panel.cBox.depth/2);
  }else if(panelProps.attach == 'RIGHT'){
    handleOpen.position.set(parentSize.width/2, parentSize.height/2, -(parentSize.depth+panel.cBox.depth/2));
  }

  if(!panelProps.open){
    handleOpen.rotation.z = handleOpen.rotation.z;
  }else if(panelProps.open){
    handleOpen.rotation.z = handleOpen.rotation.z+0.8;
  }

  panel.cBox.box.userData.handleOpen = handleOpen;

  handleOpen.addEventListener('action', function(event) {
    panelAnimation(panel.cBox.box);
  });
}

function panelBottom(panel, panelProps){
  let bottomBoxProps = {...panelProps.boxProps};
  bottomBoxProps.height=bottomBoxProps.height*0.5;
  bottomBoxProps.parent = panel.cBox.box;
  const panel_bottom = contentBox(bottomBoxProps);
  let bottomSize = getGeometrySize(panel_bottom.box.geometry);
  panel_bottom.box.material = panel.cBox.box.material;
  panel_bottom.box.position.set(panel_bottom.box.position.x, -(panel.cBox.height/2+panel_bottom.height/2), panel_bottom.box.position.z);
  panel.cBox.box.add(panel_bottom.box);
  panel_bottom.box.userData.expandedPos = new THREE.Vector3().set(panel_bottom.box.position.x, -(panel.cBox.height+panel_bottom.height), panel_bottom.box.position.z);
  panel_bottom.box.userData.closedPos = new THREE.Vector3().copy(panel_bottom.box.position);
  panel_bottom.box.userData.size = bottomSize;

  return panel_bottom
}

function PanelElement(panelProps){
  let panel = undefined;

  const handleExpand = panelHandle(panelProps);
  panelProps.boxProps.parent.add(handleExpand);
  let parentSize = getGeometrySize(panelProps.boxProps.parent.geometry);

  if(panelProps.attach == 'CENTER'){

    panel = buttonBase(panelProps.boxProps, panelProps.name, panelProps.value, panelProps.font, panelProps.textProps);
    panel.cBox.box.position.set(parentSize.width/2, parentSize.height/2, parentSize.depth);
    
  }else if(panelProps.attach == 'LEFT'){

    panelProps.boxProps.pivot = 'RIGHT';
    panel = buttonBase(panelProps.boxProps, panelProps.name, panelProps.value, panelProps.font, panelProps.textProps);
    panel.cBox.box.position.set(-(parentSize.width/2+panel.cBox.width/2), parentSize.height/2-panel.cBox.height/2, parentSize.depth);

  }else if(panelProps.attach == 'RIGHT'){

    panelProps.boxProps.pivot = 'LEFT';
    panel = buttonBase(panelProps.boxProps, panelProps.name, panelProps.value, panelProps.font, panelProps.textProps);
    panel.cBox.box.position.set(parentSize.width/2+panel.cBox.width/2, parentSize.height/2-panel.cBox.height/2, parentSize.depth);

  }

  if(panelProps.topPanel == undefined){
    panelProps.topPanel = panel.cBox.box;
    const handleOpen = panelOpenHandle(panel, panelProps);
  }
  
  panel.cBox.box.add(handleExpand);
  panel.cBox.box.userData.handleExpand = handleExpand;
  handleExpand.position.set(panelProps.boxProps.width/2, panelProps.boxProps.height/2 - handleExpand.userData.size.height*2, panelProps.boxProps.depth/2);
  if(panelProps.expanded){
    handleExpand.rotation.z = handleExpand.rotation.z+0.8;
  }

  const panel_bottom = panelBottom(panel, panelProps);

  
  panel.cBox.box.userData.textMesh = panel.cBox.textMesh;
  panel.cBox.box.userData.bottom = panel_bottom.box;
  panel.cBox.box.userData.properties = panelProps;
  panel.cBox.box.userData.expandedPos = new THREE.Vector3().copy(panel.cBox.box.position);
  panel.cBox.box.userData.closedPos = new THREE.Vector3().copy(panel.cBox.box.position);
  panel.cBox.box.userData.onPos = new THREE.Vector3().copy(panel.cBox.box.position);
  panel.cBox.box.userData.offPos = new THREE.Vector3().copy(panel.cBox.box.position);
  panel.cBox.box.userData.onScale = new THREE.Vector3(0,0,0).copy(panel.cBox.box.scale);
  panel.cBox.box.userData.offScale = new THREE.Vector3(0,0,0);
  panel.cBox.box.userData.sectionElements = [];
  panel.cBox.box.userData.widgetElements = [];
  panel.cBox.box.userData.size = getGeometrySize(panel.cBox.box.geometry);

  panels.push(panel.cBox.box);

  panel.cBox.box.addWidget = function(widget){
    panel.cBox.box.add(widget);
    panel.cBox.box.userData.widgetElements.push(widget);
  }

  if(!panelProps.open){
    panel.cBox.box.scale.set(0,0,0);
  }

  if(panelProps.isSubPanel){
    panel.cBox.box.position.copy(panelProps.boxProps.parent.position);
    darkenMaterial(panel.cBox.box.material, 10);
    panel.cBox.box.userData.onPos = new THREE.Vector3(panel.cBox.box.position.x, -(parentSize.height/2-panel.cBox.height/2), panel.cBox.box.position.z);
    panel.cBox.box.userData.offPos = new THREE.Vector3().copy(panel.cBox.box.position);
  }

  if(panelProps.sections != undefined){
    let index = 1;
    for (const [key, value] of Object.entries(panelProps.sections)) {
      let sectionProps = {...panelProps};
      sectionProps.name = key;
      sectionProps.isSubPanel = true;
      sectionProps.boxProps.parent = panelProps.topPanel;
      parentSize = getGeometrySize(panelProps.topPanel.geometry);

      sectionProps.sections = value;
      let section = PanelElement(sectionProps);
      section.cBox.box.position.set(parentSize.width/2-section.cBox.width/2, 0, -parentSize.depth);

      let bottom = section.cBox.box.userData.bottom;
      let bottomHeight = bottom.userData.size.height;
      let yPos =  bottomHeight - (parentSize.height + bottomHeight)*index;
      section.cBox.box.userData.index = index;
      section.cBox.box.userData.expandedPos.set(section.cBox.box.position.x, yPos, section.cBox.box.position.z);
      section.cBox.box.userData.closedPos = new THREE.Vector3().copy(section.cBox.box.position);
      panelProps.topPanel.userData.sectionElements.push(section.cBox.box);
      
      index += 1;
    }
  }

  handleExpand.addEventListener('action', function(event) {
    panelAnimation(panel.cBox.box, 'EXPAND');
  });

  return panel;

}

export function contentPanel(panelProps){
  loader.load(panelProps.font, (font) => {
    panelProps.font = font;
    let base = PanelElement(panelProps); 
  });
};

export function switchWidgetBox(widgetProps, handleSize=2){
  let size = calculateWidgetSize(widgetProps.boxProps, widgetProps.horizontal, widgetProps.useValueText, handleSize);
  
  let handleMat = getMaterial(widgetProps.boxProps.matProps, widgetProps.boxProps.parent.material.stencilRef);
  let baseMat = getMaterial(widgetProps.boxProps.matProps, widgetProps.boxProps.parent.material.stencilRef);
  let mat = widgetProps.boxProps.parent.material;
  darkenMaterial(baseMat, 10);

  let handleGeometry = new THREE.BoxGeometry(size.handleWidth, size.handleHeight, size.handleDepth);
  let baseGeometry = new THREE.BoxGeometry(size.baseWidth, size.baseHeight, size.baseDepth/2);

  if(widgetProps.boxProps.complexMesh){
    handleGeometry = RoundedBoxGeometry(size.handleWidth, size.handleHeight, size.handleDepth, widgetProps.boxProps.radius, widgetProps.boxProps.smoothness, widgetProps.boxProps.zOffset);
    if(widgetProps.boxProps.depth == 0){
      baseGeometry = RoundedPlaneGeometry(size.baseWidth, size.baseHeight, widgetProps.boxProps.radius, widgetProps.boxProps.smoothness, widgetProps.boxProps.zOffset);
    }else{
      baseGeometry = RoundedBoxGeometry(size.baseWidth, size.baseHeight, size.baseDepth/2, widgetProps.boxProps.radius, widgetProps.boxProps.smoothness, widgetProps.boxProps.zOffset);
    }
  }

  const handle = new THREE.Mesh(handleGeometry, handleMat);
  handle.renderOrder = 2;
  const base = new THREE.Mesh(baseGeometry, baseMat);
  base.add(handle);

  if(widgetProps.horizontal){
    handle.position.set(-(size.baseWidth/2-size.handleWidth/2), handle.position.y, handle.position.z+size.baseDepth);
  }else{
    handle.position.set(handle.position.x,-(size.baseHeight/2-size.handleHeight/2), handle.position.z+size.baseDepth);
  }
  base.userData.horizontal = widgetProps.horizontal;
  base.userData.hasSubObject = widgetProps.useValueText;

  let result = { 'base': base, 'handle': handle,  'width': widgetProps.boxProps.width, 'height': widgetProps.boxProps.height, 'padding': widgetProps.padding}


  return result
};

export function numberValueProperties( defaultValue=0, min=0, max=1, places=3, step=0.001, editable=true){
  return {
    'defaultValue': defaultValue,
    'min': min,
    'max': max,
    'places': places,
    'step': step,
    'editable': editable
  }
};

export function sliderProperties(name='', horizontal=true, min=0, max=1, places=3, step=0.001, padding=0.01, textProps=undefined, font=undefined, useValueText=true, numeric=true, valueProps=numberValueProperties()){
  return {
    'name': name,
    'horizontal': horizontal,
    'min': min,
    'max': max,
    'places': places,
    'step': step,
    'padding': padding,
    'textProps': textProps,
    'font': font,
    'useValueText': useValueText,
    'numeric': numeric,
    'valueProps': valueProps
  }
};

function updateSliderUI(params){
  if(isNaN(params.box.parent.userData.value))
    return;

  let widget = params.base.textMesh.widget;
  let pos = calculateSliderPosition(widget);

  widget.handle.position.copy(pos);
}

function updateValueText(params){

  if(params.base.textMesh.numeric && isNaN(params.box.parent.userData.value))
    return;

  let mergedGeometry = createMergedTextGeometry(params.font, params.boxProps.width, params.boxProps.height, params.box.parent.userData.value, params.textProps);
  params.base.textMesh.geometry.dispose();
  params.base.textMesh.geometry = mergedGeometry;

  params.base.textMesh.position.set(-params.boxProps.width/2+params.textProps.size/2, -params.boxProps.height/2+params.textProps.height, -params.textProps.size/2);

}


export function valueTextPortal(text, font, boxProps, widgetProps, widget=undefined){
  let Box = portalWindow(boxProps);
  
  let material = getMaterial(widgetProps.textProps.matProps, Box.box.material.stencilRef);
  const textGeometry = createMergedTextGeometry(font, boxProps.width, boxProps.height, text, widgetProps.textProps);

  const textMesh = new THREE.Mesh(textGeometry, material);
  textMesh.position.set(-boxProps.width/2+widgetProps.textProps.size/2, -boxProps.height/2+widgetProps.textProps.height, -widgetProps.textProps.size/2);
  let base = {textMesh, Box}
  base.Box.box.userData.textMaterial = material;
  base.textMesh.userData.numeric = widgetProps.numeric;
  base.textMesh.widget = widget;

  Box.box.add(textMesh);

  let params = {'base': base,'box': base.Box.box, 'material': material, 'font': font, 'boxProps': boxProps, 'textProps': widgetProps.textProps};

  base.Box.box.addEventListener('update', function(event) {
    updateValueText(params);
  });

  return base.Box
};

export function editValueTextPortal(text, font, boxProps, widgetProps, widget=undefined){
  let base = selectionTextPortal(boxProps, text, widgetProps.font, widgetProps.textProps);
  let material = getMaterial(widgetProps.textProps.matProps, base.Box.box.material.stencilRef);
  let textProps = widgetProps.textProps;
  base.Box.box.userData.textMaterial = material;
  base.textMesh.userData.numeric = widgetProps.numeric;
  base.textMesh.widget = widget;
  const tProps = editTextProperties(base.Box, '', base.textMesh, font, textProps.size, textProps.height, textProps.zOffset, textProps.letterSpacing, textProps.lineSpacing, textProps.wordSpacing, textProps.padding, false, textProps.meshProps, false);
  base.textMesh.userData.textProps = tProps;

  let params = {'base': base, 'box': base.Box.box, 'material': material, 'font': font, 'boxProps': boxProps, 'textProps': widgetProps.textProps};
  handleTextInputSetup(base, widgetProps.textProps, font);

  base.Box.box.addEventListener('update', function(event) {
    updateValueText(params);
  });

  base.textMesh.addEventListener('update', function(event) {
    updateSliderUI(params);
  });

  return base.Box 
};

function attachValueBox(widget, boxProps, widgetProps, baseWidth, baseHeight){
  let valBoxProps = {...boxProps};
  let valMatProps = materialProperties('BASIC', widget.handle.material.color, false, 1, THREE.FrontSide, 'STENCIL');
  let size = calculateWidgetSize(widgetProps.boxProps, widgetProps.horizontal, widgetProps.useValueText);

  valBoxProps.matProps = valMatProps;

  if(widgetProps.horizontal){
    valBoxProps.height=boxProps.height;
    valBoxProps.width=size.subWidth;
  }else{
    valBoxProps.height=size.subHeight;
    valBoxProps.width=boxProps.width;
  }

  let valBox = undefined;

  let defaultVal = widget.base.userData.valueProps.defaultValue.toString();
  if(widget.base.userData.valueProps.editable){
    valBox = editValueTextPortal(defaultVal, widgetProps.textProps.font, valBoxProps, widgetProps, widget);
  }else{
    valBox = valueTextPortal(defaultVal, widgetProps.textProps.font, valBoxProps, widgetProps, widget);
  }
  valBox.box.userData.size = {'width': size.subWidth, 'height': size.subHeight, 'depth': size.subDepth};
  widget.base.add(valBox.box);
  widget.base.userData.valueBox = valBox.box;
  darkenMaterial(valBox.box.material, 30);

  if(widgetProps.horizontal){
    valBox.box.position.set(baseWidth/2+valBox.width/2, valBox.box.position.y, valBox.box.position.z);
  }else{
    valBox.box.position.set(valBox.box.position.x, -baseHeight+valBox.height, valBox.box.position.z);
  }
}

export function sliderBox(boxProps, sliderProps){

  let slider = switchWidgetBox(sliderProps, 8);
  let size = calculateWidgetSize(sliderProps.boxProps, sliderProps.horizontal, sliderProps.useValueText, 8);

  setSliderUserData(slider, sliderProps.boxProps, sliderProps);

  if(slider.base.userData.hasSubObject){
    attachValueBox(slider, sliderProps.boxProps, sliderProps, size.baseWidth, size.baseHeight)
  }
  
  return slider
};

export function calculateSliderPosition(slider){
  let minScroll = slider.handle.userData.minScroll;
  let maxScroll = slider.handle.userData.maxScroll;
  let max = slider.handle.userData.max;
  let min = slider.handle.userData.min;
  let value = slider.base.userData.value;
  if(value>max){
    slider.base.userData.value = max;
    value = max;
  }else if(value<min){
    slider.base.userData.value = min;
    value = min;
  }
  if(isNaN(value))
    return;

  let coord = 'x';
  let divider = (slider.base.userData.size.width-slider.handle.userData.padding-slider.handle.userData.size.width);

  if(!slider.handle.userData.horizontal){
    coord = 'y';
    divider = (slider.base.userData.size.height+slider.handle.userData.padding-slider.handle.userData.size.height);
  }

  let vec = ((value-min)/(max-min))*divider+minScroll;
  let pos = new THREE.Vector3(slider.handle.position.x, vec, slider.handle.position.z);

  if(slider.base.userData.horizontal){
    pos.set(vec, slider.handle.position.y, slider.handle.position.z);
  }

  return pos
};

export function calculateSliderValue(slider){
  let coord = 'x';
  let valBoxSize = slider.base.userData.valueBox.userData.size;
  let divider = (slider.base.userData.size.width-slider.handle.userData.padding-slider.handle.userData.size.width);

  if(!slider.handle.userData.horizontal){
    coord = 'y';
    divider = (slider.base.userData.size.height+slider.handle.userData.padding-slider.handle.userData.size.height);
  }

  let pos = slider.handle.position[coord];
  let minScroll = slider.handle.userData.minScroll;
  let max = slider.handle.userData.max;
  let min = slider.handle.userData.min;

  let value = (pos-minScroll)/divider*max;

  if(slider.handle.userData.min<0){
    value = ((pos-minScroll)/divider*(max-min))+min;
  }

  return value.toFixed(slider.handle.userData.places);
};

function onSliderMove(slider){

  slider.base.userData.value = calculateSliderValue(slider);

  if(slider.base.userData.valueBox != undefined){
    slider.base.userData.valueBox.currentText = slider.base.userData.value;
  }

  if(slider.base.userData.valueBox != undefined){
    slider.base.userData.valueBox.dispatchEvent({type:'update'});
  }

}

function setSliderUserData(slider, boxProps, sliderProps){
  let size = calculateWidgetSize(sliderProps.boxProps, sliderProps.horizontal, sliderProps.useValueText, 8);

  slider.base.userData.type = 'SLIDER';
  //slider.base.userData.size = {'width': boxProps.width, 'height': boxProps.height, 'depth': size.baseDepth};
  slider.base.userData.size = {'width': size.baseWidth, 'height': size.baseHeight, 'depth': size.baseDepth};
  slider.base.userData.handle = slider.handle;
  slider.base.userData.horizontal = sliderProps.horizontal;
  slider.base.userData.valueProps = sliderProps.valueProps;
  slider.base.userData.value = sliderProps.valueProps.defaultValue;

  slider.handle.userData.type = 'SLIDER';
  slider.handle.userData.size = {'width': size.handleWidth, 'height': size.handleHeight, 'depth': size.handleDepth};
  slider.handle.userData.horizontal = sliderProps.horizontal;
  slider.handle.userData.min = sliderProps.valueProps.min;
  slider.handle.userData.max = sliderProps.valueProps.max;
  slider.handle.userData.places = sliderProps.valueProps.places;

  if(sliderProps.horizontal){
    slider.handle.userData.maxScroll = slider.handle.position.x + (size.baseWidth-size.handleWidth);
    slider.handle.userData.minScroll = -size.baseWidth+(slider.handle.userData.maxScroll+size.handleWidth);
  }else{
    slider.handle.userData.maxScroll = slider.handle.position.y + (size.baseHeight-size.handleHeight);
    slider.handle.userData.minScroll = -size.baseHeight+(slider.handle.userData.maxScroll+size.handleHeight);
  }

  slider.handle.userData.padding = sliderProps.padding;
  slider.handle.userData.draggable = true;

  slider.handle.addEventListener('action', function(event) {
    onSliderMove(slider);
  });

}

export function stringValueProperties(defaultValue='Off', onValue='On', offValue='Off', editable=false){
  return {
    'defaultValue': defaultValue,
    'onValue': onValue,
    'offValue': offValue,
    'editable': editable
  }
};

export function toggleProperties(boxProps, name='', horizontal=true, on=false, padding=0.01, textProps=undefined, font=undefined, useValueText=true, valueProps=stringValueProperties(), matProps=undefined, animProps=undefined, listConfig=undefined){
  return {
    'type': 'TOGGLE',
    'boxProps': boxProps,
    'name': name,
    'horizontal': horizontal,
    'on': on,
    'padding': padding,
    'textProps': textProps,
    'font': font,
    'useValueText': useValueText,
    'valueProps': valueProps,
    'matProps': matProps,
    'animProps': animProps,
    'listConfig': listConfig,
  }
};

export function toggleBase(toggleProps){
  let toggle = switchWidgetBox(toggleProps, 2);
  let size = calculateWidgetSize(toggleProps.boxProps, toggleProps.horizontal, toggleProps.useValueText, 2);

  setToggleUserData(toggle, toggleProps);

  if(toggle.base.userData.hasSubObject){
    attachValueBox(toggle, toggleProps.boxProps, toggleProps, size.baseWidth, size.baseHeight)
  }

  return toggle

};

function updateToggleState(toggle){
  toggle.handle.userData.on=!toggle.handle.userData.on;
  handleToggleValueText(toggle);
}

function handleToggleValueText(toggle){
  if(toggle.base.userData.valueBox != undefined){

    if(toggle.base.userData.value == toggle.base.userData.valueProps.onValue){
      toggle.base.userData.value = toggle.base.userData.valueProps.offValue;
    }else{
      toggle.base.userData.value = toggle.base.userData.valueProps.onValue;
    }

    toggle.base.userData.valueBox.dispatchEvent({type:'update'});
  }
}

function setToggleUserData(toggle, toggleProps){
  let size = calculateWidgetSize(toggleProps.boxProps, toggleProps.horizontal, toggleProps.useValueText, 2);

  toggle.base.userData.type = 'TOGGLE';
  toggle.base.userData.size = {'width': toggleProps.boxProps.width, 'height': toggleProps.boxProps.height, 'depth': size.baseDepth};
  toggle.base.userData.handle = toggle.handle;
  toggle.base.userData.horizontal = toggleProps.horizontal;
  toggle.base.userData.valueProps = toggleProps.valueProps;
  toggle.base.userData.value = toggleProps.valueProps.defaultValue;

  toggle.handle.userData.type = 'TOGGLE';
  toggle.handle.userData.size = {'width': size.handleWidth, 'height': size.handleHeight, 'depth': size.handleDepth};
  toggle.handle.userData.offPos = new THREE.Vector3().copy(toggle.handle.position);
  toggle.handle.userData.horizontal = toggleProps.horizontal;
  toggle.handle.userData.anim = false;
  toggle.handle.userData.on = false;

  if(toggleProps.horizontal){
    toggle.handle.userData.onPos = new THREE.Vector3(toggle.handle.position.x+size.baseWidth/2-(toggleProps.padding*2), toggle.handle.position.y, toggle.handle.position.z+size.baseDepth);
  }else{
    toggle.handle.userData.onPos = new THREE.Vector3(toggle.handle.position.x, toggle.handle.position.y+(size.baseHeight/2)-(toggleProps.padding*2), toggle.handle.position.z+size.baseDepth);
  }

  if(toggleProps.valueProps.defaultValue == toggleProps.valueProps.onValue){
    toggle.handle.position.copy(toggle.handle.userData.onPos);
    toggle.handle.userData.on = true;
  }

  if(toggle.base.userData.valueBox != undefined){
    toggle.base.userData.valueBox.dispatchEvent({type:'update'});
  }

  toggle.handle.addEventListener('action', function(event) {
    toggleAnimation(toggle);
  });

}

function setMergedMeshUserData(boxSize, geomSize, padding, mergedMesh){
  let extraSpace = padding*0.5;
  mergedMesh.userData.initialPositionY = boxSize.height/2 - geomSize.height/2;
  mergedMesh.userData.maxScroll = geomSize.height/2 - boxSize.height/2 - (padding+extraSpace);
  mergedMesh.userData.minScroll = mergedMesh.userData.initialPositionY+mergedMesh.userData.maxScroll+(padding-extraSpace);
  mergedMesh.userData.padding = padding;
  mergedMesh.userData.settleThreshold = geomSize.height/50;
}

function mouseOverUserData(elem){
  elem.userData.defaultScale =  new THREE.Vector3().copy(elem.scale);
  elem.userData.mouseOver =  false;
  elem.userData.mouseOverActive = false;
  elem.userData.hoverAnim = undefined;
}

function selectorUserData(elem){
  elem.userData.selectors = [];
  elem.userData.open = false;
}

function adjustBoxScaleRatio(box, parent){
  let ratio = parent.userData.ratio;
  let scaleX = parent.scale.x;
  let scaleY = parent.scale.y;
  let newX = box.scale.x;
  let newY = box.scale.y;
  if(scaleX > scaleY){
    newX = newX*(ratio);
  }else if(scaleY > scaleX){
    newY = newY*(ratio);
  }

  box.scale.set(newX, newY, box.scale.z);
  box.userData.defaultScale = new THREE.Vector3().copy(box.scale);
}

function handleCharacterGeometry(character, font, depth, lineWidth, yPosition, textProps, letterGeometries){

  if (character === ' ') {
    // Handle spaces by adjusting the x position
    lineWidth += textProps.wordSpacing;
  } else {

    const geometry = createTextGeometry(character, font, textProps.size, textProps.height, textProps.meshProps.curveSegments, textProps.meshProps.bevelEnabled, textProps.meshProps.bevelThickness, textProps.meshProps.bevelSize, textProps.meshProps.bevelOffset, textProps.meshProps.bevelSegments);
    const charSize = getGeometrySize(geometry);
    geometry.translate(lineWidth, yPosition, depth-charSize.depth*textProps.zOffset);

    // Calculate the width of the letter geometry
    let { width } = getGeometrySize(geometry);
    width+=textProps.letterSpacing;

    letterGeometries.push(geometry);

    // Update lineWidth
    lineWidth += width;
  }

  return { letterGeometries, lineWidth }
}

export function createMergedTextBoxGeometry(cBox, font, boxWidth, boxHeight, text, textProps=undefined,  animProps=undefined) {
    let lineWidth = -(cBox.width / 2 - (textProps.padding));
    let yPosition = cBox.height / 2 ;
    const boxSize = getGeometrySize(cBox.box.geometry);
    let letterGeometries = [];

    for (let i = 0; i < text.length; i++) {
      const character = text[i];

      let geoHandler = handleCharacterGeometry(character, font, boxSize.depth/2, lineWidth, yPosition, textProps, letterGeometries);
      lineWidth = geoHandler.lineWidth;
      letterGeometries = geoHandler.letterGeometries;

      // Check if lineWidth exceeds cBox width - padding
      if (lineWidth > cBox.width / 2 - textProps.padding) {
        lineWidth = -(cBox.width / 2) + textProps.padding; // Reset x position to the upper-left corner
        yPosition -= textProps.lineSpacing; // Move to the next line
      }
    }

    // Merge the individual letter geometries into a single buffer geometry
    return BufferGeometryUtils.mergeGeometries(letterGeometries);
}

export function createMergedTextGeometry(font, boxWidth, boxHeight, text, textProps, animProps=undefined) {
    let lineWidth = 0;
    let yPosition = boxHeight / 2 - textProps.padding;
    let letterGeometries = [];

    for (let i = 0; i < text.length; i++) {
      const character = text[i];

      let geoHandler = handleCharacterGeometry(character, font, 0, lineWidth, yPosition, textProps, letterGeometries);
      lineWidth = geoHandler.lineWidth;
      letterGeometries = geoHandler.letterGeometries;

    }

    // Merge the individual letter geometries into a single buffer geometry
    return BufferGeometryUtils.mergeGeometries(letterGeometries);
}

export function textBoxProperties( boxProps, text, textProps, matProps, animProps=undefined, listConfig=undefined, onCreated=undefined, padding=0.01, isPortal=false, scrollable=false, MultiLetterMeshes=false){
  return {
    'type': 'TEXT_BOX',
    'boxProps': boxProps,
    'text': text,
    'textProps': textProps,
    'matProps': matProps,
    'animProps': animProps,
    'listConfig': listConfig,
    'onCreated': onCreated,
    'padding': padding,
    'isPortal': isPortal,
    'scrollable': scrollable,
    'MultiLetterMeshes': MultiLetterMeshes
  }
};

function StaticTextBox(textBoxProps){
  let boxProps = textBoxProps.boxProps;
  let listConfig = textBoxProps.listConfig;
  let animProps = textBoxProps.animProps;
  const cBox = contentBox(boxProps);
  let mat = getMaterial(textBoxProps.textProps.matProps, 0);
    

  // Merge the individual letter geometries into a single buffer geometry
  let mergedGeometry = createMergedTextBoxGeometry(cBox, textBoxProps.textProps.font, boxProps.width, boxProps.height, textBoxProps.text, textBoxProps.textProps, animProps);
  // Create a mesh from the merged geometry
  const mergedMesh = new THREE.Mesh(mergedGeometry, mat);
  if(animProps!=undefined){
    mergedMesh.material.transparent=true;
    mergedMesh.material.opacity=0;
  }
  const boxSize = getGeometrySize(cBox.box.geometry);
  const geomSize = getGeometrySize(mergedGeometry);
  setMergedMeshUserData(boxSize, geomSize, textBoxProps.textProps.padding, mergedMesh);

  if(listConfig != undefined){
    cBox.box.name = boxProps.name;
    createListItem(listConfig.boxProps, cBox.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
  }else{
    boxProps.parent.add(cBox.box);
  }

  cBox.box.add(mergedMesh);
  if(boxProps.name==''){
    boxProps.name='text-'+cBox.box.id;
  }
  cBox.box.name = boxProps.name;
  adjustBoxScaleRatio(cBox.box, boxProps.parent);

  if(animProps!=undefined){
    //anim, action, duration, ease, delay, onComplete
    txtAnimation(cBox.box, mergedMesh, animProps.anim, animProps.action, animProps.duration, animProps.ease, animProps.delay, 0, animProps.callback);
  }

  if(textBoxProps.onCreated!=undefined){
    textBoxProps.onCreated(cBox.box);
  }
}

export function createStaticTextBox(textBoxProps) {
  if(typeof textBoxProps.textProps.font === 'string'){
    // Load the font
    loader.load(textBoxProps.textProps.font, (font) => {
      textBoxProps.textProps.font = font;
      StaticTextBox(textBoxProps);
    });
  }else if(textBoxProps.textProps.font.isFont){
    StaticTextBox(textBoxProps);
  }  
};

function StaticTextPortal(textBoxProps){
  let boxProps = textBoxProps.boxProps;
  let textProps = textBoxProps.textProps;
  let listConfig = textBoxProps.listConfig;
  let animProps = textBoxProps.animProps;

  const portal = portalWindow(boxProps);
  let mat = getMaterial(textProps.matProps, portal.stencilRef);
  setupStencilMaterial(portal.box.material, portal.stencilRef);
  setupStencilChildMaterial(mat, portal.stencilRef);


  // Merge the individual letter geometries into a single buffer geometry
  let mergedGeometry = createMergedTextBoxGeometry(portal, textProps.font, boxProps.width, boxProps.height, textBoxProps.text, textBoxProps.textProps, textBoxProps.animProps);
  // Create a mesh from the merged geometry
  const mergedMesh = new THREE.Mesh(mergedGeometry, mat);
  if(animProps!=undefined){
    mergedMesh.material.transparent=true;
    mergedMesh.material.opacity=0;
  }
  const boxSize = getGeometrySize(portal.box.geometry);
  const geomSize = getGeometrySize(mergedGeometry);
  setMergedMeshUserData(boxSize, geomSize, textProps.padding, mergedMesh);

  portal.box.add(mergedMesh);
  if(boxProps.name==''){
    boxProps.name='text-'+portal.box.id;
  }
  portal.box.name = boxProps.name;
  adjustBoxScaleRatio(portal.box, boxProps.parent);

  portal.box.add( mergedMesh );

  if(listConfig != undefined){
    createListItem(listConfig.boxProps, portal.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
  }else{
    boxProps.parent.add(portal.box);
  }

  if(animProps!=undefined){
    //anim, action, duration, ease, delay, onComplete
    txtAnimation(portal.box, mergedMesh, animProps.anim, animProps.action, animProps.duration, animProps.ease, animProps.delay, 0, animProps.callback);
  }

  if(textBoxProps.onCreated!=undefined){
    textBoxProps.onCreated(portal.box);
  }
}

export function createStaticTextPortal(textBoxProps) {
  if(typeof textBoxProps.textProps.font === 'string'){
    // Load the font
    loader.load(textBoxProps.textProps.font, (font) => {
      textBoxProps.textProps.font = font;
      StaticTextPortal(textBoxProps);
    });
  }else if(textBoxProps.textProps.font.isFont){
    StaticTextPortal(textBoxProps);
  } 
}

function StaticScrollableTextBox(textBoxProps){
  let boxProps = textBoxProps.boxProps;
  let textProps = textBoxProps.textProps;
  let listConfig = textBoxProps.listConfig;
  let animProps = textBoxProps.animProps;
  const cBox = contentBox(boxProps);
  let mat = getMaterial(textProps.matProps, 0);

  // Merge the individual letter geometries into a single buffer geometry
  let mergedGeometry = createMergedTextBoxGeometry(cBox, textProps.font, boxProps.width, boxProps.height, textBoxProps.text, textProps, animProps);

  // Create a mesh from the merged geometry
  const mergedMesh = new THREE.Mesh(mergedGeometry, mat);
  if(animProps!=undefined){
    mergedMesh.material.transparent=true;
    mergedMesh.material.opacity=0;
  }
  const boxSize = getGeometrySize(cBox.box.geometry);
  const geomSize = getGeometrySize(mergedGeometry);
  mergedMesh.position.set(0, -textProps.padding, 0);

  if(listConfig != undefined){
    cBox.box.name = boxProps.name;
    createListItem(listConfig.boxProps, cBox.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
  }else{
    boxProps.parent.add(cBox.box);
  }

  cBox.box.add(mergedMesh);
  if(boxProps.name==''){
    boxProps.name='text-'+cBox.box.id;
  }
  cBox.box.name = boxProps.name;
  adjustBoxScaleRatio(cBox.box, boxProps.parent);
  setMergedMeshUserData(boxSize, geomSize, textProps.padding, mergedMesh);
  mergedMesh.userData.draggable=true;
  mergedMesh.userData.horizontal=false;

  draggable.push(mergedMesh);
  if(animProps!=undefined){
    //anim, action, duration, ease, delay, onComplete
    txtAnimation(cBox.box, mergedMesh, animProps.anim, animProps.action, animProps.duration, animProps.ease, animProps.delay, 0, animProps.callback);
  }
  if(textBoxProps.onCreated!=undefined){
    textBoxProps.onCreated(cBox.box);
  }
}

export function createStaticScrollableTextBox(textBoxProps) {
  if(typeof textBoxProps.textProps.font === 'string'){
    // Load the font
    loader.load(textBoxProps.textProps.font, (font) => {
      textBoxProps.textProps.font = font;
      StaticScrollableTextBox(textBoxProps);
    });
  }else if(textBoxProps.textProps.font.isFont){
    StaticScrollableTextBox(textBoxProps);
  } 
}

function StaticScrollableTextPortal(textBoxProps){
  let boxProps = textBoxProps.boxProps;
  let textProps = textBoxProps.textProps;
  let listConfig = textBoxProps.listConfig;
  let animProps = textBoxProps.animProps;
  const portal = portalWindow(boxProps);
  let mat = getMaterial(textProps.matProps, portal.stencilRef);

  // Merge the individual letter geometries into a single buffer geometry
  let mergedGeometry = createMergedTextBoxGeometry(portal, textProps.font, boxProps.width, boxProps.height, textBoxProps.text, textProps, animProps);

  // Create a mesh from the merged geometry
  const mergedMesh = new THREE.Mesh(mergedGeometry, mat);
  if(animProps!=undefined){
    mat.transparent=true;
    mat.opacity=0;
  }

  const boxSize = getGeometrySize(portal.box.geometry);
  const geomSize = getGeometrySize(mergedGeometry);
  mergedMesh.position.set(0, -textProps.padding, 0);
  portal.box.add(mergedMesh);
    
  if(listConfig != undefined){
    portal.box.name = boxProps.name;
    createListItem(listConfig.boxProps, portal.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
  }else{
    boxProps.parent.add( portal.box );
  }

  if(boxProps.name==''){
    boxProps.name='text-'+portal.box.id;
  }

  portal.box.name = boxProps.name;
  adjustBoxScaleRatio(portal.box, boxProps.parent);
  setMergedMeshUserData(boxSize, geomSize, textProps.padding, mergedMesh);
  mergedMesh.userData.draggable=true;
  mergedMesh.userData.horizontal=false;

  draggable.push(mergedMesh);
  if(animProps!=undefined){
    //anim, action, duration, ease, delay, onComplete
    txtAnimation(portal.box, mergedMesh, animProps.anim, animProps.action, animProps.duration, animProps.ease, animProps.delay, 0, animProps.callback);
  }
  if(textBoxProps.onCreated!=undefined){
    textBoxProps.onCreated(portal.box);
  }
}

export function createStaticScrollableTextPortal(textBoxProps) {
  if(typeof textBoxProps.textProps.font === 'string'){
    // Load the font
    loader.load(textBoxProps.textProps.font, (font) => {
      textBoxProps.textProps.font = font;
      StaticScrollableTextPortal(textBoxProps);
    });
  }else if(textBoxProps.textProps.font.isFont){
    StaticScrollableTextPortal(textBoxProps);
  }
}

function MultiTextBox(textBoxProps){
  let boxProps = textBoxProps.boxProps;
  let textProps = textBoxProps.textProps;
  let listConfig = textBoxProps.listConfig;
  let animProps = textBoxProps.animProps;
  const cBox = contentBox(boxProps);
  const boxSize = getGeometrySize(cBox.box.geometry);
  const letterGeometries = [];
  const letterMeshes = [];

  let mat = getMaterial(textProps.matProps, 0);

  constructMultiMergedGeometry(cBox, textBoxProps.text, textProps.font, mat, textProps, animProps);

  if(listConfig != undefined){
    cBox.box.name = name;
    createListItem(listConfig.boxProps, cBox.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
  }else{
    boxProps.parent.add(cBox.box);
  }

  adjustBoxScaleRatio(cBox.box, boxProps.parent);
  if(boxProps.name==''){
    boxProps.name='text-'+cBox.box.id;
  }
  cBox.box.name = boxProps.name;

  if(animProps!=undefined){
    //anim, action, duration, ease, delay, onComplete
    multiAnimation(cBox.box, cBox.box.children, animProps.anim, animProps.action, animProps.duration, animProps.ease, animProps.delay, animProps.callback);
  }
  if(textBoxProps.onCreated!=undefined){
    textBoxProps.onCreated(cBox.box);
  }
}

export function createMultiTextBox(textBoxProps) {
  if(typeof textBoxProps.textProps.font === 'string'){
    // Load the font
    loader.load(textBoxProps.textProps.font, (font) => {
      textBoxProps.textProps.font = font;
      MultiTextBox(textBoxProps);
    });
  }else if(textBoxProps.textProps.font.isFont){
    MultiTextBox(textBoxProps);
  }
};

function MultiTextPortal(textBoxProps){
  let boxProps = textBoxProps.boxProps;
  let textProps = textBoxProps.textProps;
  let listConfig = textBoxProps.listConfig;
  let animProps = textBoxProps.animProps;
  const portal = portalWindow(boxProps);
  let lineWidth = -(portal.box.userData.width / 2 - textProps.padding);
  let yPosition = portal.box.position.y+portal.box.userData.height / 2 - textProps.padding*2;
  const boxSize = getGeometrySize(portal.box.geometry);
  const letterGeometries = [];
  const letterMeshes = [];

  let mat = getMaterial(textProps.matProps, portal.stencilRef);
  setupStencilMaterial(portal.box.material, portal.stencilRef);
  setupStencilChildMaterial(mat, portal.stencilRef);


  constructMultiMergedGeometry(portal, textBoxProps.text, textProps.font, mat, textProps, animProps);

  if(listConfig != undefined){
    portal.box.name = name;
    createListItem(listConfig.boxProps, portal.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
  }else{
    boxProps.parent.add(portal.box);
  }

  adjustBoxScaleRatio(portal.box, boxProps.parent);
  if(boxProps.name==''){
    boxProps.name='text-'+portal.box.id;
  }
  portal.box.name = boxProps.name;

  if(animProps!=undefined){
    //anim, action, duration, ease, delay, onComplete
    multiAnimation(portal.box, portal.box.children, animProps.anim, animProps.action, animProps.duration, animProps.ease, animProps.delay, animProps.callback);
  }
  if(textBoxProps.onCreated!=undefined){
    textBoxProps.onCreated(portal.box);
  }

}

export function createMultiTextPortal(textBoxProps) {
  if(typeof textBoxProps.textProps.font === 'string'){
    // Load the font
    loader.load(textBoxProps.textProps.font, (font) => {
      textBoxProps.textProps.font = font;
      MultiTextPortal(textBoxProps);
    });
  }else if(textBoxProps.textProps.font.isFont){
    MultiTextPortal(textBoxProps);
  }
};

function MultiScrollableTextBox(textBoxProps){
  let boxProps = textBoxProps.boxProps;
  let textProps = textBoxProps.textProps;
  let listConfig = textBoxProps.listConfig;
  let animProps = textBoxProps.animProps;
  const cBox = contentBox(boxProps);
  let mat = getMaterial(textProps.matProps, 0);


  const mergedMesh = constructMultiTextMerged(cBox, textBoxProps.text, textProps.font, mat, textProps, animProps);
  cBox.box.add(mergedMesh);

  if(listConfig != undefined){
    cBox.box.name = boxProps.name;
    createListItem(listConfig.boxProps, cBox.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
  }else{
    boxProps.parent.add(cBox.box);
  }

  adjustBoxScaleRatio(cBox.box, boxProps.parent);
  draggable.push(mergedMesh);

  if(animProps!=undefined){
    //anim, action, duration, ease, delay, onComplete
    multiAnimation(cBox.box, mergedMesh.children, animProps.anim, animProps.action, animProps.duration, animProps.ease, animProps.delay, animProps.callback);
  }
  if(textBoxProps.onCreated!=undefined){
    textBoxProps.onCreated(cBox.box);
  }
  //TEST
  // let aConfig = animationConfig('SLIDE_RIGHT', 'OUT', 2, 'back.inOut', 0)
  // setTimeout(() => {
  //   multiAnimation(cBox.box, mergedMesh.children, aConfig.anim, aConfig.action, aConfig.duration, aConfig.ease, aConfig.delay, aConfig.callback);
  // }, "4000");
}

export function createMultiScrollableTextBox(textBoxProps) {
  if(typeof textBoxProps.textProps.font === 'string'){
    // Load the font
    loader.load(textBoxProps.textProps.font, (font) => {
      textBoxProps.textProps.font = font;
      MultiScrollableTextBox(textBoxProps);
    });
  }else if(textBoxProps.textProps.font.isFont){
    MultiScrollableTextBox(textBoxProps);
  }
};

function MultiScrollableTextPortal(textBoxProps){
  let boxProps = textBoxProps.boxProps;
  let textProps = textBoxProps.textProps;
  let listConfig = textBoxProps.listConfig;
  let animProps = textBoxProps.animProps;
  const portal = portalWindow(boxProps);
  let mat = getMaterial(textProps.matProps, portal.stencilRef);

  const mergedMesh = constructMultiTextMerged(portal, textBoxProps.text, textProps.font, mat, textProps, animProps);
  portal.box.add(mergedMesh);
  mergedMesh.position.set(mergedMesh.position.x, mergedMesh.position.y, mergedMesh.position.z+textProps.zOffset);

  if(listConfig != undefined){
    portal.box.name = boxProps.name;
    createListItem(listConfig.boxProps, portal.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
  }else{
    boxProps.parent.add(portal.box);
  }

  adjustBoxScaleRatio(portal.box, boxProps.parent);
  draggable.push(mergedMesh);

  if(animProps!=undefined){
    //anim, action, duration, ease, delay, onComplete
    multiAnimation(portal.box, mergedMesh.children, animProps.anim, animProps.action, animProps.duration, animProps.ease, animProps.delay, animProps.callback);
  }
  if(textBoxProps.onCreated!=undefined){
    textBoxProps.onCreated(portal.box);
  }
  //TEST
  // let aConfig = animationConfig('SLIDE_RIGHT', 'OUT', 2, 'back.inOut', 0)
  // setTimeout(() => {
  //   multiAnimation(cBox.box, mergedMesh.children, aConfig.anim, aConfig.action, aConfig.duration, aConfig.ease, aConfig.delay, aConfig.callback);
  // }, "4000");
}

export function createMultiScrollableTextPortal(textBoxProps) {
  if(typeof textBoxProps.textProps.font === 'string'){
    // Load the font
    loader.load(textBoxProps.textProps.font, (font) => {
      textBoxProps.textProps.font = font;
      MultiScrollableTextPortal(textBoxProps);
    });
  }else if(textBoxProps.textProps.font.isFont){
    MultiScrollableTextPortal(textBoxProps);
  }
};

function constructMultiMergedGeometry(obj, text, font, material, textProps, animProps, scene = undefined){
  let lineWidth = -(obj.box.userData.width / 2 - textProps.padding);
  let yPosition = obj.box.userData.height / 2 - textProps.padding*2;
  const boxSize = getGeometrySize(obj.box.geometry);
  const letterGeometries = [];
  const letterMeshes = [];
  const cubes = [];

  for (let i = 0; i < text.length; i++) {
      const character = text[i];

      if (character === ' ') {
        // Handle spaces by adjusting the x position
        lineWidth += textProps.wordSpacing;
      } else {

         if(textProps.meshProps == undefined){
          textProps.meshProps = textMeshProperties()
        }
        const geometry = createTextGeometry(character, font, textProps.size, textProps.height, textProps.meshProps.curveSegments, textProps.meshProps.bevelEnabled, textProps.meshProps.bevelThickness, textProps.meshProps.bevelSize, textProps.meshProps.bevelOffset, textProps.meshProps.bevelSegments);

        const letterMesh = new THREE.Mesh(geometry, material);
        letterMesh.position.set(lineWidth, yPosition, boxSize.depth/2-textProps.height/2);
        if(animProps!=undefined){
          letterMesh.material.transparent=true;
          letterMesh.material.opacity=0;
        }

        // Calculate the width of the letter geometry
        let { width } = getGeometrySize(geometry);
        width+=textProps.letterSpacing;

        // Check if the letter is within the bounds of the cBox mesh
        if (width <= obj.box.userData.width / 2 - textProps.padding) {
          obj.box.add(letterMesh);
          letterMeshes.push(letterMesh);
          letterGeometries.push(geometry);
        }

        // Update lineWidth
        lineWidth += width;
      }

      // Check if lineWidth exceeds cBox width - padding
      if (lineWidth > obj.box.userData.width / 2 - textProps.padding) {
        lineWidth = -(obj.box.userData.width / 2) + textProps.padding; // Reset x position to the upper-left corner
        yPosition -= textProps.lineSpacing; // Move to the next line
      }
  }

}

function constructMultiMergedScrollableGeometry(obj, text, font, material, textProps, animProps, scene = undefined){
  let lineWidth = -(obj.box.userData.width / 2 - textProps.padding);
  let yPosition = obj.box.userData.height / 2 - textProps.padding/2;
  const letterGeometries = [];
  const letterMeshes = [];
  const cubes = [];

  for (let i = 0; i < text.length; i++) {
      const character = text[i];

      if (character === ' ') {
        // Handle spaces by adjusting the x position
        lineWidth += textProps.wordSpacing;
      } else {

         if(textProps.meshProps == undefined){
          textProps.meshProps = textMeshProperties()
        }
        const geometry = createTextGeometry(character, font, textProps.size, textProps.height, textProps.meshProps.curveSegments, textProps.meshProps.bevelEnabled, textProps.meshProps.bevelThickness, textProps.meshProps.bevelSize, textProps.meshProps.bevelOffset, textProps.meshProps.bevelSegments);
        const cube = new THREE.BoxGeometry(textProps.size*2, textProps.size*2, textProps.height);

        cube.translate((textProps.size/2)+lineWidth, (textProps.size/2)+yPosition, obj.box.userData.depth/2*textProps.zOffset);

        const letterMesh = new THREE.Mesh(geometry, material);
        letterMesh.position.set(lineWidth, yPosition, obj.box.userData.depth/2*textProps.zOffset);

        if(animProps!=undefined){
          letterMesh.material.transparent=true;
          letterMesh.material.opacity=0;
        }

        // Calculate the width of the letter geometry
        let { width } = getGeometrySize(geometry);
        width+=textProps.letterSpacing;

        // Check if the letter is within the bounds of the cBox mesh
        if (width <= obj.box.userData.width / 2 - textProps.padding) {
          letterMeshes.push(letterMesh);
          letterGeometries.push(geometry);
          cubes.push(cube);
        }
        // Update lineWidth
        lineWidth += width;
      }

      // Check if lineWidth exceeds cBox width - padding
      if (lineWidth > obj.box.userData.width / 2 - textProps.padding) {
        lineWidth = -(obj.box.userData.width / 2) + textProps.padding; // Reset x position to the upper-left corner
        yPosition -= textProps.lineSpacing; // Move to the next line
      }
    }


    const mergedGeometry = BufferGeometryUtils.mergeGeometries(cubes);

    return { 'geometry': mergedGeometry, 'letterMeshes': letterMeshes }

}

function constructMultiTextMerged(obj, text, font, material, textProps, animProps, scene = undefined){
    const merged = constructMultiMergedScrollableGeometry(obj, text, font, material, textProps, animProps, scene);
    const mergedMesh = new THREE.Mesh(merged.geometry, transparentMaterial());

    const boxSize = getGeometrySize(obj.box.geometry);
    const geomSize = getGeometrySize(merged.geometry);
    mergedMesh.position.set(0, -textProps.padding, 0);
    setMergedMeshUserData(boxSize, geomSize, textProps.padding, mergedMesh);
    mergedMesh.userData.draggable=true;
    mergedMesh.userData.horizontal=false;
    if(name==''){
      name='text-'+obj.box.id;
    }
    obj.box.name = name;
    merged.letterMeshes.forEach((m, i) => {
      mergedMesh.add(m);
    });

    return mergedMesh
}

export function editTextProperties(cBox, text, textMesh, font, size, height, zOffset, letterSpacing, lineSpacing, wordSpacing, padding, draggable, meshProps, wrap=true, hasButton=false){
  return {
    'cBox': cBox,
    'text': text,
    'textMesh': textMesh,
    'font': font,
    'size': size,
    'height': height,
    'zOffset': zOffset,
    'letterSpacing': letterSpacing,
    'lineSpacing': lineSpacing,
    'wordSpacing': wordSpacing,
    'padding': padding,
    'draggable': draggable,
    'meshProps': meshProps,
    'wrap': wrap,
    'hasButton': hasButton
  }
};

function selectionTextBox(boxProps, text, font, textProps=undefined,  animProps=undefined, onCreated=undefined){

  const Box = contentBox(boxProps);
  let mat = getMaterial(textProps.matProps, 0);

  const promptGeometry = createMergedTextBoxGeometry(Box, font, boxProps.width, boxProps.height, text, textProps, animProps);
  const textMesh = new THREE.Mesh(promptGeometry, mat);
  textMesh.layers.set(0);
  const boxSize = getGeometrySize(Box.box.geometry);
  const geomSize = getGeometrySize(promptGeometry);
  const parentSize = getGeometrySize(boxProps.parent.geometry);
  setMergedMeshUserData(boxSize, geomSize, textProps.padding, textMesh);

  Box.box.add(textMesh);
  textMesh.position.set(textMesh.position.x, textMesh.position.y-textProps.padding, boxSize.depth/2+geomSize.depth/2);
  boxProps.parent.add(Box.box);
  Box.box.position.set(Box.box.position.x, Box.box.position.y, parentSize.depth/2+boxSize.depth/2);
  adjustBoxScaleRatio(Box.box, boxProps.parent);

  return {textMesh, Box}
}

function selectionTextPortal(boxProps, text, font, textProps=undefined,  animProps=undefined, onCreated=undefined){
  const Box = portalWindow(boxProps);
  let mat = getMaterial(textProps.matProps, Box.stencilRef);

  const promptGeometry = createMergedTextBoxGeometry(Box, font, boxProps.width, boxProps.height, text, textProps, animProps);
  const textMesh = new THREE.Mesh(promptGeometry, mat);
  const boxSize = getGeometrySize(Box.box.geometry);
  const geomSize = getGeometrySize(promptGeometry);
  const parentSize = getGeometrySize(boxProps.parent.geometry);
  setMergedMeshUserData(boxSize, geomSize, textProps.padding, textMesh);

  Box.box.add(textMesh);
  //textMesh.position.set(Box.width/2-geomSize.width/2-textProps.padding, -Box.height/2+geomSize.height/2+textProps.padding, textMesh.position.z);
  textMesh.position.set(textMesh.position.x, textMesh.position.y-textProps.padding, textMesh.position.z);
  boxProps.parent.add(Box.box);
  Box.box.position.set(Box.box.position.x, Box.box.position.y, parentSize.depth/2+boxSize.depth/2);
  adjustBoxScaleRatio(Box.box, boxProps.parent);

  return {textMesh, Box}
}

function buttonBase(boxProps, text, value, font, textProps, animProps=undefined, onCreated=undefined){

  const textGeometry = createMergedTextGeometry(font, boxProps.width, boxProps.height, text, textProps, animProps);
  textGeometry.center();

  const geomSize = getGeometrySize(textGeometry);
  const parentSize = getGeometrySize(boxProps.parent.geometry);
  const cBox = contentBox(boxProps);
  const boxSize = getGeometrySize(cBox.box.geometry);
  let mat = getMaterial(textProps.matProps, cBox.box.material.stencilRef);

  const textMesh = new THREE.Mesh(textGeometry, mat);

  setMergedMeshUserData(boxSize, geomSize, textProps.padding, textMesh);

  cBox.box.add(textMesh);
  textMesh.position.set(textMesh.position.x, textMesh.position.y, boxProps.depth/2+geomSize.depth/2);
  boxProps.parent.add(cBox.box);
  cBox.box.position.set(cBox.box.position.x, cBox.box.position.y, parentSize.depth/2+boxSize.depth/2);
  adjustBoxScaleRatio(cBox.box, boxProps.parent);
  cBox.box.userData.value = value;
  textMesh.userData.value = value;

  return {textMesh, cBox}
}

function TextInputBoxProperties(parent, portal=false){
  let matProps = phongMatProperties('black');
  if(portal){
    matProps = phongStencilMatProperties('black');
  }
  return boxProperties('input-box-properties', parent, 'black', 4, 2, 0.2, 10, 0.4, 0.25, true, matProps);
}

export function defaultTextInputBoxProps(parent=undefined){
  return TextInputBoxProperties(parent);
};

export function defaultTextInputPortalBoxProps(parent=undefined){
  return TextInputBoxProperties(parent, true);
};

export function textInputProperties(boxProps=defaultTextInputBoxProps(), name='', padding=0.01, textProps=undefined, matProps=undefined, buttonProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined, isPortal=false){
  return {
    'type': 'INPUT_TEXT',
    'boxProps': boxProps,
    'name': name,
    'padding': padding,
    'textProps': textProps,
    'matProps': matProps,
    'buttonProps': buttonProps,
    'animProps': animProps,
    'listConfig': listConfig,
    'onCreated': onCreated,
    'isPortal': isPortal
  }
};

function handleTextInputSetup(inputProps){
  inputPrompts.push(inputProps.textMesh);
  const textProps = inputProps.Box.box.userData.properties.textProps;
  const tProps = editTextProperties(inputProps.Box, '', inputProps.textMesh, textProps.font, textProps.size, textProps.height, textProps.zOffset, textProps.letterSpacing, textProps.lineSpacing, textProps.wordSpacing, textProps.padding, false, textProps.meshProps);
  inputProps.textMesh.userData.textProps = tProps;
  inputProps.Box.box.userData.mouseOverParent = true;
  inputProps.Box.box.userData.currentText = '';
  mouseOverable.push(inputProps.Box.box);
  mouseOverUserData(inputProps.textMesh);
}

function handleInputTextBoxProps(boxProps, widgetProps){
  let inputBoxProps = {...boxProps};
  let btnBoxProps = {...boxProps};
  let hasButton = (widgetProps.buttonProps != undefined);
  let horizontal = true;
  if(hasButton && widgetProps.buttonProps.attach == 'BOTTOM'){
    horizontal = false;
  }
  let size = calculateWidgetSize(boxProps, horizontal, hasButton, 2);

  inputBoxProps.width = size.baseWidth;
  inputBoxProps.height = size.baseHeight;
  inputBoxProps.depth = size.baseDepth;

  btnBoxProps.width = size.subWidth;
  btnBoxProps.height = size.subHeight;
  btnBoxProps.depth = size.subDepth;
  btnBoxProps.matProps = widgetProps.matProps;

  return { inputBoxProps, btnBoxProps }
}

function attachButton(widget, boxProps, widgetProps, baseWidth, baseHeight, baseDepth){
  boxProps.parent = widget.Box.box;
  widgetProps.buttonProps.boxProps = boxProps;
  widgetProps.buttonProps.font = widgetProps.textProps.font;

  let btn = undefined;
  if(!widgetProps.buttonProps.portal){
    
    btn = ButtonElement(widgetProps.buttonProps);
  }else{
    btn = PortalButtonElement(widgetProps.buttonProps);
  }
  
  let b = btn.box;
  if(btn.box == undefined){
    b = btn.cBox.box;
  }

  if(widgetProps.buttonProps.attach == 'RIGHT'){
    b.position.set(baseWidth/2+boxProps.width/2, b.position.y, -baseDepth/2+boxProps.depth/2);
  }else if(widgetProps.buttonProps.attach == 'BOTTOM'){
    
    b.position.set(b.position.x, -(baseHeight/2+boxProps.height/2), -baseDepth/2+boxProps.depth/2);
  }
  
}

function TextInput(textInputProps){
  let props = handleInputTextBoxProps(textInputProps.boxProps, textInputProps);

  let input = selectionTextBox(props.inputBoxProps, textInputProps.name, textInputProps.textProps.font, textInputProps.textProps, textInputProps.animProps, textInputProps.onCreated);
  mouseOverable.push(input.textMesh);

  if(textInputProps.buttonProps != undefined){
    attachButton(input, props.btnBoxProps, textInputProps, props.inputBoxProps.width, props.inputBoxProps.height, props.inputBoxProps.depth);
  }

  input.Box.box.userData.properties = textInputProps;

  handleTextInputSetup(input);
}

export function createTextInput(textInputProps) {
  if(typeof textInputProps.textProps.font === 'string'){
    // Load the font
    loader.load(textInputProps.textProps.font, (font) => {
      textInputProps.textProps.font = font;
      TextInput(textInputProps);
    });
  }else if(textInputProps.textProps.font.isFont){
    TextInput(textInputProps);
  }
};

function ScrollableTextInput(textInputProps) {
  let props = handleInputTextBoxProps(textInputProps.boxProps, textInputProps);
  let input = selectionTextBox(props.inputBoxProps, textInputProps.name, textInputProps.textProps.font, textInputProps.textProps, textInputProps.animProps, textInputProps.onCreated);

  if(textInputProps.buttonProps != undefined){
    attachButton(input, props.btnBoxProps, textInputProps, props.inputBoxProps.width, props.inputBoxProps.height, props.inputBoxProps.depth);
  }

  input.Box.box.userData.properties = textInputProps;

  handleTextInputSetup(input);
}

//TODO: Need to fix Scrolling!!
export function createScrollableTextInput(textInputProps) {
  if(typeof textInputProps.textProps.font === 'string'){
    // Load the font
    loader.load(textInputProps.textProps.font, (font) => {
      textInputProps.textProps.font = font;
      ScrollableTextInput(textInputProps);
    });
  }else if(textInputProps.textProps.font.isFont){
    ScrollableTextInput(textInputProps);
  }
};

function TextInputPortal(textInputProps){
  let props = handleInputTextBoxProps(textInputProps.boxProps, textInputProps);
  let input = selectionTextPortal(props.inputBoxProps, textInputProps.name, textInputProps.textProps.font, textInputProps.textProps, textInputProps.animProps, textInputProps.onCreated);
  mouseOverable.push(input.textMesh);

  if(textInputProps.buttonProps != undefined){
    attachButton(input, props.btnBoxProps, textInputProps, props.inputBoxProps.width, props.inputBoxProps.height, props.inputBoxProps.depth);
  }

  input.Box.box.userData.properties = textInputProps;

  handleTextInputSetup(input);
}

export function createTextInputPortal(textInputProps) {
  if(typeof textInputProps.textProps.font === 'string'){
    // Load the font
    loader.load(textInputProps.textProps.font, (font) => {
      textInputProps.textProps.font = font;
      TextInputPortal(textInputProps);
    });
  }else if(textInputProps.textProps.font.isFont){
    TextInputPortal(textInputProps);
  }
};

//TODO: Scrolling is broken, needs to be fixed
function ScrollableTextInputPortal(textInputProps) {
  let props = handleInputTextBoxProps(textInputProps.boxProps, textInputProps);
  let input = selectionTextPortal(props.inputBoxProps, textInputProps.name, textInputProps.textProps.font, textInputProps.textProps, textInputProps.animProps, textInputProps.onCreated);

  if(textInputProps.buttonProps != undefined){
    attachButton(input, props.btnBoxProps, textInputProps, props.inputBoxProps.width, props.inputBoxProps.height, props.inputBoxProps.depth)
  }

  input.Box.box.userData.properties = textInputProps;
  input.textMesh.userData.draggable=true;

  handleTextInputSetup(input);
}

export function createScrollableTextInputPortal(textInputProps) {
  if(typeof textInputProps.textProps.font === 'string'){
    // Load the font
    loader.load(textInputProps.textProps.font, (font) => {
      textInputProps.textProps.font = font;
      ScrollableTextInputPortal(textInputProps);
    });
  }else if(textInputProps.textProps.font.isFont){
    ScrollableTextInputPortal(textInputProps);
  }
};

function onSelectorChoice(selection){
  let base = selection.parent.parent;
  base.userData.selection = selection;

  base.userData.selectors.forEach((c, idx) => {
    if(c.children[0].userData.selected){
      base.userData.lastSelected = c;
    }
    c.children[0].userData.selected = false;
  })

  selection.userData.selected = true;
  let first = selection.parent;
  base.userData.selectors.sort(function(x,y){ return x == first ? -1 : y == first ? 1 : 0; });
  selectorAnimation(selection.parent.parent, 'SELECT');

}

export function listSelectorProperties(boxProps=defaultTextInputBoxProps(), name='', padding=0.01, textProps=undefined, matProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined, isPortal=false){
  return {
    'type': 'LIST_SELECTOR',
    'boxProps': boxProps,
    'name': name,
    'padding': padding,
    'textProps': textProps,
    'matProps': matProps,
    'animProps': animProps,
    'listConfig': listConfig,
    'onCreated': onCreated,
    'isPortal': isPortal
  }
};

function ListSelector(listSelectorProps, selectors){
  const isPortal = listSelectorProps.isPortal;
  let mainBoxProps = {...listSelectorProps.boxProps};
  let mainMatProps = {...listSelectorProps.matProps};
  mainBoxProps.matProps = mainMatProps;
  let portalBoxProps = {...listSelectorProps.boxProps};
  let portalMatProps = {...listSelectorProps.matProps};
  portalBoxProps.matProps = portalMatProps;
  let btnBoxProps = {...listSelectorProps.boxProps};
  let btnMatProps = {...listSelectorProps.matProps};
  let btnTextProps = {...listSelectorProps.textProps};
  btnBoxProps.matProps = btnMatProps;
  let portal = undefined;

  if(isPortal){
    portalBoxProps.matProps.userCase = 'STENCIL';
    mainBoxProps.matProps.useCase = 'STENCIL_CHILD';
    btnBoxProps.matProps.useCase = 'STENCIL_CHILD';
    btnTextProps.matProps.useCase = 'STENCIL_CHILD';
    portal = portalWindow(portalBoxProps);
    darkenMaterial(portal.box.material, 30);
    listSelectorProps.boxProps.parent.add(portal.box);
  }


  let textProps = listSelectorProps.textProps;
  let cBox = contentBox(mainBoxProps);

  selectorUserData(cBox.box);
  let idx = 0;

  for (const [key, val] of Object.entries(selectors)) {
    let btn = buttonBase(btnBoxProps, key, val, btnTextProps.font, btnTextProps, listSelectorProps.animProps, listSelectorProps.onCreated);
    let selector = btn.cBox;
    let textMesh = btn.textMesh;

    const tProps = editTextProperties(selector, '', btnTextProps.textMesh, btnTextProps.font, btnTextProps.size, btnTextProps.height, btnTextProps.zOffset, btnTextProps.letterSpacing, btnTextProps.lineSpacing, btnTextProps.wordSpacing, btnTextProps.padding, true, btnTextProps.meshProps);
    textMesh.userData.textProps = tProps;
    inputPrompts.push(textMesh);
    mouseOverable.push(textMesh);
    clickable.push(textMesh);
    selector.box.name = key;
    
    selectorTextUserData(btn, key, val, idx, listSelectorProps.boxProps);
    mouseOverUserData(textMesh);

    cBox.box.userData.selectors.push(selector.box);
    selectorElems.push(selector.box);
    cBox.box.add(selector.box);
      
    textMesh.addEventListener('action', function(event) {
      onSelectorChoice(textMesh)
    });

    if(idx==0){
      textMesh.userData.selected = true;
      selector.box.position.copy(selector.box.userData.selectedPos);

    }else{
      selector.box.position.copy(selector.box.userData.unselectedPos);
      selector.box.scale.set(cBox.box.unselectedScale, cBox.box.unselectedScale, cBox.box.unselectedScale);
    }

    if(portal!=undefined){
      selector.box.material.stencilRef = portal.box.material.stencilRef;
      selector.box.material.depthWrite = true;
      textMesh.material.stencilRef = portal.box.material.stencilRef;
      textMesh.material.depthWrite = true;
    }

    idx+=1;
  }

  if(portal!=undefined){
    cBox.box.userData.portal = portal.box;
    portal.box.position.set(portal.box.position.x, portal.box.position.y, -cBox.depth);
    cBox.box.position.set(cBox.box.position.x, cBox.box.position.y, portal.box.position.z-(cBox.depth*2));
  }

  cBox.box.userData.properties = listSelectorProps;

  listSelectorProps.boxProps.parent.add(cBox.box);
}

export function createListSelector(listSelectorProps, selectors) {

  if(typeof listSelectorProps.textProps.font === 'string'){
    // Load the font
    loader.load(listSelectorProps.textProps.font, (font) => {
      listSelectorProps.textProps.font = font;
      ListSelector(listSelectorProps, selectors);
    });
  }else if(listSelectorProps.textProps.font.isFont){
    ListSelector(listSelectorProps, selectors);
  }

};

export function createListSelectorPortal(listSelectorProps, selectors) {
  listSelectorProps.isPortal = true;
  createListSelector(listSelectorProps, selectors);
};

function selectorTextUserData(selText, key, value, index, boxProps){
  const textSize = getGeometrySize(selText.textMesh.geometry);
  selText.textMesh.userData.draggable = false;
  selText.textMesh.userData.key = key;
  selText.textMesh.userData.value = value;
  selText.textMesh.userData.index = index;
  selText.textMesh.userData.selected = false;
  selText.cBox.box.userData.selectedScale = 1;
  selText.cBox.box.userData.unselectedScale = 0.9;
  selText.cBox.box.userData.selectedPos = new THREE.Vector3(selText.cBox.box.position.x, selText.cBox.box.position.y, selText.cBox.depth+(boxProps.depth+textSize.depth));
  selText.cBox.box.userData.unselectedPos = new THREE.Vector3(selText.cBox.box.position.x, selText.cBox.box.position.y, selText.cBox.depth);
  selText.cBox.box.userData.mouseOverParent = true;
  selText.cBox.box.userData.currentText = key;
}

export function buttonProperties(boxProps, font, name='Button', value='', padding=0.01, textProps=undefined, matProps=undefined, mouseOver=false, portal=false, attach='RIGHT'){
  return {
    'boxProps': boxProps,
    'font': font,
    'name': name,
    'value': value,
    'padding': padding,
    'textProps': textProps,
    'matProps': matProps,
    'mouseOver': mouseOver,
    'portal': portal,
    'attach': attach
  }
};

function ButtonElement(buttonProps){
  let textMesh = buttonBase(buttonProps.boxProps, buttonProps.name, buttonProps.value, buttonProps.font, buttonProps.textProps);
  let textProps = buttonProps.textProps;
  const tProps = editTextProperties(textMesh.cBox, '', textMesh.textMesh, buttonProps.font, textProps.size, textProps.height, textProps.zOffset, textProps.letterSpacing, textProps.lineSpacing, textProps.wordSpacing, textProps.padding, true, textProps.meshProps);
  textMesh.cBox.box.userData.textProps = tProps;
  textMesh.cBox.box.userData.draggable = false;
  textMesh.textMesh.userData.mouseOverParent = true;

  mouseOverUserData(textMesh.cBox.box);
  clickable.push(textMesh.cBox.box);
  if(mouseOver){
    mouseOverable.push(textMesh.cBox.box);
  }

  return textMesh
}

function PortalButtonElement(buttonProps){
  const portal = portalWindow(buttonProps.boxProps);
  const stencilRef = portal.box.material.stencilRef;
  setupStencilMaterial(portal.box.material, stencilRef);
  let txtMesh = ButtonElement(buttonProps);
  const textSize = getGeometrySize(txtMesh.textMesh.geometry);

  txtMesh.cBox.box.material.opacity = 0;
  txtMesh.cBox.box.material.transparent = true;
  setupStencilChildMaterial(txtMesh.cBox.box.material, stencilRef);
  setupStencilChildMaterial(txtMesh.textMesh.material, stencilRef);
  portal.box.add(txtMesh.cBox.box);
  txtMesh.cBox.box.position.set(txtMesh.cBox.box.position.x, txtMesh.cBox.box.position.y, -txtMesh.cBox.depth/2);
  txtMesh.textMesh.position.set(txtMesh.textMesh.position.x, txtMesh.textMesh.position.y, -textSize.depth/2);
  buttonProps.boxProps.parent.add(portal.box);

  return portal
}

function Button(buttonProps, animProps=undefined, onCreated=undefined, mouseOver=true) {
  loader.load(buttonProps.font, (font) => {
    buttonProps.font = font;
    let txtMesh = ButtonElement(buttonProps);
  });
}

function portalButton(buttonProps, animProps=undefined, onCreated=undefined, mouseOver=true) {
  loader.load(buttonProps.font, (font) => {
    buttonProps.font = font;
    let txtMesh = PortalButtonElement(buttonProps);
  });
}

export function createButton(buttonProps, animProps=undefined, onCreated=undefined){
  Button(buttonProps, animProps, onCreated, false);
};

export function createPortalButton(buttonProps, animProps=undefined, onCreated=undefined){
  portalButton(buttonProps, animProps, onCreated, false);
};

export function createMouseOverButton(buttonProps, animProps=undefined, onCreated=undefined){
  buttonProps.mouseOver = true;
  Button(buttonProps, animProps, onCreated, true);
};

export function createMouseOverPortalButton(buttonProps, animProps=undefined, onCreated=undefined){
  buttonProps.mouseOver = true;
  portalButton(buttonProps, animProps, onCreated, true);
};

function createWidgetText(font, boxProps, name, textProps, animProps=undefined, onCreated=undefined, horizontal=true){
  if(boxProps.name.length>0){

    let mat = getMaterial(textProps.matProps, boxProps.parent.material.stencilRef);
    const geometry = createTextGeometry(name, font, textProps.size, textProps.height, textProps.meshProps.curveSegments, textProps.meshProps.bevelEnabled, textProps.meshProps.bevelThickness, textProps.meshProps.bevelSize, textProps.meshProps.bevelOffset, textProps.meshProps.bevelSegments);
    geometry.center();
    const mergedMesh = new THREE.Mesh(geometry, mat);


    mergedMesh.position.set(0, boxProps.height/2+textProps.padding, 0);
    if(!horizontal){
      mergedMesh.position.set(0, boxProps.height/2+textProps.padding, 0);
    }
    boxProps.parent.add(mergedMesh);
  }
}

export function createSliderBox(boxProps, sliderProps, textProps,  animProps=undefined, onCreated=undefined, horizontal=true) {
  loader.load(textProps.font, (font) => {
    sliderProps.font = font;
    const parentSize = getGeometrySize(boxProps.parent.geometry);
    let slider = sliderBox(boxProps, sliderProps);
    let size = calculateWidgetSize(boxProps, sliderProps.horizontal, sliderProps.useValueText, 8);
    
    boxProps.parent.add(slider.base);
    slider.base.position.set(slider.base.position.x, slider.base.position.y, slider.base.position.z+parentSize.depth/2);
    draggable.push(slider.handle);

    createWidgetText(font, boxProps, sliderProps.name, textProps, animProps, onCreated, horizontal);
    if(sliderProps.useValueText){
      if(sliderProps.horizontal){
        slider.base.position.set(slider.base.position.x-size.subWidth/2, slider.base.position.y, slider.base.position.z);
      }else{
        slider.base.position.set(slider.base.position.x, slider.base.position.y+size.subHeight/2, slider.base.position.z);
      }
    }
  });
};

function ToggleBox(toggleProps){
  const parentSize = getGeometrySize(toggleProps.boxProps.parent.geometry);
  let toggle = toggleBase(toggleProps);
  toggleProps.boxProps.parent.add(toggle.base);
  toggle.base.position.set(toggle.base.position.x, toggle.base.position.y, toggle.base.position.z+parentSize.depth/2);
  toggles.push(toggle.handle);

  createWidgetText(toggleProps.textProps.font, toggleProps.boxProps, toggleProps.name, toggleProps.textProps, toggleProps.animProps, toggleProps.onCreated, toggleProps.horizontal);
}

export function createToggleBox(toggleProps) {

  if(typeof toggleProps.textProps.font === 'string'){
    // Load the font
    loader.load(toggleProps.textProps.font, (font) => {
      toggleProps.textProps.font = font;
      ToggleBox(toggleProps);

    });
  }else if(toggleProps.textProps.font.isFont){
    ToggleBox(toggleProps);
  }
};

function TogglePortal(toggleProps) {
  const parentSize = getGeometrySize(toggleProps.boxProps.parent.geometry);
  let stencilRef = getStencilRef();
  let toggle = toggleBase(toggleProps);
  setupStencilMaterial(toggle.base.material, stencilRef);
  setupStencilChildMaterial(toggle.handle.material, stencilRef);
  toggle.base.material.depthWrite = false;
  toggle.handle.material.depthWrite = false;
  toggleProps.boxProps.parent.add(toggle.base);
  toggle.base.position.set(toggle.base.position.x, toggle.base.position.y, toggle.base.position.z+parentSize.depth/2);
  toggles.push(toggle.handle);

  createWidgetText(toggleProps.textProps.font, toggleProps.boxProps, toggleProps.name, toggleProps.textProps, toggleProps.textProps.meshProps, toggleProps.animProps, toggleProps.onCreated, toggleProps.horizontal);
}

export function createTogglePortal(toggleProps) {

  if(typeof toggleProps.textProps.font === 'string'){
    // Load the font
    loader.load(toggleProps.textProps.font, (font) => {
      toggleProps.textProps.font = font;
      TogglePortal(toggleProps);
    });
  }else if(toggleProps.textProps.font.isFont){
    TogglePortal(toggleProps);
  }
};


export function createImageBox(boxProps, imgUrl, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined){

  const cBox = contentWindow(boxProps);
  const boxSize = getGeometrySize(cBox.box.geometry);
  const map = new THREE.TextureLoader().load( imgUrl );
  const material = new THREE.MeshBasicMaterial( { color: 'white', map: map } );
  cBox.box.material = material;

  if(listConfig != undefined){
    cBox.box.name = boxProps.name;
    createListItem(listConfig.boxProps, cBox.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
  }else{
    boxProps.parent.add(cBox.box);
  }

};

export function createImagePortal(boxProps, imgUrl, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined){

  const portal = portalWindow(boxProps);
  const cBox = contentWindow(boxProps);
  const boxSize = getGeometrySize(cBox.box.geometry);
  const map = new THREE.TextureLoader().load( imgUrl );
  const material = new THREE.MeshBasicMaterial( { color: 'white', map: map } );
  cBox.box.material = material;
  cBox.box.material.stencilWrite = true;
  cBox.box.material.stencilRef = portal.stencilRef;
  cBox.box.material.stencilFunc = THREE.EqualStencilFunc;
  cBox.box.renderOrder = 2;

  portal.box.add(cBox.box);
  cBox.box.position.set(cBox.box.position.x, cBox.box.position.y, cBox.box.position.z+textProps.zOffset);

  if(listConfig != undefined){
    portal.box.name = boxProps.name;
    createListItem(listConfig.boxProps, portal.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
  }else{
    boxProps.parent.add(portal.box);
  }

};

export function createGLTFModel(boxProps, gltfUrl, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined){
  
  const cBox = contentBox(boxProps);
  const boxSize = getGeometrySize(cBox.box.geometry);
  // Instantiate a loader
  gltfLoader.load(
    // resource URL
    gltfUrl,
    // called when the resource is loaded
    function ( gltf ) {
      const box = new THREE.Box3().setFromObject( gltf.scene ); 
      const sceneSize = box.getSize(new THREE.Vector3());

      let axis = 'y';
      let prop = 'height';
      if(sceneSize.x > sceneSize.y){
        axis = 'x';
        prop = 'width';
      }

      cBox.box.material.opacity = 0;
      cBox.box.material.transparent = true;

      let ratio = boxSize[prop]/sceneSize[axis];

      if(boxSize[prop]>sceneSize[axis]){
        ratio = sceneSize[axis]/boxSize[prop];
      }

      gltf.scene.scale.set(gltf.scene.scale.x*ratio, gltf.scene.scale.y*ratio, gltf.scene.scale.z*ratio);
      gltf.scene.position.set(gltf.scene.position.x, gltf.scene.position.y, gltf.scene.position.z+boxSize.depth+(sceneSize.z/2*ratio));

      cBox.box.add( gltf.scene );

      if(listConfig != undefined){
        cBox.box.name = boxProps.name;
        createListItem(listConfig.boxProps, cBox.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
      }else{
        boxProps.parent.add(cBox.box);
      }

    },
    // called while loading is progressing
    function ( xhr ) {

      console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

    },
    // called when loading has errors
    function ( error ) {

      console.log( 'An error happened' );

    }
  );
};


export function createGLTFModelPortal(boxProps, gltfUrl, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined){
  const portal = portalWindow(boxProps);
  const boxSize = getGeometrySize(portal.box.geometry);
  const parentSize = getGeometrySize(boxProps.parent.geometry);

  // Instantiate a loader
  gltfLoader.load(
    // resource URL
    gltfUrl,
    // called when the resource is loaded
    function ( gltf ) {
      const box = new THREE.Box3().setFromObject( gltf.scene ); 
      const sceneSize = box.getSize(new THREE.Vector3());

      gltf.scene.traverse( function( object ) {
          if(object.isMesh){
            object.material.stencilWrite = true;
            object.material.stencilRef = portal.stencilRef;
            object.material.stencilFunc = THREE.EqualStencilFunc;
          }
      } );

      let axis = 'y';
      let prop = 'height';
      if(sceneSize.x > sceneSize.y){
        axis = 'x';
        prop = 'width';
      }

      let ratio = boxSize[prop]/sceneSize[axis];

      if(boxSize[prop]>sceneSize[axis]){
        ratio = sceneSize[axis]/boxSize[prop];
      }

      gltf.scene.scale.set(gltf.scene.scale.x*ratio, gltf.scene.scale.y*ratio, gltf.scene.scale.z*ratio);
      gltf.scene.position.set(gltf.scene.position.x, gltf.scene.position.y, gltf.scene.position.z-boxSize.depth-(sceneSize.z*ratio))
      gltf.scene.renderOrder = 2;
      portal.box.add(gltf.scene);

      if(listConfig != undefined){
        portal.box.name = boxProps.name;
        createListItem(listConfig.boxProps, portal.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
      }else{
        boxProps.parent.add(portal.box);
        portal.box.position.set(portal.box.position.x, portal.box.position.y, portal.box.position.z+(parentSize.depth/2))
      }

    },
    // called while loading is progressing
    function ( xhr ) {

      console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

    },
    // called when loading has errors
    function ( error ) {

      console.log( 'An error happened' );
      console.log(error)

    }
  );
}

export function createListItem( boxProps, content, textProps=undefined,  animProps=undefined, infoProps=undefined, useTimeStamp=true, spacing=0, childInset=0.9, index=0) {
  const parentSize = getGeometrySize(boxProps.parent.geometry);
  const contentSize = getGeometrySize(content.geometry);
  const elemBox = contentBox(boxProps);
  elemBox.box.userData.elemIndex = index;
  const elemBoxSize = getGeometrySize(elemBox.box.geometry);
  elemBox.box.add(content);
  content.position.set(0, 0, elemBoxSize.depth/2+0.01);
  content.scale.set(content.scale.x*childInset, content.scale.y*childInset, content.scale.z*childInset);

  if(infoProps.title.length>0 || infoProps.author.length>0 || useTimeStamp){

    loader.load(textProps.font, (font) => {

      //let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});
      let mat = getMaterial(textProps.matProps, 0);

      if(infoProps.title.length>0){

          const geometry = createTextGeometry(infoProps.title, font, textProps.size, textProps.height, textProps.meshProps.curveSegments, textProps.meshProps.bevelEnabled, textProps.meshProps.bevelThickness, textProps.meshProps.bevelSize, textProps.meshProps.bevelOffset, textProps.meshProps.bevelSegments);
          geometry.center();
          const textMesh = new THREE.Mesh(geometry, mat);
          const textMeshSize = getGeometrySize(textMesh.geometry);
          elemBox.box.add(textMesh);

          textMesh.position.set(0, (elemBoxSize.height/2)-(textMeshSize.height/2)-(textProps.padding*2), (elemBoxSize.depth/2)+textMeshSize.depth/2);
          elemBox.box.userData.title = textMesh;

      }

      if(infoProps.author.length>0){

        const geometry = createTextGeometry(infoProps.author, font, textProps.size, textProps.height, textProps.meshProps.curveSegments, textProps.meshProps.bevelEnabled, textProps.meshProps.bevelThickness, textProps.meshProps.bevelSize, textProps.meshProps.bevelOffset, textProps.meshProps.bevelSegments);
        geometry.center();
        const textMesh = new THREE.Mesh(geometry, mat);
        const textMeshSize = getGeometrySize(textMesh.geometry);
        elemBox.box.add(textMesh);

        textMesh.position.set(-(elemBoxSize.width/2-textProps.padding)+(textMeshSize.width/2)+textProps.padding, -(elemBoxSize.height/2)+(textMeshSize.height/2)+(textProps.padding*2), (elemBoxSize.depth/2)+textMeshSize.depth/2);
        elemBox.box.userData.author = textMesh;

      }

      let timestamp = Number(new Date());
      let date = new Date(timestamp).toString();
      const geometry = createTextGeometry(date, font, textProps.size*0.5, textProps.height, textProps.meshProps.curveSegments, textProps.meshProps.bevelEnabled, textProps.meshProps.bevelThickness, textProps.meshProps.bevelSize, textProps.meshProps.bevelOffset, textProps.meshProps.bevelSegments);
      geometry.center();
      const textMesh = new THREE.Mesh(geometry, mat);
      const textMeshSize = getGeometrySize(textMesh.geometry);
      elemBox.box.add(textMesh);
      textMesh.position.set(-(elemBoxSize.width/2-textProps.padding)+(textMeshSize.width/2)+textProps.padding, -(elemBoxSize.height/2)+(textMeshSize.height/2)+(textProps.padding*2), (elemBoxSize.depth/2)+textMeshSize.depth/2);

      boxProps.parent.add(elemBox.box);

      elemBox.box.userData.date = textMesh;
      if( 'author' in elemBox.box.userData && elemBox.box.userData.author != undefined){
        elemBox.box.userData.author.position.set(elemBox.box.userData.author.position.x, elemBox.box.userData.author.position.y+textMeshSize.height+(textProps.padding*2), elemBox.box.userData.author.position.z)
      }

      elemBox.box.position.set(elemBox.box.position.x, (boxProps.parent.userData.height-spacing)/2-elemBoxSize.height/2-((elemBoxSize.height+spacing)*index), elemBox.box.position.z+parentSize.depth)

    });
  }

};

export function createStaticTextList( boxProps, contentArr, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    createStaticTextBox(boxProps, text, textProps, animProps, lConfig);
  });

};

export function createStaticTextPortalList( boxProps, contentArr, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    createStaticTextPortal(boxProps, text, textProps, animProps, lConfig);
  });

};

export function createStaticScrollableTextList( boxProps, contentArr, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    createStaticScrollableTextBox(boxProps, text, textProps, animProps, lConfig);
  });

};

export function createStaticScrollableTextPortalList( boxProps, contentArr, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    createStaticScrollableTextPortal(boxProps, text, textProps, animProps, lConfig);
  });

};

export function createMultiTextList( boxProps, contentArr, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    createMultiTextBox(boxProps, text, textProps, animProps, lConfig);
  });

};

export function createMultiTextPortalList( boxProps, contentArr, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    createMultiTextPortal(boxProps, text, textProps, animProps, lConfig);
  });

};

export function createMultiScrollableTextList( boxProps, contentArr, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    createMultiScrollableTextBox(boxProps, text, textProps, animProps, lConfig);
  });

};

export function createMultiScrollableTextPortalList( boxProps, contentArr, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    createMultiScrollableTextPortal(boxProps, text, textProps, animProps, lConfig);
  });

};

export function createImageContentList( boxProps, contentArr, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((imgUrl, index) =>{
    console.log(imgUrl);
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index)
    createImageBox(boxProps, imgUrl, textProps, animProps, lConfig);
  });

};

export function createImagePortalList(boxProps, contentArr, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((imgUrl, index) =>{
    console.log(imgUrl);
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index)
    createImagePortal(boxProps, imgUrl, textProps, animProps, lConfig);
  });

};

export function createGLTFContentList( boxProps, contentArr, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((gltfUrl, index) =>{
    console.log(gltfUrl)
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index)
    createGLTFModel(lConfig.boxProps, gltfUrl, lConfig.textProps, lConfig.animProps, lConfig);
  });

};

export function createGLTFContentPortalList( boxProps, contentArr, textProps=undefined,  animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(listConfig.boxProps.parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((gltfUrl, index) =>{
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index)
    createGLTFModelPortal(boxProps, gltfUrl, textProps, animProps, lConfig);
  });

};

export function addTranslationControl(elem, camera, renderer){

  control = new TransformControls( camera, renderer.domElement );
  control.addEventListener( 'change', render );
  control.attach( elem );


};

//INTERACTION HANDLERS
export function mouseDownHandler(raycaster){
  mouseDown = true;
  isDragging = true;
  previousMouseX = event.clientX;
  previousMouseY = event.clientY;

  const intersectsDraggable = raycaster.intersectObjects(draggable);
  const intersectsClickable = raycaster.intersectObjects(clickable);
  const intersectsToggle = raycaster.intersectObjects(toggles);

  if ( intersectsDraggable.length > 0 ) {
    console.log('intersects draggable')
    lastDragged = intersectsDraggable[0].object;
  }

  if ( intersectsClickable.length > 0 ) {
    console.log("Clickable")
    let obj = intersectsClickable[0].object;
    obj.dispatchEvent({type:'action'});

    if(!clickable.includes(obj))
      return;

    clickAnimation(obj);

  }

  if ( intersectsToggle.length > 0 ) {
    let obj = intersectsToggle[0].object;
    obj.dispatchEvent({type:'action'});
  }
}

export function mouseUpHandler(){
  mouseDown = false;
  isDragging = false;
}

export function mouseMoveHandler(raycaster, event){
  if (lastDragged != undefined && lastDragged.userData.draggable && mouseDown && isDragging) {
    const deltaX = event.clientX - previousMouseX;
    const deltaY = event.clientY - previousMouseY;
    const dragPosition = lastDragged.position.clone();
    if(!lastDragged.userData.horizontal){
      dragDistY = deltaY;

      if(deltaY<0){
        moveDir=1
      }else{
        moveDir=-1;
      }
      // Limit scrolling
      dragPosition.y = Math.max(lastDragged.userData.minScroll, Math.min(lastDragged.userData.maxScroll+lastDragged.userData.padding, dragPosition.y - deltaY * 0.01));
      lastDragged.position.copy(dragPosition);
      previousMouseY = event.clientY;
      lastDragged.dispatchEvent({type:'action'});
    }else{
      dragDistX = deltaX;

      if(deltaX<0){
        moveDir=1
      }else{
        moveDir=-1;
      }
      // Limit scrolling
      dragPosition.x = Math.max(lastDragged.userData.minScroll, Math.min(lastDragged.userData.maxScroll-lastDragged.userData.padding, dragPosition.x + deltaX * 0.01));
      lastDragged.position.copy(dragPosition);
      previousMouseX = event.clientX;
      lastDragged.dispatchEvent({type:'action'});
    }
    
  }

  const intersectsMouseOverable = raycaster.intersectObjects(mouseOverable);
  const intersectsselectorElems = raycaster.intersectObjects(selectorElems);
  let canMouseOver = true;

  if(intersectsMouseOverable.length > 0){

    let elem = intersectsMouseOverable[0].object;

    if(elem.userData.mouseOverParent != undefined){
      canMouseOver = false;
    }

    if(!mouseOver.includes(elem) && canMouseOver){
      elem.userData.mouseOver = true;
      mouseOver.push(elem);
      mouseOverAnimation(elem);
    }

  }else if(intersectsselectorElems.length > 0){

    let e = intersectsselectorElems[0].object;
    // console.log("elem")
    if(e.parent.userData.selectors != undefined && !e.parent.userData.open){
      selectorAnimation(e.parent);
    }

  }else{

    mouseOver.forEach((elem, idx) => {
      if(elem.userData.mouseOver && canMouseOver){
        elem.userData.mouseOver = false;
        mouseOverAnimation(elem);
        mouseOver.splice(mouseOver.indexOf(elem));
      }
    });

    selectorElems.forEach((elem, idx) => {
      if(elem.parent.userData.selectors != undefined && elem.parent.userData.open){
        selectorAnimation(elem.parent, 'CLOSE');
      }
    });
  }
}

function inputTextYPosition(event, textMesh, boxSize, padding){

  let yPosition = textMesh.position.y;
  let textSize = getGeometrySize(textMesh.geometry);

  if(textMesh.widget == undefined){
    if (event.key === 'Enter') {
      yPosition=boxSize.height-boxSize.height;
    }else{
      yPosition=textSize.height-padding;
    }
  }

  return yPosition

}

function onEnterKey(event, textMesh, currentText, boxSize, padding){

  let yPosition = textMesh.position.y;

  if(textMesh.widget == undefined){
    yPosition=inputTextYPosition(event, textMesh, boxSize, padding);
    textMesh.position.set(textMesh.position.x, yPosition, textMesh.position.z);
    if(textMesh.userData.textProps.draggable){
      draggable.push(textMesh);
    }
  }else{
    textMesh.widget.base.userData.value = currentText;
    textMesh.dispatchEvent({type:'update'});
  }
}

function onHandleTextGeometry(textMesh, currentText, boxSize){
  if(textMesh.widget != undefined)//widgets update their own text geometry
    return;

  let textProps = textMesh.userData.textProps;
  if(currentText.length > 0){
    textMesh.scale.copy(textMesh.userData.defaultScale);
    textMesh.geometry.dispose(); // Clear the previous text
    textMesh.geometry = createMergedTextBoxGeometry(textProps.cBox, textProps.font, boxSize.Width, boxSize.height, currentText, textProps);
  }
}

function onHandleTypingText(event, textMesh, currentText, boxSize, padding){

  let yPosition = textMesh.position.y;

  if(textMesh.widget == undefined){
    yPosition=inputTextYPosition(event, textMesh, boxSize, padding);
    textMesh.position.set(textMesh.position.x, yPosition, textMesh.position.z);

    textMesh.userData.textProps.cBox.box.userData.currentText = currentText;
  }else{
    if(textMesh.userData.numeric && !isNaN(currentText)){
      textMesh.widget.base.userData.value = currentText;
      textMesh.userData.textProps.cBox.box.userData.currentText = currentText;
      textMesh.widget.base.userData.valueBox.dispatchEvent({type:'update'});
    }
  } 
}

export function doubleClickHandler(raycaster){
  raycaster.layers.set(0);
  const intersectsInputPrompt = raycaster.intersectObjects(inputPrompts);

  if(intersectsInputPrompt.length > 0){

    let textMesh = intersectsInputPrompt[0].object;
    let userData = textMesh.userData;
    const textProps = textMesh.userData.textProps;

    // Initialize variables for typing
    let currentText = textProps.cBox.box.userData.currentText;
    let boxSize = getGeometrySize(textProps.cBox.box.geometry);
    let pos = new THREE.Vector3().copy(textMesh.position);
    let padding = textProps.padding;

    if(!textProps.draggable){
      inputPrompts.push(textMesh);
      mouseOverable.push(textMesh);
      clickable.push(textMesh);
    }

    let yPosition = inputTextYPosition(event, textMesh, boxSize, padding);

    // Listen for keyboard input
    window.addEventListener('keydown', (event) => {

        if (event.key === 'Enter') {;
          onEnterKey(event, textMesh, currentText, boxSize, padding);
        } else if (event.key === 'Backspace') {
            // Handle backspace
            currentText = currentText.slice(0, -1);
        } else if (event.key === 'Shift' || event.key === 'Control' || event.key === 'Capslock') {

        } else if (event.key === 'ArrowDown' ) {

        } else if (event.key === 'ArrowUp' ) {

        } else {
          if(event.shiftKey || event.capslock){
            currentText += event.key.toUpperCase();
          }else{
            currentText += event.key;
          }
          onHandleTypingText(event, textMesh, currentText, boxSize, padding);

        }
        onHandleTextGeometry(textMesh, currentText, boxSize);
      });
    }
}

