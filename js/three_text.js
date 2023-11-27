import * as THREE from 'three';
import { gsap } from "gsap";
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import * as CameraUtils from 'three/addons/utils/CameraUtils.js';


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
let portalMeshes = [];

//Need pools for scenes and cameras to manage portal content
let scenePool = [];
let camPool = [];

export function createMainSceneLighting(scene){
  const ambientLight = new THREE.AmbientLight(0x404040);
  ambientLight.name = 'MAIN_AMBIENT_LIGHT'
  scene.add(ambientLight);
  ambientLight.layers.set

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
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
  const scene = new THREE.Scene();
  scenePool.push(scene);

  return scene
}

function removeSceneFromPool(scene){
  index = scenePool.indexOf(scene);
  scenePool.splice(index, 1);
}

function removeCameraFromPool(camera){
  index = camPool.indexOf(camera);
  camPool.splice(index, 1);
}

function toScreenPosition(obj, camera, renderer)
{
    var vector = new THREE.Vector3();

    var widthHalf = 0.5*renderer.context.canvas.width;
    var heightHalf = 0.5*renderer.context.canvas.height;

    obj.updateMatrixWorld();
    vector.setFromMatrixPosition(obj.matrixWorld);
    vector.project(camera);

    vector.x = ( vector.x * widthHalf ) + widthHalf;
    vector.y = - ( vector.y * heightHalf ) + heightHalf;

    return { 
        x: vector.x,
        y: vector.y
    };

};

function computeScreenSpaceBoundingBox(boundingBox, portal, camera) {

  const positionAttribute = portal.box.geometry.getAttribute( 'position' );
  const vertex = new THREE.Vector3();
  let min = new THREE.Vector3(1, 1, 1);
  let max = new THREE.Vector3(-1, -1, -1);
  
  boundingBox.set(min, max);

  for ( let vertexIndex = 0; vertexIndex < positionAttribute.count; vertexIndex ++ ) {

    let vertexWorldCoord = vertex.copy(vertex.fromBufferAttribute( positionAttribute, vertexIndex )).applyMatrix4(portal.box.matrixWorld);
    vertexWorldCoord.y -= portal.height;
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

  return {'x': x, 'y': y, 'w': w, 'h': h}
}


function randomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

export function listItemConfig(width, height, depth, textProps=undefined, meshProps=undefined, animProps=undefined, infoProps=undefined, useTimeStamp=true, spacing=0, index=0){
  return {
    'width': width,
    'height': height,
    'depth': depth,
    'textProps': textProps,
    'meshProps': meshProps,
    'animProps': animProps,
    'infoProps': infoProps,
    'useTimeStamp': true,
    'spacing': spacing,
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
  const top = box.geometry.parameters.height/2+10;
  const bottom = top-box.geometry.parameters.height-10;
  const right = box.geometry.parameters.width;
  const left = -box.geometry.parameters.width;
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
  const top = box.geometry.parameters.height/2+5;
  const bottom = top-box.geometry.parameters.height-5;

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
    elem.children.forEach((c, idx) => {
      let size = getGeometrySize(c.geometry);
      let yPos = size.height*idx;
      if(anim=='CLOSE'){
        yPos=0;
      }
      yPositions.push(yPos);
      if(idx>0){
        yPositions.push(-yPos);
      }
    });

    elem.userData.open = true;
    if(anim=='CLOSE'){
      elem.userData.open = false;
    }

    for (let i = 0; i < elem.children.length; i++) {
        let current = elem.children[i];
        let props = { duration: duration, x: current.position.x, y: yPositions[i], z: current.position.z, ease: easeIn };
        gsap.to(current.position, props);
    }
};

export function toggleAnimation(elem, duration=0.15, easeIn="power1.in", easeOut="elastic.Out"){

  if(elem.userData.anim != false && gsap.isTweening( elem.userData.anim ))
  return;

  let pos = elem.userData.onPos;

  if(elem.userData.on){
    pos=elem.userData.offPos;
  }

  let props = { duration: duration, x: pos.x, y: elem.position.y, z: elem.position.z, ease: easeIn, onComplete: updateToggleState, onCompleteParams:[elem] };

  if(!elem.userData.horizontal){
    props = { duration: duration, x: elem.position.x, y: pos.y, z: elem.position.z, ease: easeIn, onComplete: updateToggleState, onCompleteParams:[elem] };
  }

  elem.userData.anim = gsap.to(elem.position, props);

};

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


export function textProperties(font, clipped, letterSpacing, lineSpacing, wordSpacing, padding, size, height) {
  return {
    font: font,
    clipped: clipped,
    letterSpacing: letterSpacing,
    lineSpacing: lineSpacing,
    wordSpacing: wordSpacing,
    padding: padding,
    size: size,
    height: height,
  }
};

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

function updateToggleState(elem){

  elem.userData.on=!elem.userData.on;

}

function baseClipMaterial(){
  let stencilRef = stencilRefs.length;
  const mat = new THREE.MeshBasicMaterial();
  mat.color.set(Math.random() * 0xff00000 - 0xff00000);
  mat.stencilRef = stencilRef;
  mat.stencilFunc = THREE.NotEqualStencilFunc;
  mat.stencilFail = THREE.ReplaceStencilOp;
  mat.stencilZFail = THREE.ReplaceStencilOp;
  mat.stencilZPass = THREE.ReplaceStencilOp;

  stencilRefs.push(stencilRefs.length+1);

  return mat
}

export function clipMaterial(clippingPlanes){
  let mat = baseClipMaterial();
  mat.side = THREE.FrontSide;
  mat.clippingPlanes = clippingPlanes;
  mat.stencilFail = THREE.DecrementWrapStencilOp;
  mat.stencilZFail = THREE.DecrementWrapStencilOp;
  mat.stencilZPass = THREE.DecrementWrapStencilOp;

  return mat
}

export function transparentMaterial(){
  const mat = new THREE.MeshBasicMaterial();
  mat.color = 'red';
  mat.transparent = true;
  mat.opacity = 0;

  return mat
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

export function getPortalMeshes(){
  return portalMeshes;
};

export function addToPortalMeshes(obj){
  portalMeshes.push(obj);
};

export function getScenePool(){
  return scenePool;
};

export function getCamPool(){
  return camPool;
};

export function updateTextBoxClipping(textBox){
  const boxSize = getGeometrySize(textBox.box.geometry);
  // textBox.box.userData.topClipVector.constant = boxSize.height/2;
  // textBox.box.userData.bottomClipVector.constant = boxSize.height/2;
  // textBox.box.userData.rightClipVector.constant = boxSize.width/2;
  // textBox.box.userData.leftClipVector.constant = boxSize.width/2;

  textBox.clipTop.applyMatrix4(textBox.box.matrixWorld);
  textBox.clipBottom.applyMatrix4(textBox.box.matrixWorld);
  textBox.clipRight.applyMatrix4(textBox.box.matrixWorld);
  textBox.clipLeft.applyMatrix4(textBox.box.matrixWorld);
}

export function textBox(width, height, padding, clipped=true){

  const box = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.01), new THREE.MeshBasicMaterial({ color: Math.random() * 0xff00000 - 0xff00000 }));
  box.userData.topClipVector = new THREE.Vector3( 0, -1, 0 );
  box.userData.bottomClipVector = new THREE.Vector3( 0, 1, 0 );
  box.userData.rightClipVector = new THREE.Vector3( -1, 0, 0 );
  box.userData.leftClipVector = new THREE.Vector3( 1, 0, 0 );

  let result = { 'box': box };

  if(clipped){
    const clipTop = new THREE.Plane( box.userData.topClipVector, height/2);
    const clipBottom = new THREE.Plane( box.userData.bottomClipVector, height/2);
    const clipRight = new THREE.Plane( box.userData.rightClipVector, width/2 );
    const clipLeft = new THREE.Plane( box.userData.leftClipVector, width/2);

    clipTop.applyMatrix4(box.matrixWorld);
    clipBottom.applyMatrix4(box.matrixWorld);
    clipRight.applyMatrix4(box.matrixWorld);
    clipLeft.applyMatrix4(box.matrixWorld);

    result = { 'box': box, 'clipTop': clipTop, 'clipBottom': clipBottom, 'clipLeft': clipLeft, 'clipRight': clipRight, 'padding': padding };
  }

  return result

};

export function portalBox(width, height, padding, scene){
  const box = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial() );
  const boundingBox = new THREE.Box2();

  let result = { 'box': box, 'width': width, 'height': height, 'boundingBox': boundingBox, 'scene': scene };

  portalMeshes.push(result);


  return result
};

function updatePortalLighting(portal, mainScene){
  const ambientLight = getMainAmbientLight(mainScene);
  const directionalLight = getMainDirectionalLight(mainScene);

  if(ambientLight == undefined || directionalLight == undefined)
    return;

  portal.scene.add(ambientLight);
  ambientLight.layers.set(portal.box.layers.mask);
  portal.scene.add(directionalLight);
  directionalLight.layers.set(portal.box.layers.mask);
}

function resetMainSceneLighting(portal, mainScene){
  const ambientLight = getMainAmbientLight(mainScene);
  const directionalLight = getMainDirectionalLight(mainScene);

  if(ambientLight == undefined || directionalLight == undefined)
    return;

  mainScene.add(ambientLight);
  ambientLight.layers.set(0);
  mainScene.add(directionalLight);
  directionalLight.layers.set(0);
}

export function renderPortal(portal, mainScene, mainCam, renderer){
  computeScreenSpaceBoundingBox(portal.boundingBox, portal, mainCam);

  let n = normalizedToPixels(portal.boundingBox);

  renderer.setViewport(0, 0, window.innerWidth, 
  window.innerHeight);
  renderer.render(mainScene, mainCam);
  renderer.clearDepth();
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
  updatePortalLighting(portal, mainScene);
  portal.scene.add(mainCam);
  mainCam.layers.set(portal.box.layers.mask);
  renderer.render(portal.scene, mainCam);
  mainCam.layers.set(0);
  mainScene.add(mainCam)
  renderer.setScissorTest(false);
  resetMainSceneLighting(portal, mainScene);

}


export function toggleBox(width, height, padding=0.1, horizontal=true){

  let baseWidth=width*2;
  let baseHeight=height;
  if(horizontal==false){
    baseWidth=width;
    baseHeight=height*2;
  }
  const handle = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.01), new THREE.MeshBasicMaterial({ color: Math.random() * 0xff00000 - 0xff00000 }));
  const base = new THREE.Mesh(new THREE.BoxGeometry(baseWidth+padding, baseHeight+padding, 0.01), new THREE.MeshBasicMaterial({ color: Math.random() * 0xff00000 - 0xff00000 }));
  let baseSize = getGeometrySize(base.geometry);
  let handleSize = getGeometrySize(handle.geometry);
  base.add(handle);

  if(horizontal){
    handle.position.set(-(baseSize.width/2-width/2)+padding, handle.position.y, handle.position.z+baseSize.depth);
  }else{
    handle.position.set(handle.position.x, -(baseSize.height/2-height/2)+padding, handle.position.z+baseSize.depth);
  }
  base.userData.horizontal = horizontal;

  let result = { 'handle': handle, 'base': base }
  setToggleUserData(result, width, height, padding, horizontal)

  return result

};

export function meshProperties(curveSegments=12, bevelEnabled=false, bevelThickness=0.1, bevelSize=0.1, bevelOffset=0, bevelSegments=3){
  return {
    'curveSegments': curveSegments,
    'bevelEnabled': bevelEnabled,
    'bevelThickness': bevelThickness,
    'bevelSize': bevelSize,
    'bevelOffset': bevelOffset,
    'bevelSegments': bevelSegments
  }
}

function setToggleUserData(toggle, width, height, padding, horizontal=true){
  let baseSize = getGeometrySize(toggle.base.geometry);
  let handleSize = getGeometrySize(toggle.handle.geometry);

  toggle.base.userData.type = 'TOGGLE';
  toggle.base.userData.size = baseSize;
  toggle.base.userData.handle = toggle.handle;
  toggle.base.userData.horizontal = horizontal;

  toggle.handle.userData.type = 'TOGGLE';
  toggle.handle.userData.size = handleSize;
  toggle.handle.userData.offPos = new THREE.Vector3().copy(toggle.handle.position);
  toggle.handle.userData.horizontal = horizontal;
  toggle.handle.userData.anim = false;
  toggle.handle.userData.on = false;

  if(horizontal){
    toggle.handle.userData.onPos = new THREE.Vector3(toggle.handle.position.x+baseSize.width/2-padding, toggle.handle.position.y, toggle.handle.position.z+baseSize.depth);
  }else{
    toggle.handle.userData.onPos = new THREE.Vector3(toggle.handle.position.x, (baseSize.height/2-height/2)-padding, toggle.handle.position.z+baseSize.depth);
  }

}

function setMergedMeshUserData(boxSize, geomSize, padding, mergedMesh){
  mergedMesh.userData.initialPositionY = boxSize.height/2 - geomSize.height/2;
  mergedMesh.userData.maxScroll = geomSize.height/2 - boxSize.height/2;
  mergedMesh.userData.minScroll = mergedMesh.userData.initialPositionY+mergedMesh.userData.maxScroll+padding;
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

export function createMergedTextBoxGeometry(txtBox, font, boxWidth, boxHeight, text, textProps=undefined, meshProps=undefined, animProps=undefined) {
    let lineWidth = -(txtBox.box.geometry.parameters.width / 2 - textProps.padding);
    let yPosition = txtBox.box.geometry.parameters.height / 2 - textProps.padding;
    const boxSize = getGeometrySize(txtBox.box.geometry);
    const letterGeometries = [];

    let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});
    if(textProps.clipped){
      mat = clipMaterial([txtBox.clipTop, txtBox.clipBottom, txtBox.clipLeft, txtBox.clipRight]);
    }

    for (let i = 0; i < text.length; i++) {
      const character = text[i];

      if (character === ' ') {
        // Handle spaces by adjusting the x position
        lineWidth += textProps.wordSpacing;
      } else {

         if(meshProps == undefined){
          meshProps = meshProperties()
        }
        const geometry = createTextGeometry(character, font, textProps.size, textProps.height, meshProps.curveSegments, meshProps.bevelEnabled, meshProps.bevelThickness, meshProps.bevelSize, meshProps.bevelOffset, meshProps.bevelSegments);
        geometry.translate(lineWidth, yPosition, boxSize.depth);

        // Calculate the width of the letter geometry
        let { width } = getGeometrySize(geometry);
        width+=textProps.letterSpacing;

        // Check if the letter is within the bounds of the txtBox mesh
        if (width <= txtBox.box.geometry.parameters.width / 2 - textProps.padding) {
          letterGeometries.push(geometry);
        }

        // Update lineWidth
        lineWidth += width;
      }

      // Check if lineWidth exceeds txtBox width - padding
      if (lineWidth > txtBox.box.geometry.parameters.width / 2 - textProps.padding) {
        lineWidth = -(txtBox.box.geometry.parameters.width / 2) + textProps.padding; // Reset x position to the upper-left corner
        yPosition -= textProps.lineSpacing; // Move to the next line
      }
    }

    // Merge the individual letter geometries into a single buffer geometry
    return BufferGeometryUtils.mergeGeometries(letterGeometries);
}

export function createMergedTextGeometry(font, boxWidth, boxHeight, text, fontPath, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, meshProps=undefined, animProps=undefined) {
    let lineWidth = 0;
    let yPosition = boxHeight / 2 - padding;
    const letterGeometries = [];

    for (let i = 0; i < text.length; i++) {
      const character = text[i];

      if (character === ' ') {
        // Handle spaces by adjusting the x position
        lineWidth += wordSpacing;
      } else {

         if(meshProps == undefined){
          meshProps = meshProperties()
        }
        const geometry = createTextGeometry(character, font, size, height, meshProps.curveSegments, meshProps.bevelEnabled, meshProps.bevelThickness, meshProps.bevelSize, meshProps.bevelOffset, meshProps.bevelSegments);
        geometry.translate(lineWidth, yPosition, 0);

        // Calculate the width of the letter geometry
        let { width } = getGeometrySize(geometry);
        width+=letterSpacing;

        letterGeometries.push(geometry);

        // Update lineWidth
        lineWidth += width;
      }

    }

    // Merge the individual letter geometries into a single buffer geometry
    return BufferGeometryUtils.mergeGeometries(letterGeometries);
}

export function createStaticTextBox(parent, boxWidth, boxHeight, name, text, textProps=undefined, meshProps=undefined, animProps=undefined,  listConfig=undefined, onCreated=undefined) {
  // Load the font
  loader.load(textProps.font, (font) => {
    const txtBox = textBox(boxWidth, boxHeight, textProps.padding, textProps.clipped);

    let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});
    if(textProps.clipped){
      mat = clipMaterial([txtBox.clipTop, txtBox.clipBottom, txtBox.clipLeft, txtBox.clipRight]);
    }

    // Merge the individual letter geometries into a single buffer geometry
    let mergedGeometry = createMergedTextBoxGeometry(txtBox, font, boxWidth, boxHeight, text, textProps, meshProps, animProps);
    // Create a mesh from the merged geometry
    const mergedMesh = new THREE.Mesh(mergedGeometry, mat);
    if(animProps!=undefined){
      mergedMesh.material.transparent=true;
      mergedMesh.material.opacity=0;
    }
    const boxSize = getGeometrySize(txtBox.box.geometry);
    const geomSize = getGeometrySize(mergedGeometry);
    setMergedMeshUserData(boxSize, geomSize, textProps.padding, mergedMesh);

    if(listConfig != undefined){
      txtBox.box.name = name;
      createListItem(parent, listConfig.width, listConfig.height, txtBox.box, listConfig.textProps, listConfig.meshProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.index);
    }else{
      parent.add(txtBox.box);
    }

    txtBox.box.add(mergedMesh);
    if(name==''){
      name='text-'+txtBox.box.id;
    }
    txtBox.box.name = name;
    adjustBoxScaleRatio(txtBox.box, parent);

    if(animProps!=undefined){
      //anim, action, duration, ease, delay, onComplete
      txtAnimation(txtBox.box, mergedMesh, animProps.anim, animProps.action, animProps.duration, animProps.ease, animProps.delay, 0, animProps.callback);
    }

    if(onCreated!=undefined){
      onCreated(txtBox.box);
    }

  });
}

export function createStaticScrollableTextBox(parent, boxWidth, boxHeight, name, text, textProps=undefined, meshProps=undefined, animProps=undefined,  listConfig=undefined, onCreated=undefined) {
  // Load the font
  loader.load(textProps.font, (font) => {
    const txtBox = textBox(boxWidth, boxHeight, textProps.padding, textProps.clipped);

    let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});
    if(textProps.clipped){
      mat = clipMaterial([txtBox.clipTop, txtBox.clipBottom, txtBox.clipLeft, txtBox.clipRight]);
    }
    // Merge the individual letter geometries into a single buffer geometry
    let mergedGeometry = createMergedTextBoxGeometry(txtBox, font, boxWidth, boxHeight, text, textProps, meshProps, animProps);

    // Create a mesh from the merged geometry
    const mergedMesh = new THREE.Mesh(mergedGeometry, mat);
    if(animProps!=undefined){
      mergedMesh.material.transparent=true;
      mergedMesh.material.opacity=0;
    }
    const boxSize = getGeometrySize(txtBox.box.geometry);
    const geomSize = getGeometrySize(mergedGeometry);
    mergedMesh.position.set(0, -textProps.padding, 0);

    if(listItemConfig != undefined){
      txtBox.box.name = name;
      createListItem(parent, listConfig.width, listConfig.height, txtBox.box, listConfig.textProps, listConfig.meshProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.index);
    }else{
      parent.add(txtBox.box);
    }

    txtBox.box.add(mergedMesh);
    if(name==''){
      name='text-'+txtBox.box.id;
    }
    txtBox.box.name = name;
    adjustBoxScaleRatio(txtBox.box, parent);
    setMergedMeshUserData(boxSize, geomSize, textProps.padding, mergedMesh);
    mergedMesh.userData.draggable=true;

    draggable.push(mergedMesh);
    if(animProps!=undefined){
      //anim, action, duration, ease, delay, onComplete
      txtAnimation(txtBox.box, mergedMesh, animProps.anim, animProps.action, animProps.duration, animProps.ease, animProps.delay, 0, animProps.callback);
    }
    if(onCreated!=undefined){
      onCreated(txtBox.box);
    }

  });
}

export function createMultiTextBox(parent, boxWidth, boxHeight, name, text, textProps=undefined, meshProps=undefined, animProps=undefined,  listConfig=undefined, onCreated=undefined) {
  // Load the font
  loader.load(textProps.font, (font) => {
    const txtBox = textBox(boxWidth, boxHeight, textProps.padding, textProps.clipped);
    let lineWidth = -(txtBox.box.geometry.parameters.width / 2 - textProps.padding);
    let yPosition = txtBox.box.position.y+txtBox.box.geometry.parameters.height / 2 - textProps.padding*2;
    const boxSize = getGeometrySize(txtBox.box.geometry);
    const letterGeometries = [];
    const letterMeshes = [];

    let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});
    if(textProps.clipped){
      mat = clipMaterial([txtBox.clipTop, txtBox.clipBottom, txtBox.clipLeft, txtBox.clipRight]);
      clippedMeshes.push(txtBox);
    }

    for (let i = 0; i < text.length; i++) {
      const character = text[i];

      if (character === ' ') {
        // Handle spaces by adjusting the x position
        lineWidth += textProps.wordSpacing;
      } else {

         if(meshProps == undefined){
          meshProps = meshProperties()
        }
        const geometry = createTextGeometry(character, font, textProps.size, textProps.height, meshProps.curveSegments, meshProps.bevelEnabled, meshProps.bevelThickness, meshProps.bevelSize, meshProps.bevelOffset, meshProps.bevelSegments);

        const letterMesh = new THREE.Mesh(geometry, mat);
        letterMesh.position.set(lineWidth, yPosition, boxSize.depth/2-textProps.height/2);
        if(animProps!=undefined){
          letterMesh.material.transparent=true;
          letterMesh.material.opacity=0;
        }

        // Calculate the width of the letter geometry
        let { width } = getGeometrySize(geometry);
        width+=textProps.letterSpacing;

        // Check if the letter is within the bounds of the txtBox mesh
        if (width <= txtBox.box.geometry.parameters.width / 2 - textProps.padding) {
          txtBox.box.add(letterMesh);
          letterMeshes.push(letterMesh);
          letterGeometries.push(geometry);
        }

        // Update lineWidth
        lineWidth += width;
      }

      // Check if lineWidth exceeds txtBox width - padding
      if (lineWidth > txtBox.box.geometry.parameters.width / 2 - textProps.padding) {
        lineWidth = -(txtBox.box.geometry.parameters.width / 2) + textProps.padding; // Reset x position to the upper-left corner
        yPosition -= textProps.lineSpacing; // Move to the next line
      }
    }

    if(listConfig != undefined){
      txtBox.box.name = name;
      createListItem(parent, listConfig.width, listConfig.height, txtBox.box, listConfig.textProps, listConfig.meshProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.index);
    }else{
      parent.add(txtBox.box);
    }

    adjustBoxScaleRatio(txtBox.box, parent);
    if(name==''){
      name='text-'+txtBox.box.id;
    }
    txtBox.box.name = name;

    if(animProps!=undefined){
      //anim, action, duration, ease, delay, onComplete
      multiAnimation(txtBox.box, txtBox.box.children, animProps.anim, animProps.action, animProps.duration, animProps.ease, animProps.delay, animProps.callback);
    }
    if(onCreated!=undefined){
      onCreated(txtBox.box);
    }

  });
}

export function createMultiScrollableTextBox(parent, boxWidth, boxHeight, name, text, textProps=undefined, meshProps=undefined, animProps=undefined,  listConfig=undefined, onCreated=undefined) {
  // Load the font
  loader.load(textProps.font, (font) => {
    const txtBox = textBox(boxWidth, boxHeight, textProps.padding, textProps.clipped);
    let lineWidth = -(txtBox.box.geometry.parameters.width / 2 - textProps.padding);
    let yPosition = txtBox.box.geometry.parameters.height / 2 - textProps.padding;
    const letterGeometries = [];
    const letterMeshes = [];
    const cubes = [];

    let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});
    if(textProps.clipped){
      mat = clipMaterial([txtBox.clipTop, txtBox.clipBottom, txtBox.clipLeft, txtBox.clipRight]);
    }

    for (let i = 0; i < text.length; i++) {
      const character = text[i];

      if (character === ' ') {
        // Handle spaces by adjusting the x position
        lineWidth += textProps.wordSpacing;
      } else {

         if(meshProps == undefined){
          meshProps = meshProperties()
        }
        const geometry = createTextGeometry(character, font, textProps.size, textProps.height, meshProps.curveSegments, meshProps.bevelEnabled, meshProps.bevelThickness, meshProps.bevelSize, meshProps.bevelOffset, meshProps.bevelSegments);
        const cube = new THREE.BoxGeometry(textProps.size*2, textProps.size*2, textProps.height);

        cube.translate((textProps.size/2)+lineWidth, (textProps.size/2)+yPosition, 0);

        const letterMesh = new THREE.Mesh(geometry, mat);
        letterMesh.position.set(lineWidth, yPosition, 0);

        if(animProps!=undefined){
          letterMesh.material.transparent=true;
          letterMesh.material.opacity=0;
        }

        // Calculate the width of the letter geometry
        let { width } = getGeometrySize(geometry);
        width+=textProps.letterSpacing;

        // Check if the letter is within the bounds of the txtBox mesh
        if (width <= txtBox.box.geometry.parameters.width / 2 - textProps.padding) {
          letterMeshes.push(letterMesh);
          letterGeometries.push(geometry);
          cubes.push(cube);
        }
        // Update lineWidth
        lineWidth += width;
      }

      // Check if lineWidth exceeds txtBox width - padding
      if (lineWidth > txtBox.box.geometry.parameters.width / 2 - textProps.padding) {
        lineWidth = -(txtBox.box.geometry.parameters.width / 2) + textProps.padding; // Reset x position to the upper-left corner
        yPosition -= textProps.lineSpacing; // Move to the next line
      }
    }
    const mergedGeometry = BufferGeometryUtils.mergeGeometries(cubes);
    const mergedMesh = new THREE.Mesh(mergedGeometry, transparentMaterial());
    txtBox.box.add(mergedMesh);
    const boxSize = getGeometrySize(txtBox.box.geometry);
    const geomSize = getGeometrySize(mergedGeometry);
    mergedMesh.position.set(0, -textProps.padding, 0);
    setMergedMeshUserData(boxSize, geomSize, textProps.padding, mergedMesh);
    mergedMesh.userData.draggable=true;
    if(name==''){
      name='text-'+txtBox.box.id;
    }
    txtBox.box.name = name;
    letterMeshes.forEach((m, i) => {
      mergedMesh.add(m);
    })

    if(listConfig != undefined){
      txtBox.box.name = name;
      createListItem(parent, listConfig.width, listConfig.height, txtBox.box, listConfig.textProps, listConfig.meshProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.index);
    }else{
      parent.add(txtBox.box);
    }

    adjustBoxScaleRatio(txtBox.box, parent);
    draggable.push(mergedMesh);

    if(animProps!=undefined){
      //anim, action, duration, ease, delay, onComplete
      multiAnimation(txtBox.box, mergedMesh.children, animProps.anim, animProps.action, animProps.duration, animProps.ease, animProps.delay, animProps.callback);
    }
    if(onCreated!=undefined){
      onCreated(txtBox.box);
    }
    //TEST
    // let aConfig = animationConfig('SLIDE_RIGHT', 'OUT', 2, 'back.inOut', 0)
    // setTimeout(() => {
    //   multiAnimation(txtBox.box, mergedMesh.children, aConfig.anim, aConfig.action, aConfig.duration, aConfig.ease, aConfig.delay, aConfig.callback);
    // }, "4000");
  });

}

function selectionTextBox(parent, boxWidth, boxHeight, name, text, font, textProps=undefined, meshProps=undefined, animProps=undefined, onCreated=undefined){
  const txtBox = textBox(boxWidth, boxHeight, textProps.padding, textProps.clipped);

  let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});
  if(textProps.clipped){
    mat = clipMaterial([txtBox.clipTop, txtBox.clipBottom, txtBox.clipLeft, txtBox.clipRight]);
  }

  const promptGeometry = createMergedTextBoxGeometry(txtBox, font, boxWidth, boxHeight, text, textProps, meshProps, animProps);
  const promptMesh = new THREE.Mesh(promptGeometry, mat);
  const boxSize = getGeometrySize(txtBox.box.geometry);
  const geomSize = getGeometrySize(promptGeometry);
  const parentSize = getGeometrySize(parent.geometry);
  setMergedMeshUserData(boxSize, geomSize, textProps.padding, promptMesh);

  txtBox.box.add(promptMesh);
  promptMesh.position.set(promptMesh.position.x, promptMesh.position.y-textProps.padding, promptMesh.position.z);
  parent.add(txtBox.box);
  txtBox.box.position.set(txtBox.box.position.x, txtBox.box.position.y, parentSize.depth/2+boxSize.depth/2);
  adjustBoxScaleRatio(txtBox.box, parent);

  return {promptMesh, txtBox}
}

function selectionText(parent, boxWidth, boxHeight, name, text, font, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, meshProps=undefined, animProps=undefined, onCreated=undefined){

  const promptGeometry = createMergedTextGeometry(font, boxWidth, boxHeight, text, 'fontPath', clipped, letterSpacing, lineSpacing, wordSpacing, padding, size, height, meshProps, animProps);
  promptGeometry.center();

  const geomSize = getGeometrySize(promptGeometry);
  const parentSize = getGeometrySize(parent.geometry);
  let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});
  const txtBox = textBox(geomSize.width+padding, boxHeight, padding, clipped);
  const boxSize = getGeometrySize(txtBox.box.geometry);
  if(clipped){
    mat = clipMaterial([txtBox.clipTop, txtBox.clipBottom, txtBox.clipLeft, txtBox.clipRight]);
  }
  const promptMesh = new THREE.Mesh(promptGeometry, mat);

  setMergedMeshUserData(boxSize, geomSize, padding, promptMesh);

  txtBox.box.add(promptMesh);
  promptMesh.position.set(0, 0, 0);
  parent.add(txtBox.box);
  txtBox.box.position.set(txtBox.box.position.x, txtBox.box.position.y, parentSize.depth/2+boxSize.depth/2);
  adjustBoxScaleRatio(txtBox.box, parent);

  return {promptMesh, txtBox}
}

export function createTextInput(parent, boxWidth, boxHeight, name, text, textProps=undefined, meshProps=undefined, animProps=undefined, onCreated=undefined) {
  loader.load(textProps.font, (font) => {
    let inputProps = selectionTextBox(parent, boxWidth, boxHeight, name, text, font, textProps, meshProps, animProps, onCreated);
    inputPrompts.push(inputProps.promptMesh);
    mouseOverable.push(inputProps.promptMesh);
    const tProps = {'txtBox': inputProps.txtBox, 'text': '', 'textMesh': inputProps.promptMesh, 'font': font, 'size': textProps.size, 'height': textProps.height, 'clipped': textProps.clipped, 'letterSpacing': textProps.letterSpacing, 'lineSpacing': textProps.lineSpacing, 'wordSpacing': textProps.wordSpacing, 'padding': textProps.padding, 'scrollable': false, 'meshProps': meshProps };
    inputProps.promptMesh.userData.textProps = tProps;
    inputProps.txtBox.box.userData.mouseOverParent = true;
    mouseOverable.push(inputProps.txtBox.box);
    mouseOverUserData(inputProps.promptMesh);
  });
};

export function createScrollableTextInput(parent, boxWidth, boxHeight, name, text, textProps=undefined, meshProps=undefined, animProps=undefined, onCreated=undefined) {
  loader.load(textProps.font, (font) => {
    let inputProps = selectionTextBox(parent, boxWidth, boxHeight, name, text, font, textProps, meshProps, animProps, onCreated);
    inputPrompts.push(inputProps.promptMesh);
    const tProps = {'txtBox': inputProps.txtBox, 'text': '', 'textMesh': inputProps.promptMesh, 'font': font, 'size': textProps.size, 'height': textProps.height, 'clipped': textProps.clipped, 'letterSpacing': textProps.letterSpacing, 'lineSpacing': textProps.lineSpacing, 'wordSpacing': textProps.wordSpacing, 'padding': textProps.padding, 'draggable': true, 'meshProps': meshProps };
    inputProps.promptMesh.userData.textProps = tProps;
    inputProps.promptMesh.userData.draggable = true;
    inputProps.txtBox.box.userData.mouseOverParent = false;
    mouseOverUserData(inputProps.promptMesh);
  });
};

export function createListSelector(selectors, parent, boxWidth, boxHeight, name, text, textProps=undefined, meshProps=undefined, animProps=undefined, onCreated=undefined) {
  loader.load(textProps.font, (font) => {
    const txtBox = textBox(boxWidth, boxHeight, textProps.padding, textProps.clipped);
    selectorUserData(txtBox.box);
    for (const [selTxt, url] of Object.entries(selectors)) {
      let inputProps = selectionText(txtBox.box, boxWidth, boxHeight, name, selTxt, font, textProps.clipped, textProps.letterSpacing, textProps.lineSpacing, textProps.wordSpacing, textProps.padding, textProps.size, textProps.height, meshProps, animProps, onCreated);
      const tProps = {'txtBox': inputProps.txtBox, 'text': '', 'textMesh': inputProps.promptMesh, 'font': font, 'size': textProps.size, 'height': textProps.height, 'clipped': textProps.clipped, 'letterSpacing': textProps.letterSpacing, 'lineSpacing': textProps.lineSpacing, 'wordSpacing': textProps.wordSpacing, 'padding': textProps.padding, 'draggable': true, 'meshProps': meshProps };
      inputProps.promptMesh.userData.textProps = tProps;
      inputPrompts.push(inputProps.promptMesh);
      mouseOverable.push(inputProps.promptMesh);
      clickable.push(inputProps.promptMesh);
      inputProps.promptMesh.userData.draggable=false;
      inputProps.txtBox.box.userData.mouseOverParent = true;
      mouseOverUserData(inputProps.promptMesh);
      txtBox.box.userData.selectors.push(inputProps);
      selectorElems.push(inputProps.txtBox.box);
    }

    parent.add(txtBox.box);
  });
};

function Button(parent, boxWidth, boxHeight, name, text, fontPath, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, meshProps=undefined, animProps=undefined, onCreated=undefined, mouseOver=true) {
  loader.load(fontPath, (font) => {
    let txtMesh = selectionText(parent, boxWidth, boxHeight, name, text, font, clipped, letterSpacing, lineSpacing, wordSpacing, padding, size, height, meshProps, animProps, onCreated);
    inputPrompts.push(txtMesh.promptMesh);
    const textProps = {'txtBox': txtMesh.txtBox, 'text': '', 'textMesh': txtMesh.promptMesh, 'font': font, 'size': size, 'height': height, 'clipped': clipped, 'letterSpacing': letterSpacing, 'lineSpacing': lineSpacing, 'wordSpacing': wordSpacing, 'padding': padding, 'draggable': true, 'meshProps': meshProps };
    txtMesh.txtBox.box.userData.textProps = textProps;
    txtMesh.txtBox.box.userData.draggable=false;
    txtMesh.promptMesh.userData.mouseOverParent = true;

    mouseOverUserData(txtMesh.txtBox.box);
    clickable.push(txtMesh.txtBox.box);
    if(!mouseOver)
      return;
    mouseOverable.push(txtMesh.txtBox.box);
  });
}

export function createButton(parent, boxWidth, boxHeight, name, text, textProps=undefined, meshProps=undefined, animProps=undefined, onCreated=undefined){
  Button(parent, boxWidth, boxHeight, name, text, textProps.font, textProps.clipped, textProps.letterSpacing, textProps.lineSpacing, textProps.wordSpacing, textProps.padding, textProps.size, textProps.height, meshProps, animProps, onCreated, false);
};

export function createMouseOverButton(parent, boxWidth, boxHeight, name, text, textProps=undefined, meshProps=undefined, animProps=undefined, onCreated=undefined){
  Button(parent, boxWidth, boxHeight, name, text, textProps.font, textProps.clipped, textProps.letterSpacing, textProps.lineSpacing, textProps.wordSpacing, textProps.padding, textProps.size, textProps.height, meshProps, animProps, onCreated, true);
};

function createToggle(parent, boxWidth, boxHeight, name, text, fontPath, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=0.1, size=1, height=1, meshProps=undefined, animProps=undefined, onCreated=undefined, horizontal=true) {
  loader.load(fontPath, (font) => {

    let toggle = toggleBox(boxWidth, boxHeight, padding, horizontal);
    parent.add(toggle.base);
    toggles.push(toggle.handle);

    if(name.length>0){

      let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});
      const geometry = createTextGeometry(name, font, size, height, meshProps.curveSegments, meshProps.bevelEnabled, meshProps.bevelThickness, meshProps.bevelSize, meshProps.bevelOffset, meshProps.bevelSegments);
      const mergedMesh = new THREE.Mesh(geometry, mat);
      mergedMesh.position.set(-boxWidth, boxHeight, 0);
      parent.add(mergedMesh);

    }

  });
}

export function createHorizontalToggle(parent, boxWidth, boxHeight, name, text, textProps=undefined, meshProps=undefined, animProps=undefined, onCreated=undefined){
  createToggle(parent, boxWidth, boxHeight, name, text, textProps.font, textProps.clipped, textProps.letterSpacing, textProps.lineSpacing, textProps.wordSpacing, textProps.padding, textProps.size, textProps.height, meshProps, animProps, onCreated, true);
};

export function createVerticalToggle(parent, boxWidth, boxHeight, name, text, textProps=undefined, meshProps=undefined, animProps=undefined, onCreated=undefined){
  createToggle(parent, boxWidth, boxHeight, name, text, textProps.font, textProps.clipped, textProps.letterSpacing, textProps.lineSpacing, textProps.wordSpacing, textProps.padding, textProps.size, textProps.height, meshProps, animProps, onCreated, false);
};


export function createImageBox(parent, boxWidth, boxHeight, name, imgUrl, textProps=undefined, meshProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined){

  const txtBox = textBox(boxWidth, boxHeight, 0, false);
  const boxSize = getGeometrySize(txtBox.box.geometry);
  const map = new THREE.TextureLoader().load( imgUrl );
  const material = new THREE.MeshBasicMaterial( { color: 'white', map: map } );
  txtBox.box.material = material;

  if(listConfig != undefined){
    txtBox.box.name = name;
    createListItem(parent, listConfig.width, listConfig.height, txtBox.box, listConfig.textProps, listConfig.meshProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.index);
  }else{
    parent.add(txtBox.box);
  }

};

export function createGLTFModel(parent, boxWidth, boxHeight, name, gltfUrl, textProps=undefined, meshProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined){
  
  const txtBox = textBox(boxWidth, boxHeight, 0, false);
  const boxSize = getGeometrySize(txtBox.box.geometry);
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

      txtBox.box.material.opacity = 0;
      txtBox.box.material.transparent = true;

      let ratio = boxSize[prop]/sceneSize[axis];

      if(boxSize[prop]>sceneSize[axis]){
        ratio = sceneSize[axis]/boxSize[prop];
      }

      gltf.scene.scale.set(gltf.scene.scale.x*ratio, gltf.scene.scale.y*ratio, gltf.scene.scale.z*ratio);
      gltf.scene.position.set(gltf.scene.position.x, gltf.scene.position.y, gltf.scene.position.z+boxSize.depth+(sceneSize.z/2*ratio))

      txtBox.box.add( gltf.scene );

      if(listItemConfig != undefined){
        txtBox.box.name = name;
        createListItem(parent, listConfig.width, listConfig.height, txtBox.box, listConfig.textProps, listConfig.meshProps, listConfig.animProps, listConfig.infoProps, true, listConfig.spacing, listConfig.index);
      }else{
        parent.add(txtBox.box);
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

export function createGLTFModelPortal(parent, boxWidth, boxHeight, name, gltfUrl, textProps=undefined, meshProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined){
  const mainCam = getMainCam(parent.parent);
  const mainLight = getMainAmbientLight(parent.parent)
  const scene = addSceneToPool();
  //scene.background = new THREE.Color('red');

  const portal = portalBox(boxWidth, boxHeight, 0, scene);
  const boxSize = getGeometrySize(portal.box.geometry);

  // Instantiate a loader
  gltfLoader.load(
    // resource URL
    gltfUrl,
    // called when the resource is loaded
    function ( gltf ) {
      const test = new THREE.Mesh(new THREE.BoxGeometry(boxWidth/2, boxHeight/2, boxHeight/2), new THREE.MeshBasicMaterial({ color: Math.random() * 0xff00000 - 0xff00000 }));
      const box = new THREE.Box3().setFromObject( gltf.scene ); 
      const sceneSize = box.getSize(new THREE.Vector3());

      gltf.scene.traverse( function( object ) {

          object.layers.set( 1 );

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

      //portal.box.add( gltf.scene );
      scene.add( gltf.scene );
      portal.box.add(scene);

      parent.add(portal.box);

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
}

export function createListItem( parent, boxWidth, boxHeight, content, textProps=undefined, meshProps=undefined, animProps=undefined, infoProps=undefined, useTimeStamp=true, spacing=0, index=0) {
  const parentSize = getGeometrySize(parent.geometry);
  const contentSize = getGeometrySize(content.geometry);
  const elemBox = textBox(boxWidth, boxHeight, 0, false);
  elemBox.box.userData.elemIndex = index;
  const elemBoxSize = getGeometrySize(elemBox.box.geometry);
  elemBox.box.add(content);
  content.position.set(0, 0, elemBoxSize.depth);

  if(infoProps.title.length>0 || infoProps.author.length>0 || useTimeStamp){

    loader.load(textProps.font, (font) => {

      let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});

      if(infoProps.title.length>0){

          const geometry = createTextGeometry(infoProps.title, font, textProps.size, textProps.height, meshProps.curveSegments, meshProps.bevelEnabled, meshProps.bevelThickness, meshProps.bevelSize, meshProps.bevelOffset, meshProps.bevelSegments);
          geometry.center();
          const textMesh = new THREE.Mesh(geometry, mat);
          const textMeshSize = getGeometrySize(textMesh.geometry);
          elemBox.box.add(textMesh);

          textMesh.position.set(0, (elemBoxSize.height/2)-(textMeshSize.height/2)-textProps.padding, elemBoxSize.depth+textMeshSize.depth/2);
          elemBox.box.userData.title = textMesh;

      }

      if(infoProps.author.length>0){

        const geometry = createTextGeometry(infoProps.author, font, textProps.size, textProps.height, meshProps.curveSegments, meshProps.bevelEnabled, meshProps.bevelThickness, meshProps.bevelSize, meshProps.bevelOffset, meshProps.bevelSegments);
        geometry.center();
        const textMesh = new THREE.Mesh(geometry, mat);
        const textMeshSize = getGeometrySize(textMesh.geometry);
        elemBox.box.add(textMesh);

        textMesh.position.set(-(elemBoxSize.width/2-textProps.padding)+(textMeshSize.width/2)+textProps.padding, -(elemBoxSize.height/2)+(textMeshSize.height/2)+textProps.padding, elemBoxSize.depth+textMeshSize.depth/2);
        elemBox.box.userData.author = textMesh;

      }

      let timestamp = Number(new Date());
      let date = new Date(timestamp).toString();
      const geometry = createTextGeometry(date, font, textProps.size*0.5, textProps.height, meshProps.curveSegments, meshProps.bevelEnabled, meshProps.bevelThickness, meshProps.bevelSize, meshProps.bevelOffset, meshProps.bevelSegments);
      geometry.center();
      const textMesh = new THREE.Mesh(geometry, mat);
      const textMeshSize = getGeometrySize(textMesh.geometry);
      elemBox.box.add(textMesh);
      textMesh.position.set(-(elemBoxSize.width/2-textProps.padding)+(textMeshSize.width/2)+textProps.padding, -(elemBoxSize.height/2)+(textMeshSize.height/2)+textProps.padding, elemBoxSize.depth+textMeshSize.depth/2);

      parent.add(elemBox.box);

      elemBox.box.userData.date = textMesh;
      if( 'author' in elemBox.box.userData && elemBox.box.userData.author != undefined){
        elemBox.box.userData.author.position.set(elemBox.box.userData.author.position.x, elemBox.box.userData.author.position.y+textMeshSize.height+textProps.padding, elemBox.box.userData.author.position.z)
      }

      elemBox.box.position.set(elemBox.box.position.x, (parent.geometry.parameters.height-spacing)/2-elemBoxSize.height/2-((elemBoxSize.height+spacing)*index), elemBox.box.position.z+parentSize.depth)

    });
  }

};

export function createStaticTextList( parent, boxWidth, boxHeight, author, contentArr, textProps=undefined, meshProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    console.log(text+ " "+index)
    let lConfig = listItemConfig(listConfig.width, listConfig.height, listConfig.depth, listConfig.textProps, listConfig.meshProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, index);
    createStaticTextBox(parent, boxWidth, boxHeight, author, text, lConfig.textProps, lConfig.meshProps, lConfig.animProps, lConfig);
  });

};

export function createStaticScrollableTextList( parent, boxWidth, boxHeight, author, contentArr, textProps=undefined, meshProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    console.log(text+ " "+index)
    let lConfig = listItemConfig(listConfig.width, listConfig.height, listConfig.depth, listConfig.textProps, listConfig.meshProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, index);
    createStaticScrollableTextBox(parent, boxWidth, boxHeight, author, text, lConfig.textProps, lConfig.meshProps, lConfig.animProps, lConfig);
  });

};

export function createMultiTextList( parent, boxWidth, boxHeight, author, contentArr, textProps=undefined, meshProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    console.log(text+ " "+index)
    let lConfig = listItemConfig(listConfig.width, listConfig.height, listConfig.depth, listConfig.textProps, listConfig.meshProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, index);
    createMultiTextBox(parent, boxWidth, boxHeight, author, text, lConfig.textProps, lConfig.meshProps, lConfig.animProps, lConfig);
  });

};

export function createMultiScrollableTextList( parent, boxWidth, boxHeight, author, contentArr, textProps=undefined, meshProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    console.log(text+ " "+index)
    let lConfig = listItemConfig(listConfig.width, listConfig.height, listConfig.depth, listConfig.textProps, listConfig.meshProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, index);
    createMultiScrollableTextBox(parent, boxWidth, boxHeight, author, text, lConfig.textProps, lConfig.meshProps, lConfig.animProps, lConfig);
  });

};

export function createImageContentList( parent, boxWidth, boxHeight, author, contentArr, textProps=undefined, meshProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  parent.userData.listElements = [];

  contentArr.forEach((imgUrl, index) =>{
    let lConfig = listItemConfig(listConfig.width, listConfig.height, listConfig.depth, listConfig.textProps, listConfig.meshProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, index)
    createImageBox(parent, boxWidth, boxHeight, author, imgUrl, lConfig.textProps, lConfig.meshProps, lConfig.animProps, lConfig);
  });

};

export function createGLTFContentList( parent, boxWidth, boxHeight, author, contentArr, textProps=undefined, meshProps=undefined, animProps=undefined, listConfig=undefined, onCreated=undefined ) {
  const listBoxSize = getGeometrySize(parent.geometry);
  parent.userData.listElements = [];

  contentArr.forEach((gltfUrl, index) =>{
    let lConfig = listItemConfig(listConfig.width, listConfig.height, listConfig.depth, listConfig.textProps, listConfig.meshProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, index)
    createGLTFModel(parent, boxWidth, boxHeight, author, gltfUrl, lConfig.textProps, lConfig.meshProps, lConfig.animProps, lConfig);
  });

};

export function addTranslationControl(elem, camera, renderer){

  control = new TransformControls( camera, renderer.domElement );
  control.addEventListener( 'change', render );
  control.attach( elem );


};

