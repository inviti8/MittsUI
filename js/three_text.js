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
  geometry.morphAttributes[Object.keys(geometry.morphAttributes).length] = {name: morphName, vertices: verts};
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
    'type': 'LIST_CONFIG',
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
    'type': 'ANIMATION_PROPS',
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
    'type': 'INFO_PROPS',
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

    function selectorOnUpdate(elem, props){
      if(elem.userData.open){

      }else{

      }
      //gsap.to(elem.scale, props);
    }

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
        props = { duration: duration, x: scales[i], y: scales[i], z: scales[i], ease: easeIn};
        gsap.to(current.scale, props);
      }

      if(elem.userData.properties.isPortal){
        console.log('HERE')
        let props = { duration: duration, 0: 0, ease: easeIn };
        if(elem.userData.open){
          props = { duration: duration, 0: 1, ease: easeIn };
        }
        gsap.to(elem.morphTargetInfluences, props);
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

  let props = { duration: duration, x: pos.x, y: elem.handle.position.y, z: elem.handle.position.z, ease: easeIn, onComplete: ToggleWidget.DoToggle, onCompleteParams:[elem] };

  if(!elem.handle.userData.horizontal){
    props = { duration: duration, x: elem.handle.position.x, y: pos.y, z: elem.handle.position.z, ease: easeIn, onComplete: ToggleWidget.DoToggle, onCompleteParams:[elem] };
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
    'type': 'TEXT_MESH_PROPS',
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
    setupStencilMaterial(mat, getStencilRef());
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

export function boxProperties(name, parent, color, width, height, depth, smoothness, radius, zOffset = 1, complexMesh=true, matProps=materialProperties(), pivot='CENTER', padding=0.01, isPortal=false){
  return {
    'type': 'BOX_PROPS',
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
    'padding': padding,
    'isPortal': isPortal
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



class BaseBox {
  constructor(boxProps) {
    this.parent = boxProps.parent;
    this.width = boxProps.width;
    this.height = boxProps.height;
    this.depth = boxProps.depth;
    this.padding = boxProps.padding;
    this.material = getMaterial(boxProps.matProps);
    this.geometry = this.CreateBoxGeometry(boxProps);
    this.parentSize = getGeometrySize(boxProps.parent.geometry);
    this.box = new THREE.Mesh(this.geometry, this.material);
    setGeometryPivot(this.box, boxProps);
    this.box.userData.width = this.width;
    this.box.userData.height = this.height;
    this.box.userData.depth = this.depth;
    this.box.userData.padding = this.padding;

    boxProps.parent.add(this.box);
  }
  CreateBoxGeometry(boxProps) {
    let result = undefined;
    if(boxProps.complexMesh){
      if(boxProps.isPortal){
        result = RoundedPlaneGeometry(boxProps.width, boxProps.height, boxProps.radius, boxProps.smoothness, boxProps.zOffset);
      }else{
        result = RoundedBoxGeometry(boxProps.width, boxProps.height, boxProps.depth, boxProps.radius, boxProps.smoothness, boxProps.zOffset);
      }
    }else{
      result = new THREE.BoxGeometry(boxProps.width, boxProps.height, boxProps.depth);
    }

    result.morphAttributes.position = [];

    return result
  }
  UpdateBoxGeometry(boxProps) {
    this.geometry.dispose();
    this.CreateBoxGeometry(boxProps);
    setGeometryPivot(this.box, boxProps);
  }
  UpdateMaterial(matProps){
    this.material.dispose();
    this.material = getMaterial(matProps);
    this.box.material = this.material;
  }
  CreateHeightExpandedMorph(sizeMult){
    if(this.box.geometry == undefined)
      return;

    this.material.morphTargets = true;
    const morphGeometry = this.box.geometry.clone();
    const expansionY = (this.height/2)*sizeMult;
    //move the top verts upward, and the bottom verts downward.
    morphGeometry.attributes.position.array.forEach((v, i) => {
      let x = morphGeometry.attributes.position.getX(i);
      let y = morphGeometry.attributes.position.getY(i);
      let z = morphGeometry.attributes.position.getZ(i);
      if(y>0){
        morphGeometry.attributes.position.setXYZ(i, x, y+expansionY, z);
      }else if(y<0){
        morphGeometry.attributes.position.setXYZ(i, x, y-expansionY, z);
      }
    });

    this.box.geometry.morphAttributes.position[ 0 ] = new THREE.Float32BufferAttribute( morphGeometry.attributes.position.array, 3 );
    this.box.updateMorphTargets();

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

export function CreateBasePanel(panelProps) {
  if(typeof panelProps.textProps.font === 'string'){
    // Load the font
    loader.load(panelProps.textProps.font, (font) => {
      panelProps.textProps.font = font;
      let panel = new BasePanel(panelProps);
      panels.push(panel);
      console.log(panel)
    });
  }else if(panelProps.textProps.font.isFont){
    let panel = new BasePanel(panelProps);
    panels.push(panel);
  } 
  
};


class BaseTextBox extends BaseBox {
  constructor(buttonProps) {
    super(buttonProps.boxProps);

    this.text = buttonProps.name;
    this.textProps = buttonProps.textProps;
    this.matProps = buttonProps.matProps;
    this.animProps = buttonProps.animProps;
    this.listConfig = buttonProps.listConfig;
    this.mouseOver = buttonProps.mouseOver;
    this.portal = buttonProps.portal;

    this.textMaterial = getMaterial(this.textProps.matProps, this.box.material.stencilRef);
    this.textMesh = this.CreateText();
    this.textMesh.userData.value = buttonProps.value;
    this.box.userData.value = buttonProps.value;
    this.box.userData.properties = buttonProps;
    adjustBoxScaleRatio(this.box, this.parent);

  }
  CreateTextGeometry(){
    let geometry = createMergedTextGeometry(this.textProps.font, this.width, this.height, this.text, this.textProps, this.animProps);
    geometry.center();

    return geometry
  }
  CreateText(){
    let geometry = this.CreateTextGeometry();
    const geomSize = getGeometrySize(geometry);
    const boxSize = getGeometrySize(this.box.geometry);
    let result = new THREE.Mesh(geometry, this.textMaterial);
    setMergedMeshUserData(boxSize, geomSize, this.textProps.padding, result);
    this.box.add(result);
    result.position.set(result.position.x, result.position.y, this.depth/2+geomSize.depth/2);

    return result
  }
  UpdateText(text){
    this.text = text;
    this.textMesh.geometry.dispose();
    this.textMesh.geometry = this.CreateTextGeometry();
  }
}

export function buttonProperties(boxProps, font, name='Button', value='', padding=0.01, textProps=undefined, matProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined, mouseOver=false, portal=false, attach='RIGHT'){
  return {
    'type': 'BUTTON',
    'boxProps': boxProps,
    'font': font,
    'name': name,
    'value': value,
    'padding': padding,
    'textProps': textProps,
    'matProps': matProps,
    'animProps': animProps,
    'listConfig': listConfig,
    'onCreated': onCreated,
    'mouseOver': mouseOver,
    'portal': portal,
    'attach': attach
  }
};

export class BasePanel extends BaseTextBox {
  constructor(panelProps) {
    super(buttonProperties(panelProps.boxProps, panelProps.textProps.font, panelProps.name, panelProps.value, panelProps.padding, panelProps.textProps, panelProps.matProps, panelProps.animProps, undefined, undefined, panelProps.mouseOver, panelProps.portal));
    this.box.userData.properties = panelProps;
    
    this.boxProps = panelProps.boxProps;
    this.name = panelProps.name;
    this.textProps = panelProps.textProps;
    this.matProps = panelProps.matProps;
    this.attach = panelProps.attach;
    this.sections = panelProps.sections;
    this.open = panelProps.open;
    this.isSubPanel = panelProps.isSubPanel;

    this.handleExpand = this.CreateHandle(panelProps);
    this.CreateTop();
    
    this.bottom = this.CreateBottom();
    this.box.add(this.handleExpand);
    this.box.userData.handleExpand = this.handleExpand;
    this.handleExpand.userData.targetElem = this.box;
    this.handleExpand.position.set(this.width/2, this.height/2 - this.handleExpand.userData.size.height*2, this.depth/2);

    if(panelProps.expanded){
      this.handleExpand.rotation.z = this.handleExpand.rotation.z+0.8;
    }

    this.handleOpen = undefined;
    this.SetUserData();
    if(panelProps.topPanel == undefined){
      panelProps.topPanel = this.box;
      this.handleOpen = this.CreateTopHandle();
    }

    if(panelProps.sections != undefined){
      this.CreateSections(panelProps);
    }

    this.handleExpand.addEventListener('action', function(event) {
      panelAnimation(this.userData.targetElem, 'EXPAND');
    });
  }
  CreateTopHandle() {
    const handle = this.CreateHandle();

    this.parent.add(handle);

    if(this.attach == 'CENTER'){
      handle.position.set(this.width/2, this.height/2, this.parentSize.depth+this.depth/2);
    }else if(this.attach == 'LEFT'){
      handle.position.set(-(this.parentSize.width/2), this.parentSize.height/2, this.parentSize.depth+this.depth/2);
    }else if(this.attach == 'RIGHT'){
      handle.position.set(this.parentSize.width/2, this.parentSize.height/2, -(this.parentSize.depth+this.depth/2));
    }

    if(!this.open){
      handle.rotation.z = handle.rotation.z;
    }else if(this.open){
      handle.rotation.z = handle.rotation.z+0.8;
    }

    this.box.userData.handleOpen = handle;
    handle.userData.targetElem = this.box;

    handle.addEventListener('action', function(event) {
      panelAnimation(this.userData.targetElem);
    });
  }
  CreateHandle() {
    let result = undefined;
    let material = getMaterial(this.matProps, this.matProps.stencilRef);
    let geometry = new THREE.OctahedronGeometry(this.height*0.2, 0);
    geometry.center();
    const size = getGeometrySize(geometry);
    result = new THREE.Mesh(geometry, material);
    result.userData.offRotation = new THREE.Vector3().copy(result.rotation);
    result.userData.onRotation = new THREE.Vector3(result.rotation.x, result.rotation.y, result.rotation.z+0.8)
    result.userData.size = size;
    mouseOverUserData(result);
    clickable.push(result);

    return result
  }
  CreateBottom(){
    let boxProps = {...this.boxProps};
    boxProps.height=boxProps.height*0.5;
    boxProps.parent = this.box;
    const result = new BaseBox(boxProps);
    let size = getGeometrySize(result.box.geometry);
    result.box.material = this.box.material;
    result.box.position.set(result.box.position.x, -(this.height/2+result.height/2), result.box.position.z);
    this.box.add(result.box);
    result.box.userData.expandedPos = new THREE.Vector3().set(result.box.position.x, -(this.height+result.height), result.box.position.z);
    result.box.userData.closedPos = new THREE.Vector3().copy(result.box.position);
    result.box.userData.size = size;

    return result
  }
  CreateTop(){
    if(this.attach == 'CENTER'){
      this.box.position.set(this.parentSize.width/2, this.parentSize.height/2, this.parentSize.depth);
    }else if(this.attach == 'LEFT'){
      this.boxProps.pivot = 'RIGHT';
      this.box.position.set(-(this.parentSize.width/2+this.width/2), this.parentSize.height/2-this.height/2, this.parentSize.depth);
    }else if(this.attach == 'RIGHT'){
      this.boxProps.pivot = 'LEFT';
      this.box.position.set(this.parentSize.width/2+this.width/2, this.parentSize.height/2-this.height/2, this.parentSize.depth);
    }

    if(!this.open){
      this.box.scale.set(0,0,0);
    }

    if(this.isSubPanel){
      this.box.position.copy(this.parent.position);
      darkenMaterial(this.box.material, 10);
      this.box.userData.onPos = new THREE.Vector3(this.box.position.x, -(this.parentSize.height/2-this.height/2), this.box.position.z);
      this.box.userData.offPos = new THREE.Vector3().copy(this.box.position);
    }

  }
  SetUserData(){
    this.box.userData.textMesh = this.textMesh;
    this.box.userData.bottom = this.bottom.box;
    this.box.userData.expandedPos = new THREE.Vector3().copy(this.box.position);
    this.box.userData.closedPos = new THREE.Vector3().copy(this.box.position);
    this.box.userData.onPos = new THREE.Vector3().copy(this.box.position);
    this.box.userData.offPos = new THREE.Vector3().copy(this.box.position);
    this.box.userData.onScale = new THREE.Vector3(0,0,0).copy(this.box.scale);
    this.box.userData.offScale = new THREE.Vector3(0,0,0);
    this.box.userData.sectionElements = [];
    this.box.userData.widgetElements = [];
    this.box.userData.size = getGeometrySize(this.box.geometry);
  }
  CreateSections(panelProps){
    let index = 1;
    for (const [name, sect] of Object.entries(panelProps.sections)) {
      let sectionProps = {...panelProps};
      sectionProps.name = name;
      sectionProps.isSubPanel = true;
      sectionProps.boxProps.parent = panelProps.topPanel;
      let parentSize = getGeometrySize(panelProps.topPanel.geometry);

      sectionProps.sections = sect;
      let section = new BasePanel(sectionProps);
      section.box.position.set(this.width/2-section.width/2, 0, -this.depth);

      let bottom = section.box.userData.bottom;
      let bottomHeight = this.bottom.height;
      let yPos =  bottomHeight - (this.height + bottomHeight)*index;
      section.box.userData.index = index;
      section.box.userData.expandedPos.set(section.box.position.x, yPos, section.box.position.z);
      section.box.userData.closedPos = new THREE.Vector3().copy(section.box.position);
      panelProps.topPanel.userData.sectionElements.push(section.box);
      
      index += 1;
    }
  }
};

export function widgetProperties(boxProps, name='', horizontal=true, on=false, textProps=undefined, useValueText=true, valueProps=stringValueProperties(), matProps=undefined, animProps=undefined, listConfig=undefined, handleSize=2 ){
  return {
    'type': 'WIDGET',
    'boxProps': boxProps,
    'name': name,
    'horizontal': horizontal,
    'on': on,
    'textProps': textProps,
    'useValueText': useValueText,
    'valueProps': valueProps,
    'matProps': matProps,
    'animProps': animProps,
    'listConfig': listConfig,
    'handleSize': handleSize
  }
};

export class BaseWidget extends BaseBox {
  constructor(widgetProps) {

    let size = calculateWidgetSize(widgetProps.boxProps, widgetProps.horizontal, widgetProps.useValueText, widgetProps.handleSize);
    let baseBoxProps = {...widgetProps.boxProps};
    baseBoxProps.width = size.baseWidth;
    baseBoxProps.height = size.baseHeight;
    baseBoxProps.depth = size.baseDepth/2;
    super(baseBoxProps);
    this.box.userData.horizontal = widgetProps.horizontal;
    this.box.userData.hasSubObject = widgetProps.useValueText;
    this.box.userData.properties = widgetProps;

    this.name = widgetProps.name;
    this.handleSize = 2;
    this.baseBoxProps = baseBoxProps;
    this.size = size;
    this.complexMesh = widgetProps.boxProps.complexMesh;

    darkenMaterial(this.box.material, 10);

    if(this.handleSize > 0){
      this.handleMaterial = getMaterial(widgetProps.boxProps.matProps, widgetProps.boxProps.parent.material.stencilRef);
      this.handle = this.WidgetHandle();
      this.handle.renderOrder = 2;

      this.box.add(this.handle);

      if(widgetProps.horizontal){
        this.handle.position.set(-(this.size.baseWidth/2-this.size.handleWidth/2), this.handle.position.y, this.handle.position.z+this.size.baseDepth);
      }else{
        this.handle.position.set(this.handle.position.x,-(this.size.baseHeight/2-this.size.handleHeight/2), this.handle.position.z+this.size.baseDepth);
      }
    }

    this.widgetText = this.WidgetText();

  }
  WidgetHandle(){
    let geometry = new THREE.BoxGeometry(this.size.handleWidth, this.size.handleHeight, this.size.handleDepth);
    let widgetProps = this.box.userData.properties;
    if(widgetProps.boxProps.complexMesh){
        geometry = RoundedBoxGeometry(this.size.handleWidth, this.size.handleHeight, this.size.handleDepth, widgetProps.boxProps.radius, widgetProps.boxProps.smoothness, widgetProps.boxProps.zOffset);
    }

    return new THREE.Mesh(geometry, this.handleMaterial);
  }
  WidgetText(){
    if(this.name.length>0){
      const props = this.box.userData.properties;
      const boxProps = props.boxProps;
      const textProps = props.textProps;

      let mat = getMaterial(textProps.matProps, boxProps.parent.material.stencilRef);
      const geometry = createTextGeometry(this.name, textProps.font, textProps.size, textProps.height, textProps.meshProps.curveSegments, textProps.meshProps.bevelEnabled, textProps.meshProps.bevelThickness, textProps.meshProps.bevelSize, textProps.meshProps.bevelOffset, textProps.meshProps.bevelSegments);
      geometry.center();
      const mergedMesh = new THREE.Mesh(geometry, mat);


      mergedMesh.position.set(0, boxProps.height/2+textProps.padding, 0);
      if(!props.horizontal){
        mergedMesh.position.set(0, boxProps.height/2+textProps.padding, 0);
      }
      boxProps.parent.add(mergedMesh);

      return mergedMesh
    }
  }
  ValueText(){
    const widgetProps = this.box.userData.properties;
    const boxProps = widgetProps.boxProps;
    const valBox = new ValueTextWidget(widgetProps);

    this.box.add(valBox.box);
    darkenMaterial(valBox.box.material, 30);
    this.box.userData.valueBox = valBox.box;

    if(widgetProps.horizontal){
      valBox.box.position.set(this.size.baseWidth/2+valBox.width/2, valBox.box.position.y, boxProps.parent.position.z);
    }else{
      valBox.box.position.set(valBox.box.position.x, -this.size.baseHeight+valBox.height, boxProps.parent.position.z);
    }
  }

};

export function numberValueProperties( defaultValue=0, min=0, max=1, places=3, step=0.001, editable=true){
  return {
    'type': 'NUMBER_VALUE_PROPS',
    'defaultValue': defaultValue,
    'min': min,
    'max': max,
    'places': places,
    'step': step,
    'editable': editable
  }
};

export function sliderProperties(boxProps, name='', horizontal=true, min=0, max=1, places=3, step=0.001, padding=0.01, textProps=undefined, useValueText=true, numeric=true, valueProps=numberValueProperties(), matProps=undefined, animProps=undefined, listConfig=undefined, handleSize=8){
  return {
    'type': 'SLIDER',
    'boxProps': boxProps,
    'name': name,
    'horizontal': horizontal,
    'min': min,
    'max': max,
    'places': places,
    'step': step,
    'padding': padding,
    'textProps': textProps,
    'useValueText': useValueText,
    'numeric': numeric,
    'valueProps': valueProps,
    'matProps': matProps,
    'animProps': animProps,
    'listConfig': listConfig,
    'handleSize': handleSize
  }
};

class ValueTextWidget extends BaseTextBox{
  constructor(widgetProps) {
    let valBoxProps = {...widgetProps.boxProps};
    valBoxProps.isPortal = true;
    let textProps = widgetProps.textProps;
    let valMatProps = materialProperties('BASIC', widgetProps.textProps.matProps.color, false, 1, THREE.FrontSide, 'STENCIL');
    let size = calculateWidgetSize(widgetProps.boxProps, widgetProps.horizontal, widgetProps.useValueText);
    let defaultVal = widgetProps.valueProps.defaultValue.toString();

    valBoxProps.matProps = valMatProps;

    if(widgetProps.horizontal){
      valBoxProps.height=widgetProps.boxProps.height;
      valBoxProps.width=size.subWidth;
    }else{
      valBoxProps.height=size.subHeight;
      valBoxProps.width=widgetProps.boxProps.width;
    }

    super(buttonProperties(valBoxProps, widgetProps.textProps.font, defaultVal, widgetProps.value, widgetProps.padding, textProps, valMatProps, widgetProps.animProps, undefined, undefined, false));
    this.numeric = widgetProps.numeric;
    if(this.numeric){
      this.min = widgetProps.min;
      this.max = widgetProps.max;
    }
    this.box.userData.targetElem = this;
    this.SetValueTextPosition();

    darkenMaterial(this.box.material, 30);

    if(widgetProps.valueProps.editable){
      this.EditableSetup();
    }

    this.box.addEventListener('update', function(event) {
      this.userData.targetElem.UpdateValue();
    });

  }
  SetValue(val){
    if(this.box.parent.userData.value == undefined)
      return;

    if(this.numeric){
      if(!this.NumericValueValid(val))
        return;
      this.box.parent.userData.value = val;

    }else{
      this.box.parent.userData.value = val;
    }
    this.UpdateValue();
    this.box.parent.dispatchEvent({type:'update'});
  }
  UpdateValue(){
    if(this.box.parent.userData.value == undefined)
      return;

    this.UpdateText(this.box.parent.userData.value);
    this.SetValueTextPosition();
  }
  SetValueTextPosition(){
    this.textMesh.position.set(this.textMesh.position.x, this.textMesh.position.y, -this.depth/2);
  }
  EditableSetup(){
    inputPrompts.push(this.textMesh);
    const textProps = this.box.userData.properties.textProps;
    const tProps = editTextProperties(this, '', this.textMesh, textProps.font, textProps.size, textProps.height, textProps.zOffset, textProps.letterSpacing, textProps.lineSpacing, textProps.wordSpacing, textProps.padding, false, textProps.meshProps);
    this.textMesh.userData.textProps = tProps;
    this.box.userData.mouseOverParent = true;
    this.box.userData.currentText = '';
    this.textMesh.userData.numeric = this.box.userData.properties.numeric;
    this.textMesh.widget = this;
    mouseOverable.push(this.box);
    mouseOverUserData(this.textMesh);
  }
  NumericValueValid(val){
    let result = true;
    if(val < this.min && val > this.max){
      result = false;
    }
    if(isNaN(val)){
      result = false;
    }

    return result
  }

}

export class SliderWidget extends BaseWidget {
  constructor(widgetProps) {

    super(widgetProps);
    
    if(this.box.userData.hasSubObject){
      this.ValueText(this, widgetProps.boxProps, widgetProps, this.size.baseWidth, this.size.baseHeight)
    }

    this.setSliderUserData();

    this.handle.addEventListener('action', function(event) {
      this.userData.targetElem.OnSliderMove();
    });

    this.box.addEventListener('update', function(event) {
      this.userData.targetElem.UpdateSliderPosition();
    });

  }
  setSliderUserData(){
    let sliderProps = this.box.userData.properties;
    let size = calculateWidgetSize(sliderProps.boxProps, sliderProps.horizontal, sliderProps.useValueText, 8);

    this.box.userData.type = 'SLIDER';
    this.box.userData.size = {'width': size.baseWidth, 'height': size.baseHeight, 'depth': size.baseDepth};
    this.box.userData.handle = this.handle;
    this.box.userData.horizontal = sliderProps.horizontal;
    this.box.userData.valueProps = sliderProps.valueProps;
    this.box.userData.value = sliderProps.valueProps.defaultValue;
    this.box.userData.targetElem = this;

    this.handle.userData.type = 'SLIDER';
    this.handle.userData.size = {'width': size.handleWidth, 'height': size.handleHeight, 'depth': size.handleDepth};
    this.handle.userData.horizontal = sliderProps.horizontal;
    this.handle.userData.min = sliderProps.valueProps.min;
    this.handle.userData.max = sliderProps.valueProps.max;
    this.handle.userData.places = sliderProps.valueProps.places;

    if(sliderProps.horizontal){
      this.handle.userData.maxScroll = this.handle.position.x + (size.baseWidth-size.handleWidth);
      this.handle.userData.minScroll = -size.baseWidth+(this.handle.userData.maxScroll+size.handleWidth);
    }else{
      this.handle.userData.maxScroll = this.handle.position.y + (size.baseHeight-size.handleHeight);
      this.handle.userData.minScroll = -size.baseHeight+(this.handle.userData.maxScroll+size.handleHeight);
    }

    this.handle.userData.padding = sliderProps.padding;
    this.handle.userData.draggable = true;
    this.handle.userData.targetElem = this;
  }
  SliderValue(){
    let coord = 'x';
    let valBoxSize = this.box.userData.valueBox.userData.size;
    let divider = (this.box.userData.size.width-this.handle.userData.padding-this.handle.userData.size.width);

    if(!this.handle.userData.horizontal){
      coord = 'y';
      divider = (this.box.userData.size.height+this.handle.userData.padding-this.handle.userData.size.height);
    }

    let pos = this.handle.position[coord];
    let minScroll = this.handle.userData.minScroll;
    let max = this.handle.userData.max;
    let min = this.handle.userData.min;

    let value = (pos-minScroll)/divider*max;

    if(this.handle.userData.min<0){
      value = ((pos-minScroll)/divider*(max-min))+min;
    }

    return value.toFixed(this.handle.userData.places);
  }
  OnSliderMove(){

    this.box.userData.value = this.SliderValue();

    if(this.box.userData.valueBox != undefined){
      this.box.userData.valueBox.currentText = this.box.userData.value;
    }

    if(this.box.userData.valueBox != undefined){
      this.box.userData.valueBox.dispatchEvent({type:'update'});
    }

  }
  UpdateSliderPosition(){
    let minScroll = this.handle.userData.minScroll;
    let maxScroll = this.handle.userData.maxScroll;
    let max = this.handle.userData.max;
    let min = this.handle.userData.min;
    let value = this.box.userData.value;
    if(value>max){
      this.box.userData.value = max;
      value = max;
    }else if(value<min){
      this.box.userData.value = min;
      value = min;
    }
    if(isNaN(value))
      return;

    let coord = 'x';
    let divider = (this.box.userData.size.width-this.handle.userData.padding-this.handle.userData.size.width);

    if(!this.handle.userData.horizontal){
      coord = 'y';
      divider = (this.box.userData.size.height+this.handle.userData.padding-this.handle.userData.size.height);
    }

    let vec = ((value-min)/(max-min))*divider+minScroll;
    let pos = new THREE.Vector3(this.handle.position.x, vec, this.handle.position.z);

    if(this.box.userData.horizontal){
      pos.set(vec, this.handle.position.y, this.handle.position.z);
    }

    this.handle.position.copy(pos);
  }

};

export function stringValueProperties(defaultValue='Off', onValue='On', offValue='Off', editable=false){
  return {
    'type': 'STRING_VALUE_PROPS',
    'defaultValue': defaultValue,
    'onValue': onValue,
    'offValue': offValue,
    'editable': editable
  }
};

export function toggleProperties(boxProps, name='', horizontal=true, on=false, textProps=undefined, useValueText=true, valueProps=stringValueProperties(), matProps=undefined, animProps=undefined, listConfig=undefined, handleSize=2 ){
  return {
    'type': 'TOGGLE',
    'boxProps': boxProps,
    'name': name,
    'horizontal': horizontal,
    'on': on,
    'textProps': textProps,
    'useValueText': useValueText,
    'valueProps': valueProps,
    'matProps': matProps,
    'animProps': animProps,
    'listConfig': listConfig,
    'handleSize': handleSize
  }
};

export class ToggleWidget extends BaseWidget {
  constructor(widgetProps) {

    super(widgetProps);
    
    if(this.box.userData.hasSubObject){
      this.ValueText(this, widgetProps.boxProps, widgetProps, this.size.baseWidth, this.size.baseHeight)
    }

    this.setToggleUserData();

    if(widgetProps.horizontal){
      this.handle.userData.onPos = new THREE.Vector3(this.handle.position.x+this.size.baseWidth/2, this.handle.position.y, this.handle.position.z+this.size.baseDepth);
    }else{
      this.handle.userData.onPos = new THREE.Vector3(this.handle.position.x, this.handle.position.y+(this.size.baseHeight/2), this.handle.position.z+this.size.baseDepth);
    }

    if(widgetProps.valueProps.defaultValue == widgetProps.valueProps.onValue){
      this.handle.position.copy(this.handle.userData.onPos);
      this.handle.userData.on = true;
    }

    if(this.box.userData.valueBox != undefined){
      this.box.userData.valueBox.dispatchEvent({type:'update'});
    }

    this.handle.addEventListener('action', function(event) {
      toggleAnimation(this.userData.targetElem);
    });

  }
  setToggleUserData(){
    let toggleProps = this.box.userData.properties;
    let size = calculateWidgetSize(toggleProps.boxProps, toggleProps.horizontal, toggleProps.useValueText, 2);

    this.box.userData.type = 'TOGGLE';
    this.box.userData.size = {'width': toggleProps.boxProps.width, 'height': toggleProps.boxProps.height, 'depth': size.baseDepth};
    this.box.userData.handle = this.handle;
    this.box.userData.horizontal = toggleProps.horizontal;
    this.box.userData.valueProps = toggleProps.valueProps;
    this.box.userData.value = toggleProps.valueProps.defaultValue;

    this.handle.userData.type = 'TOGGLE';
    this.handle.userData.size = {'width': this.size.handleWidth, 'height': this.size.handleHeight, 'depth': this.size.handleDepth};
    this.handle.userData.offPos = new THREE.Vector3().copy(this.handle.position);
    this.handle.userData.horizontal = toggleProps.horizontal;
    this.handle.userData.anim = false;
    this.handle.userData.on = false;
    this.handle.userData.targetElem = this;

  }
  handleToggleValueText(toggle){
    if(toggle.box.userData.valueBox != undefined){

      if(toggle.box.userData.value == toggle.base.userData.valueProps.onValue){
        toggle.box.userData.value = toggle.base.userData.valueProps.offValue;
      }else{
        toggle.box.userData.value = toggle.base.userData.valueProps.onValue;
      }

      toggle.box.userData.valueBox.dispatchEvent({type:'update'});
    }
  }
  static DoToggle(toggle){
    toggle.handle.userData.on=!toggle.handle.userData.on;
    if(toggle.box.userData.valueBox != undefined){

      if(toggle.box.userData.value == toggle.box.userData.valueProps.onValue){
        toggle.box.userData.value = toggle.box.userData.valueProps.offValue;
      }else{
        toggle.box.userData.value = toggle.box.userData.valueProps.onValue;
      }

      toggle.box.userData.valueBox.dispatchEvent({type:'update'});
    }
  }
};

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

export class TextBoxWidget extends BaseWidget {
  constructor(textBoxProps) {
    const textProps = textBoxProps.textProps;
    let widgetProps = widgetProperties(textBoxProps.boxProps, "", true, true, textProps, false, undefined, textBoxProps.boxProps.matProps, textBoxProps.animProps, textBoxProps.listConfig, 0);
    super(widgetProps);
    this.textMeshMaterial = getMaterial(textProps.matProps);
    this.textMesh = undefined;
    if(textBoxProps.MultiLetterMeshes){
      this.textMesh = constructMultiTextMerged(this, textBoxProps.text, textProps.font, this.textMeshMaterial, textProps, textBoxProps.animProps);
    }else{
      let textGeometry = createMergedTextBoxGeometry(this, textProps.font, this.width, this.height, textBoxProps.text, textProps, textBoxProps.animProps);
      // Create a mesh from the merged geometry
      this.textMesh = new THREE.Mesh(textGeometry, this.textMeshMaterial);
      if(textBoxProps.animProps!=undefined){
        this.textMesh.material.transparent=true;
        this.textMesh.material.opacity=0;
      }
      const boxSize = getGeometrySize(this.box.geometry);
      const geomSize = getGeometrySize(this.textMesh.geometry);
      if(textBoxProps.boxProps.name==''){
        textBoxProps.boxProps.name='text-'+this.box.id;
      }
      this.box.name = textBoxProps.boxProps.name;

      setMergedMeshUserData(boxSize, geomSize, textProps.padding, this.textMesh);
      this.textMesh.userData.draggable=textBoxProps.textProps.draggable;
      this.textMesh.userData.horizontal=false;
    }
    
    this.box.add(this.textMesh);

    if(textBoxProps.listConfig != undefined){
      this.box.name = textBoxProps.boxProps.name;
      let listConfig = textBoxProps.listConfig;
      createListItem(listConfig.boxProps, this.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
    }else{
      textBoxProps.boxProps.parent.add(this.box);
    }
    if(textProps.draggable){
      draggable.push(this.textMesh);
    }
    if(textBoxProps.animProps!=undefined){
      //anim, action, duration, ease, delay, onComplete
      multiAnimation(this.box, this.textMesh.children, textBoxProps.animProps.anim, textBoxProps.animProps.action, textBoxProps.animProps.duration, textBoxProps.animProps.ease, textBoxProps.animProps.delay, textBoxProps.animProps.callback);
    }
    if(textBoxProps.onCreated!=undefined){
      textBoxProps.onCreated(this.box);
    }
    if(textBoxProps.isPortal){
      setupStencilMaterial(this.box.material, this.box.material.stencilRef);
      setupStencilChildMaterial(this.textMeshMaterial, this.box.material.stencilRef);
    }

  }
  static SetupPortalProps(textBoxProps){
    textBoxProps.isPortal = true;
    textBoxProps.boxProps.isPortal = true;
    textBoxProps.matProps.useCase = 'STENCIL';
    textBoxProps.boxProps.matProps.useCase = 'STENCIL';
    textBoxProps.textProps.matProps.useCase = 'STENCIL_CHILD';

    return textBoxProps
  }

};


export function createStaticTextBox(textBoxProps) {
  textBoxProps.MultiLetterMeshes = false;
  if(typeof textBoxProps.textProps.font === 'string'){
    // Load the font
    loader.load(textBoxProps.textProps.font, (font) => {
      textBoxProps.textProps.font = font;
      new TextBoxWidget(textBoxProps);
    });
  }else if(textBoxProps.textProps.font.isFont){
    new TextBoxWidget(textBoxProps);
  }  
};


export function createStaticTextPortal(textBoxProps) {
  textBoxProps = TextBoxWidget.SetupPortalProps(textBoxProps);
  createStaticTextBox(textBoxProps);
}


export function createStaticScrollableTextBox(textBoxProps) {
  textBoxProps.textProps.draggable = true;
  createStaticTextBox(textBoxProps); 
}

export function createStaticScrollableTextPortal(textBoxProps) {
  textBoxProps.textProps.draggable = true;
  createStaticTextPortal(textBoxProps);
}

export function createMultiTextBox(textBoxProps) {
  textBoxProps.MultiLetterMeshes = true;
  if(typeof textBoxProps.textProps.font === 'string'){
    // Load the font
    loader.load(textBoxProps.textProps.font, (font) => {
      textBoxProps.textProps.font = font;
      new TextBoxWidget(textBoxProps);
    });
  }else if(textBoxProps.textProps.font.isFont){
    new TextBoxWidget(textBoxProps);
  }
};


export function createMultiTextPortal(textBoxProps) {
  textBoxProps = TextBoxWidget.SetupPortalProps(textBoxProps);
  createMultiTextBox(textBoxProps);
};
//TODO; Fix scrolling
export function createMultiScrollableTextBox(textBoxProps) {
  textBoxProps.textProps.draggable = true;
  createMultiTextBox(textBoxProps);
};
//TODO; Fix scrolling
export function createMultiScrollableTextPortal(textBoxProps) {
  textBoxProps = TextBoxWidget.SetupPortalProps(textBoxProps);
  createMultiScrollableTextBox(textBoxProps);
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
    'type': 'EDIT_TEXT_PROPS',
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

export class InputTextWidget extends BaseWidget {
  constructor(textInputProps) {
    const props = InputTextWidget.CalculateBoxProps(textInputProps);
    const inputBoxProps = props.inputBoxProps;
    const btnBoxProps = props.btnBoxProps;
    textInputProps.buttonProps.boxProps = btnBoxProps;
    const textProps = textInputProps.textProps;
    let widgetProps = widgetProperties(inputBoxProps, textInputProps.name, true, true, textProps, false, undefined, textInputProps.boxProps.matProps, textInputProps.animProps, textInputProps.listConfig, 0)
    super(widgetProps);
    const inputGeometry = createMergedTextBoxGeometry(this, textProps.font, this.width, this.height, 'Enter Text', textProps, textInputProps.animProps);
    const boxSize = getGeometrySize(this.box.geometry);
    const geomSize = getGeometrySize(inputGeometry);
    this.inputTextMaterial = getMaterial(textProps.matProps, 0);
    this.inputText = new THREE.Mesh(inputGeometry, this.inputTextMaterial);
    setMergedMeshUserData(boxSize, geomSize, textProps.padding, this.inputText);
    this.box.add(this.inputText);
    this.inputText.position.set(this.inputText.position.x, this.inputText.position.y-this.height/2-geomSize.height/2, boxSize.depth/2+geomSize.depth/2);
    this.box.userData.properties = textInputProps;
    this.inputBoxProps = inputBoxProps;
    this.btnBoxProps = btnBoxProps;

    mouseOverable.push(this.inputText);

    if(textInputProps.buttonProps != undefined){
      this.button = this.AttachButton();
    }

    this.HandleTextInputSetup();

    console.log(this.box)
    
  }
  HandleTextInputSetup(){
    inputPrompts.push(this.inputText);
    let textProps = this.box.userData.properties.textProps;
    let draggable = this.box.userData.properties.draggable;
    const editProps = editTextProperties(this, '', this.inputText, textProps.font, textProps.size, textProps.height, textProps.zOffset, textProps.letterSpacing, textProps.lineSpacing, textProps.wordSpacing, textProps.padding, draggable, textProps.meshProps);
    this.inputText.userData.textProps = editProps;
    this.box.userData.mouseOverParent = true;
    this.box.userData.currentText = '';
    mouseOverable.push(this.box);
    mouseOverUserData(this.inputText);
    if(this.box.userData.properties.isPortal){
      setupStencilMaterial(this.box.material, this.box.material.stencilRef);
      setupStencilChildMaterial(this.inputText.material, this.box.material.stencilRef);
    }
  }
  AttachButton(){
    let btn = undefined;
    if(!this.box.userData.properties.isPortal){
      btn = ButtonElement(this.box.userData.properties.buttonProps);
    }else{
      btn = PortalButtonElement(this.box.userData.properties.buttonProps);
    }

    if(this.box.userData.properties.buttonProps.attach == 'RIGHT'){
      btn.box.position.set(this.width/2+btn.width/2, btn.box.position.y, -this.depth/2+btn.depth/2);
    }else if(widgetProps.buttonProps.attach == 'BOTTOM'){
      btn.box.position.set(btn.box.position.x, -(this.height/2+btn.height/2), -this.height/2+btn.depth/2);
    }

    return btn
  }
  static CalculateBoxProps(inputTextProps){
    let inputBoxProps = {...inputTextProps.boxProps};
    let btnBoxProps = {...inputTextProps.boxProps};
    let hasButton = (inputTextProps.buttonProps != undefined);
    let horizontal = true;
    if(hasButton && inputTextProps.buttonProps.attach == 'BOTTOM'){
      horizontal = false;
    }
    let size = calculateWidgetSize(inputTextProps.boxProps, horizontal, hasButton, 2);

    inputBoxProps.width = size.baseWidth;
    inputBoxProps.height = size.baseHeight;
    inputBoxProps.depth = size.baseDepth;

    btnBoxProps.width = size.subWidth;
    btnBoxProps.height = size.subHeight;
    btnBoxProps.depth = size.subDepth;
    btnBoxProps.matProps = inputTextProps.matProps;

    return { inputBoxProps, btnBoxProps }
  }
  static SetupPortalProps(textInputProps){
    textInputProps.isPortal = true;
    textInputProps.boxProps.isPortal = true;
    textInputProps.matProps.useCase = 'STENCIL';
    textInputProps.textProps.matProps.useCase = 'STENCIL_CHILD';
    if(textInputProps.buttonProps!=undefined){
      textInputProps.buttonProps.isPortal = true;
      textInputProps.buttonProps.boxProps.isPortal = true;
      textInputProps.buttonProps.matProps.useCase = 'STENCIL';
      textInputProps.buttonProps.textProps.matProps.useCase = 'STENCIL_CHILD';
    }

    return textInputProps
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
  textMesh.position.set(textMesh.position.x, textMesh.position.y-textProps.padding, textMesh.position.z);
  boxProps.parent.add(Box.box);
  Box.box.position.set(Box.box.position.x, Box.box.position.y, parentSize.depth/2+boxSize.depth/2);
  adjustBoxScaleRatio(Box.box, boxProps.parent);

  return {textMesh, Box}
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

export function textInputProperties(boxProps=defaultTextInputBoxProps(), name='', padding=0.01, textProps=undefined, matProps=undefined, buttonProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined, isPortal=false, draggable=false){
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
    'isPortal': isPortal,
    'draggable': draggable
  }
};

export function createTextInput(textInputProps) {
  if(typeof textInputProps.textProps.font === 'string'){
    // Load the font
    loader.load(textInputProps.textProps.font, (font) => {
      textInputProps.textProps.font = font;
      new InputTextWidget(textInputProps);
    });
  }else if(textInputProps.textProps.font.isFont){
    new InputTextWidget(textInputProps);
  }
};

//TODO: Need to fix Scrolling!!
export function createScrollableTextInput(textInputProps) {
  textInputProps.draggable = true;
  createTextInput(textInputProps);
};

export function createTextInputPortal(textInputProps) {
  textInputProps = InputTextWidget.SetupPortalProps(textInputProps);
  createTextInput(textInputProps);
};

//TODO: Scrolling is broken, needs to be fixed
export function createScrollableTextInputPortal(textInputProps) {
  textInputProps = InputTextWidget.SetupPortalProps(textInputProps);
  textInputProps.draggable = true;
  createTextInput(textInputProps);
};

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


export class SelectorWidget extends BaseWidget {
  constructor(listSelectorProps) {
    const isPortal = listSelectorProps.isPortal;
    const textProps = listSelectorProps.textProps;
    const matProps = listSelectorProps.matProps;
    let btnBoxProps = {...listSelectorProps.boxProps};
    let btnMatProps = {...listSelectorProps.matProps};
    let btnTextProps = {...listSelectorProps.textProps};
    btnBoxProps.matProps = btnMatProps;
    if(isPortal){
      btnBoxProps.isPortal = isPortal;
      btnBoxProps.matProps.useCase = 'STENCIL';
      btnTextProps.matProps.useCase = 'STENCIL_CHILD';
      btnMatProps.useCase = 'STENCIL';
      listSelectorProps.boxProps.matProps.useCase = 'STENCIL_CHILD';
      listSelectorProps.matProps.useCase = 'STENCIL_CHILD';
      listSelectorProps.textProps.matProps.useCase = 'STENCIL_CHILD';
    }
    let widgetProps = widgetProperties(btnBoxProps, listSelectorProps.name, true, true, btnTextProps, false, undefined, btnMatProps, listSelectorProps.animProps, listSelectorProps.listConfig, 0)
    super(widgetProps);
    this.isPortal = isPortal;
    this.box.userData.properties = listSelectorProps;
    this.box.userData.selectors = [];
    this.btnBoxProps = btnBoxProps;
    this.btnMatProps = btnMatProps;
    this.btnTextProps = btnTextProps;
    this.boxProps = btnBoxProps;
    this.selectors = {};

  }
  SetSelectors(selectors){
    this.selectors = selectors;
    this.CreateSelectors();
  }
  CreateSelectors(){
    let idx = 0;
    for (const [key, val] of Object.entries(this.selectors)) {
      let props = this.box.userData.properties;
      let btnProps = buttonProperties(this.btnBoxProps, props.textProps.font, key, val, props.padding, props.textProps, props.matProps, props.animProps, undefined, undefined, props.isPortal);
      let btn = new BaseTextBox(btnProps);
      btn.box.userData.properties = props;

      const editProps = editTextProperties(btn, '', this.btnTextProps.textMesh, this.btnTextProps.font, this.btnTextProps.size, this.btnTextProps.height, this.btnTextProps.zOffset, this.btnTextProps.letterSpacing, this.btnTextProps.lineSpacing, this.btnTextProps.wordSpacing, this.btnTextProps.padding, true, this.btnTextProps.meshProps);
      btn.textMesh.userData.textProps = editProps;
      inputPrompts.push(btn.textMesh);
      mouseOverable.push(btn.textMesh);
      clickable.push(btn.textMesh);
      btn.box.name = key;
      
      this.SetUserData(btn, key, val, idx);
      mouseOverUserData(btn.textMesh);

      this.box.userData.selectors.push(btn.box);
      selectorElems.push(btn.box);
      this.box.add(btn.box);
        
      btn.textMesh.addEventListener('action', function(event) {
        SelectorWidget.TextSelected(btn.textMesh)
      });

      if(idx==0){
        btn.textMesh.userData.selected = true;
        btn.box.position.copy(btn.box.userData.selectedPos);

      }else{
        btn.box.position.copy(btn.box.userData.unselectedPos);
        btn.box.scale.set(btn.box.unselectedScale, btn.box.unselectedScale, btn.box.unselectedScale);
      }

      if(this.isPortal){
        setupStencilChildMaterial(btn.box.material, this.box.material.stencilRef);
        setupStencilChildMaterial(btn.textMesh.material, this.box.material.stencilRef);
        btn.box.material.stencilRef = this.box.material.stencilRef;
        btn.box.material.depthWrite = true;
        btn.textMesh.material.stencilRef = this.box.material.stencilRef;
        btn.textMesh.material.depthWrite = true;
        btn.box.renderOrder = 2;
        btn.textMesh.renderOrder = 2;
        btn.box.position.set(btn.box.position.x, btn.box.position.y, -btn.depth)
      }

      idx+=1;
    }
    if(this.isPortal){
      this.CreateHeightExpandedMorph(Object.keys(this.selectors).length);
    }

  }
  SetUserData(btn, key, value, index){
    const textSize = getGeometrySize(btn.textMesh.geometry);
    let selectedZ = btn.depth+(btn.depth+textSize.depth);
    let unselectedZ = btn.depth;
    if(btn.box.userData.properties.isPortal){
      selectedZ = -btn.depth;
      unselectedZ = -(btn.depth+(btn.depth+textSize.depth));
    }
    btn.textMesh.userData.draggable = false;
    btn.textMesh.userData.key = key;
    btn.textMesh.userData.value = value;
    btn.textMesh.userData.index = index;
    btn.textMesh.userData.selected = false;
    btn.box.userData.selectedScale = 1;
    btn.box.userData.unselectedScale = 0.9;
    btn.box.userData.selectedPos = new THREE.Vector3(btn.box.position.x, btn.box.position.y, selectedZ);
    btn.box.userData.unselectedPos = new THREE.Vector3(btn.box.position.x, btn.box.position.y, unselectedZ);
    btn.box.userData.mouseOverParent = true;
    btn.box.userData.currentText = key;
  }
  static TextSelected(selection){
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
};

export function createListSelector(listSelectorProps, selectors) {

  if(typeof listSelectorProps.textProps.font === 'string'){
    // Load the font
    loader.load(listSelectorProps.textProps.font, (font) => {
      listSelectorProps.textProps.font = font;
      let widget = new SelectorWidget(listSelectorProps);
      widget.SetSelectors(selectors);
    });
  }else if(listSelectorProps.textProps.font.isFont){
    let widget = new SelectorWidget(listSelectorProps);
      widget.SetSelectors(selectors);
  }

};

export function createListSelectorPortal(listSelectorProps, selectors) {
  listSelectorProps.isPortal = true;
  createListSelector(listSelectorProps, selectors);
};


function ButtonElement(buttonProps){
  let btn = new BaseTextBox(buttonProps);
  let textProps = buttonProps.textProps;
  const tProps = editTextProperties(btn, '', btn.textMesh, textProps.font, textProps.size, textProps.height, textProps.zOffset, textProps.letterSpacing, textProps.lineSpacing, textProps.wordSpacing, textProps.padding, true, textProps.meshProps);
  btn.box.userData.textProps = tProps;
  btn.box.userData.draggable = false;
  btn.textMesh.userData.mouseOverParent = true;

  mouseOverUserData(btn.box);
  clickable.push(btn.box);
  if(mouseOver){
    mouseOverable.push(btn.box);
  }

  btn.box.userData.properties = buttonProps;

  return btn
}

function PortalButtonElement(buttonProps){
  const portal = new BaseBox(buttonProps.boxProps);
  const stencilRef = portal.box.material.stencilRef;
  setupStencilMaterial(portal.box.material, stencilRef);
  let btn = ButtonElement(buttonProps);
  const textSize = getGeometrySize(btn.textMesh.geometry);

  btn.box.material.opacity = 0;
  btn.box.material.transparent = true;
  setupStencilChildMaterial(btn.box.material, stencilRef);
  setupStencilChildMaterial(btn.textMesh.material, stencilRef);
  portal.box.add(btn.box);
  btn.box.position.set(btn.box.position.x, btn.box.position.y, -btn.depth/2);
  btn.textMesh.position.set(btn.textMesh.position.x, btn.textMesh.position.y, -textSize.depth/2);
  buttonProps.boxProps.parent.add(portal.box);
  portal.box.userData.properties = buttonProps;

  return portal
}

function Button(buttonProps) {
  if(typeof buttonProps.textProps.font === 'string'){
    // Load the font
    loader.load(buttonProps.textProps.font, (font) => {
      buttonProps.textProps.font = font;
      ButtonElement(buttonProps);
    });
  }else if(buttonProps.textProps.font.isFont){
    ButtonElement(buttonProps);
  }
}

function portalButton(buttonProps) {
  if(typeof buttonProps.textProps.font === 'string'){
    // Load the font
    loader.load(buttonProps.textProps.font, (font) => {
      buttonProps.textProps.font = font;
      PortalButtonElement(buttonProps);
    });
  }else if(buttonProps.textProps.font.isFont){
    PortalButtonElement(buttonProps);
  }
}

export function createButton(buttonProps){
  Button(buttonProps);
};

export function createPortalButton(buttonProps){
  buttonProps.isPortal = true;
  buttonProps.boxProps.isPortal = true;
  portalButton(buttonProps);
};

export function createMouseOverButton(buttonProps){
  buttonProps.mouseOver = true;
  Button(buttonProps);
};

export function createMouseOverPortalButton(buttonProps){
  buttonProps.mouseOver = true;
  createPortalButton(buttonProps);
};

function SliderBox(sliderProps) {
  const parentSize = getGeometrySize(sliderProps.boxProps.parent.geometry);
  let slider = new SliderWidget(sliderProps);
  let size = calculateWidgetSize(sliderProps.boxProps, sliderProps.horizontal, sliderProps.useValueText, 8);
    
  sliderProps.boxProps.parent.add(slider.box);
  slider.box.position.set(slider.box.position.x, slider.box.position.y, slider.box.position.z+parentSize.depth/2);
  draggable.push(slider.handle);

  if(sliderProps.useValueText){
    if(sliderProps.horizontal){
      slider.box.position.set(slider.box.position.x-size.subWidth/2, slider.box.position.y, slider.box.position.z);
    }else{
      slider.box.position.set(slider.box.position.x, slider.box.position.y+size.subHeight/2, slider.box.position.z);
    }
  }
}

export function createSliderBox(sliderProps) {
  if(typeof sliderProps.textProps.font === 'string'){
    // Load the font
    loader.load(sliderProps.textProps.font, (font) => {
      sliderProps.textProps.font = font;
      SliderBox(sliderProps);

    });
  }else if(sliderProps.textProps.font.isFont){
    SliderBox(sliderProps);
  }
};

function ToggleBox(toggleProps){
  const parentSize = getGeometrySize(toggleProps.boxProps.parent.geometry);
  let toggle = new ToggleWidget(toggleProps);
  toggleProps.boxProps.parent.add(toggle.box);
  toggle.box.position.set(toggle.box.position.x, toggle.box.position.y, toggle.box.position.z+parentSize.depth/2);
  toggles.push(toggle.handle);
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
  let toggle = new ToggleWidget(toggleProps);
  setupStencilMaterial(toggle.box.material, stencilRef);
  setupStencilChildMaterial(toggle.handle.material, stencilRef);
  toggle.box.material.depthWrite = false;
  toggle.handle.material.depthWrite = false;
  toggleProps.boxProps.parent.add(toggle.box);
  toggle.box.position.set(toggle.box.position.x, toggle.box.position.y, toggle.box.position.z+parentSize.depth/2);
  toggles.push(toggle.handle);

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

export function imageProperties(boxProps, name='', imgUrl=undefined, padding=0.01, matProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined, isPortal=false, zOffset=0){
  return {
    'type': 'IMAGE',
    'boxProps': boxProps,
    'name': name,
    'imgUrl': imgUrl,
    'padding': padding,
    'matProps': matProps,
    'animProps': animProps,
    'listConfig': listConfig,
    'onCreated': onCreated,
    'isPortal': isPortal,
    'zOffset': zOffset
  }
};

export function createImageBox(imageProps){

  const cBox = contentWindow(imageProps.boxProps);
  const boxSize = getGeometrySize(cBox.box.geometry);
  const map = new THREE.TextureLoader().load( imageProps.imgUrl );
  const material = new THREE.MeshBasicMaterial( { color: 'white', map: map } );
  cBox.box.material = material;
  let listConfig = imageProps.listConfig;

  if(listConfig != undefined){
    cBox.box.name = imageProps.boxProps.name;
    createListItem(listConfig.boxProps, cBox.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
  }else{
    imageProps.boxProps.parent.add(cBox.box);
  }

};

export function createImagePortal(imageProps){

  const portal = portalWindow(imageProps.boxProps);
  const cBox = contentWindow(imageProps.boxProps);
  const boxSize = getGeometrySize(cBox.box.geometry);
  const map = new THREE.TextureLoader().load( imageProps.imgUrl );
  const material = new THREE.MeshBasicMaterial( { color: 'white', map: map } );
  cBox.box.material = material;
  cBox.box.material.stencilWrite = true;
  cBox.box.material.stencilRef = portal.stencilRef;
  cBox.box.material.stencilFunc = THREE.EqualStencilFunc;
  cBox.box.renderOrder = 2;
  let listConfig = imageProps.listConfig;

  portal.box.add(cBox.box);
  cBox.box.position.set(cBox.box.position.x, cBox.box.position.y, cBox.box.position.z+imageProps.zOffset);

  if(listConfig != undefined){
    portal.box.name = imageProps.boxProps.name;
    createListItem(listConfig.boxProps, portal.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
  }else{
    imageProps.boxProps.parent.add(portal.box);
  }

};

export function gltfProperties(boxProps, name='', gltf=undefined, padding=0.01, matProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined, isPortal=false, zOffset=0){
  return {
    'type': 'GLTF',
    'boxProps': boxProps,
    'name': name,
    'gltf': gltf,
    'padding': padding,
    'matProps': matProps,
    'animProps': animProps,
    'listConfig': listConfig,
    'onCreated': onCreated,
    'isPortal': isPortal,
    'zOffset': zOffset
  }
};

function GLTFModel(gltfProps){
  const cBox = contentBox(gltfProps.boxProps);
  const boxSize = getGeometrySize(cBox.box.geometry);
  let gltf = gltfProps.gltf;

  const box = new THREE.Box3().setFromObject( gltf.scene ); 
  const sceneSize = box.getSize(new THREE.Vector3());
  let listConfig = gltfProps.listConfig;

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
    cBox.box.name = gltfProps.boxProps.name;
    createListItem(listConfig.boxProps, cBox.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
  }else{
    gltfProps.boxProps.parent.add(cBox.box);
  }
}

export function createGLTFModel(gltfProps){
  
  if(typeof gltfProps.gltf === 'string'){
    // Instantiate a loader
    gltfLoader.load( gltfProps.gltf,function ( gltf ) {
        gltfProps.gltf = gltf;
        GLTFModel(gltfProps);
      },
      // called while loading is progressing
      function ( xhr ) {
        console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      // called when loading has errors
      function ( error ) {
        console.log( error );
      }
    );
  }else if(gltfProps.gltf.scene != undefined){
    GLTFModel(gltfProps);
  }

};

function GLTFModelPortal(gltfProps){
  const portal = portalWindow(gltfProps.boxProps);
  const boxSize = getGeometrySize(portal.box.geometry);
  const parentSize = getGeometrySize(gltfProps.boxProps.parent.geometry);
  let gltf = gltfProps.gltf;

  const box = new THREE.Box3().setFromObject( gltf.scene ); 
  const sceneSize = box.getSize(new THREE.Vector3());
  let listConfig = gltfProps.listConfig;

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
    portal.box.name = gltfProps.boxProps.name;
    createListItem(listConfig.boxProps, portal.box, listConfig.textProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.childInset, listConfig.index);
  }else{
    gltfProps.boxProps.parent.add(portal.box);
    portal.box.position.set(portal.box.position.x, portal.box.position.y, portal.box.position.z+(parentSize.depth/2))
  }
}


export function createGLTFModelPortal(gltfProps){
  if(typeof gltfProps.gltf === 'string'){
    // Instantiate a loader
    gltfLoader.load( gltfProps.gltf,function ( gltf ) {
        console.log(gltf)
        gltfProps.gltf = gltf;
        GLTFModelPortal(gltfProps);
      },
      // called while loading is progressing
      function ( xhr ) {
        console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      // called when loading has errors
      function ( error ) {
        console.log( error );
      }
    );
  }else if(gltfProps.gltf.scene != undefined){
    GLTFModelPortal(gltfProps);
  }
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

export function createStaticTextList( textBoxProps, contentArr ) {
  let listConfig = textBoxProps.listConfig;
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createStaticTextBox(props);
  });

};

export function createStaticTextPortalList( textBoxProps, contentArr ) {
  let listConfig = textBoxProps.listConfig;
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createStaticTextPortal(props);
  });

};

export function createStaticScrollableTextList( textBoxProps, contentArr ) {
  let listConfig = textBoxProps.listConfig;
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createStaticScrollableTextBox(props);
  });

};

export function createStaticScrollableTextPortalList( textBoxProps, contentArr ) {
  let listConfig = textBoxProps.listConfig;
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createStaticScrollableTextPortal(props);
  });

};

export function createMultiTextList( textBoxProps, contentArr  ) {
  let listConfig = textBoxProps.listConfig;
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createMultiTextBox(props);
  });

};

export function createMultiTextPortalList( textBoxProps, contentArr  ) {
  let listConfig = textBoxProps.listConfig;
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createMultiTextPortal(props);
  });

};

export function createMultiScrollableTextList( textBoxProps, contentArr ) {
  let listConfig = textBoxProps.listConfig;
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createMultiScrollableTextBox(props);
  });

};

export function createMultiScrollableTextPortalList(textBoxProps, contentArr) {
  let listConfig = textBoxProps.listConfig;
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createMultiScrollableTextPortal(props);
  });

};

export function createImageContentList( imageProps, contentArr ) {
  let listConfig = imageProps.listConfig;
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((imgUrl, index) =>{
    console.log(imgUrl);
    let props = {...imageProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.listConfig = lConfig;
    createImageBox(props);
  });

};

export function createImagePortalList(imageProps, contentArr ) {
  let listConfig = imageProps.listConfig;
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((imgUrl, index) =>{
    console.log(imgUrl);
    let props = {...imageProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.listConfig = lConfig;
    createImagePortal(props);
  });

};

export function createGLTFContentList(gltfProps, contentArr) {
  let listConfig = gltfProps.listConfig;
  const listBoxSize = getGeometrySize(parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((gltfUrl, index) =>{
    console.log(gltfUrl)
    let props = {...gltfProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.listConfig = lConfig;
    createGLTFModel(props);
  });

};

export function createGLTFContentPortalList(gltfProps, contentArr) {
  let listConfig = gltfProps.listConfig;
  const listBoxSize = getGeometrySize(listConfig.boxProps.parent.geometry);
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((gltfUrl, index) =>{
    let props = {...gltfProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.listConfig = lConfig;
    createGLTFModelPortal(props);
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
    //textMesh.widget.base.userData.value = currentText;
    //textMesh.dispatchEvent({type:'update'});
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

    if(!isNaN(currentText)){
      textMesh.widget.box.userData.currentText = currentText;
      textMesh.widget.SetValue(currentText);
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
            onHandleTypingText(event, textMesh, currentText, boxSize, padding);
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

