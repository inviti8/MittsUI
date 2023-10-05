import * as THREE from 'three';
import { gsap } from "gsap";
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

const loader = new FontLoader();
let posVar = new THREE.Vector3();
let scaleVar = new THREE.Vector3();
let draggable = [];

function randomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

export function animationConfig(anim='FADE', action='IN', duration=0.07, ease="power1.inOut", delay=0.007, onComplete=undefined){
  return {
    'anim': anim,
    'action': action,
    'duration': duration,
    'ease': ease,
    'delay': delay,
    'onComplete': onComplete
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

}

function getGeometrySize(geometry) {
  const bbox = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
  const width = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;
  return { width, height };
}

function createTextGeometry(character, font, size, height, curveSegments, bevelEnabled, bevelThickness, bevelSize, bevelOffset, bevelSegments) {
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
}

function baseClipMaterial(){
  const mat = new THREE.MeshBasicMaterial();
  mat.color.set(Math.random() * 0xff00000 - 0xff00000);
  mat.stencilRef = 0;
  mat.stencilFunc = THREE.NotEqualStencilFunc;
  mat.stencilFail = THREE.ReplaceStencilOp;
  mat.stencilZFail = THREE.ReplaceStencilOp;
  mat.stencilZPass = THREE.ReplaceStencilOp;

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

export function textBox(width, height, padding, clipped=true){

  const box = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.01), new THREE.MeshBasicMaterial({ color: Math.random() * 0xff00000 - 0xff00000 }));
  
  let result = { 'box': box };

  if(clipped){
    const clipTop = new THREE.Plane( new THREE.Vector3( 0, -1, 0 ), height/2-padding );
    const clipBottom = new THREE.Plane( new THREE.Vector3( 0, 1, 0 ), height/2-padding );
    const clipRight = new THREE.Plane( new THREE.Vector3( -1, 0, 0 ), width/2+padding );
    const clipLeft = new THREE.Plane( new THREE.Vector3( 1, 0, 0 ), width/2-padding );

    result = { 'box': box, 'clipTop': clipTop, 'clipBottom': clipBottom, 'clipLeft': clipLeft, 'clipRight': clipRight };
  }

  return result

};

export function meshProperties(curveSegments=12, bevelEnabled=false, bevelThickness=10, bevelSize=8, bevelOffset=0, bevelSegments=5){
  return {
    'curveSegments': curveSegments,
    'bevelEnabled': bevelEnabled,
    'bevelThickness': bevelThickness,
    'bevelSize': bevelSize,
    'bevelOffset': bevelOffset,
    'bevelSegments': bevelSegments
  }
}

function setMergedMeshUserData(boxSize, geomSize, padding, mergedMesh){
  mergedMesh.userData.initialPositionY = boxSize.height/2 - geomSize.height/2;
  mergedMesh.userData.maxScroll = geomSize.height/2 - boxSize.height/2;
  mergedMesh.userData.minScroll = mergedMesh.userData.initialPositionY+mergedMesh.userData.maxScroll+padding;
  mergedMesh.userData.padding = padding;
  mergedMesh.userData.settleThreshold = geomSize.height/50;
}

export function createMergedTextGeometry(txtBox, font, boxWidth, boxHeight, text, fontPath, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, meshProps=undefined, animConfig=undefined) {
    let lineWidth = -(txtBox.box.geometry.parameters.width / 2 - padding);
    let yPosition = txtBox.box.geometry.parameters.height / 2 - padding;
    const letterGeometries = [];

    let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});
    if(clipped){
      mat = clipMaterial([txtBox.clipTop, txtBox.clipBottom, txtBox.clipLeft, txtBox.clipRight]);
    }
    
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

        // Check if the letter is within the bounds of the txtBox mesh
        if (width <= txtBox.box.geometry.parameters.width / 2 - padding) {
          letterGeometries.push(geometry);
        }

        // Update lineWidth
        lineWidth += width;
      }

      // Check if lineWidth exceeds txtBox width - padding
      if (lineWidth > txtBox.box.geometry.parameters.width / 2 - padding) {
        lineWidth = -(txtBox.box.geometry.parameters.width / 2) + padding; // Reset x position to the upper-left corner
        yPosition -= lineSpacing; // Move to the next line
      }
    }

    // Merge the individual letter geometries into a single buffer geometry
    return BufferGeometryUtils.mergeGeometries(letterGeometries);
}

export function createStaticTextBox(scene, boxWidth, boxHeight, text, fontPath, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, meshProps=undefined, animConfig=undefined) {
  // Load the font
  loader.load(fontPath, (font) => {
    const txtBox = textBox(boxWidth, boxHeight, padding, clipped);

    let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});
    if(clipped){
      mat = clipMaterial([txtBox.clipTop, txtBox.clipBottom, txtBox.clipLeft, txtBox.clipRight]);
    }
    
    // Merge the individual letter geometries into a single buffer geometry
    let mergedGeometry = createMergedTextGeometry(txtBox, font, boxWidth, boxHeight, text, fontPath, clipped, letterSpacing, lineSpacing, wordSpacing, padding, size, height, meshProps, animConfig);
    // Create a mesh from the merged geometry
    const mergedMesh = new THREE.Mesh(mergedGeometry, mat);
    if(animConfig!=undefined){
      mergedMesh.material.transparent=true;
      mergedMesh.material.opacity=0;
    }
    const boxSize = getGeometrySize(txtBox.box.geometry);
    const geomSize = getGeometrySize(mergedGeometry);
    setMergedMeshUserData(boxSize, geomSize, padding, mergedMesh);
    scene.add(txtBox.box);
    txtBox.box.add(mergedMesh);

    if(animConfig!=undefined){
      //anim, action, duration, ease, delay, onComplete
      txtAnimation(txtBox.box, mergedMesh, animConfig.anim, animConfig.action, animConfig.duration, animConfig.ease, animConfig.delay, 0, animConfig.callback);
    }

  });
}

export function createStaticScrollableTextBox(scene, boxWidth, boxHeight, text, fontPath, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, meshProps=undefined, animConfig=undefined) {
  // Load the font
  loader.load(fontPath, (font) => {
    const txtBox = textBox(boxWidth, boxHeight, padding, clipped);

    let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});
    if(clipped){
      mat = clipMaterial([txtBox.clipTop, txtBox.clipBottom, txtBox.clipLeft, txtBox.clipRight]);
    }
    // Merge the individual letter geometries into a single buffer geometry
    let mergedGeometry = createMergedTextGeometry(txtBox, font, boxWidth, boxHeight, text, fontPath, clipped, letterSpacing, lineSpacing, wordSpacing, padding, size, height, meshProps, animConfig);

    // Create a mesh from the merged geometry
    const mergedMesh = new THREE.Mesh(mergedGeometry, mat);
    if(animConfig!=undefined){
      mergedMesh.material.transparent=true;
      mergedMesh.material.opacity=0;
    }
    const boxSize = getGeometrySize(txtBox.box.geometry);
    const geomSize = getGeometrySize(mergedGeometry);
    mergedMesh.position.set(0, -padding, 0);
    scene.add(txtBox.box);
    txtBox.box.add(mergedMesh);
    setMergedMeshUserData(boxSize, geomSize, padding, mergedMesh);
    mergedMesh.userData.draggable=true;
    
    draggable.push(mergedMesh);
    if(animConfig!=undefined){
      //anim, action, duration, ease, delay, onComplete
      txtAnimation(txtBox.box, mergedMesh, animConfig.anim, animConfig.action, animConfig.duration, animConfig.ease, animConfig.delay, 0, animConfig.callback);
    }
  });
}

export function createMultiTextBox(scene, boxWidth, boxHeight, text, fontPath, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, meshProps=undefined, animConfig=undefined) {
  // Load the font
  loader.load(fontPath, (font) => {
    const txtBox = textBox(boxWidth, boxHeight, padding, clipped);
    let lineWidth = -(txtBox.box.geometry.parameters.width / 2 - padding);
    let yPosition = txtBox.box.geometry.parameters.height / 2 - padding*2;
    let merge = new THREE.BufferGeometry();
    const letterGeometries = [];
    const letterMeshes = [];

    let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});
    if(clipped){
      mat = clipMaterial([txtBox.clipTop, txtBox.clipBottom, txtBox.clipLeft, txtBox.clipRight]);
    }
    
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

        const letterMesh = new THREE.Mesh(geometry, mat);
        letterMesh.position.set(lineWidth, yPosition, 0);
        if(animConfig!=undefined){
          letterMesh.material.transparent=true;
          letterMesh.material.opacity=0;
        }

        // Calculate the width of the letter geometry
        let { width } = getGeometrySize(geometry);
        width+=letterSpacing;

        // Check if the letter is within the bounds of the txtBox mesh
        if (width <= txtBox.box.geometry.parameters.width / 2 - padding) {
          txtBox.box.add(letterMesh);
          letterMeshes.push(letterMesh);
          letterGeometries.push(geometry);
        }

        // Update lineWidth
        lineWidth += width;
      }

      // Check if lineWidth exceeds txtBox width - padding
      if (lineWidth > txtBox.box.geometry.parameters.width / 2 - padding) {
        lineWidth = -(txtBox.box.geometry.parameters.width / 2) + padding; // Reset x position to the upper-left corner
        yPosition -= lineSpacing; // Move to the next line
      }
    }

    scene.add(txtBox.box)
    if(animConfig!=undefined){
      //anim, action, duration, ease, delay, onComplete
      multiAnimation(txtBox.box, txtBox.box.children, animConfig.anim, animConfig.action, animConfig.duration, animConfig.ease, animConfig.delay, animConfig.callback);
    }
  });
}

export function createMultiScrollableTextBox(scene, boxWidth, boxHeight, text, fontPath, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, meshProps=undefined, animConfig=undefined) {
  // Load the font
  loader.load(fontPath, (font) => {
    const txtBox = textBox(boxWidth, boxHeight, padding, clipped);
    let lineWidth = -(txtBox.box.geometry.parameters.width / 2 - padding);
    let yPosition = txtBox.box.geometry.parameters.height / 2 - padding;
    let merge = new THREE.BufferGeometry();
    const letterGeometries = [];
    const letterMeshes = [];
    const cubes = [];

    let mat = new THREE.MeshBasicMaterial({color: Math.random() * 0xff00000 - 0xff00000});
    if(clipped){
      mat = clipMaterial([txtBox.clipTop, txtBox.clipBottom, txtBox.clipLeft, txtBox.clipRight]);
    }
    
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
        const cube = new THREE.BoxGeometry(size*2, size*2, height);

        //geometry.translate(lineWidth, yPosition, 0);
        cube.translate((size/2)+lineWidth, (size/2)+yPosition, 0);

        const letterMesh = new THREE.Mesh(geometry, mat);
        letterMesh.position.set(lineWidth, yPosition, 0);

        if(animConfig!=undefined){
          letterMesh.material.transparent=true;
          letterMesh.material.opacity=0;
        }

        // Calculate the width of the letter geometry
        let { width } = getGeometrySize(geometry);
        width+=letterSpacing;

        // Check if the letter is within the bounds of the txtBox mesh
        if (width <= txtBox.box.geometry.parameters.width / 2 - padding) {
          //txtBox.box.add(letterMesh);
          letterMeshes.push(letterMesh);
          letterGeometries.push(geometry);
          cubes.push(cube);
        }
        // Update lineWidth
        lineWidth += width;
      }

      // Check if lineWidth exceeds txtBox width - padding
      if (lineWidth > txtBox.box.geometry.parameters.width / 2 - padding) {
        lineWidth = -(txtBox.box.geometry.parameters.width / 2) + padding; // Reset x position to the upper-left corner
        yPosition -= lineSpacing; // Move to the next line
      }
    }
    const mergedGeometry = BufferGeometryUtils.mergeGeometries(cubes);
    const mergedMesh = new THREE.Mesh(mergedGeometry, transparentMaterial());
    txtBox.box.add(mergedMesh);
    const boxSize = getGeometrySize(txtBox.box.geometry);
    const geomSize = getGeometrySize(mergedGeometry);
    mergedMesh.position.set(0, -padding, 0);
    setMergedMeshUserData(boxSize, geomSize, padding, mergedMesh);
    mergedMesh.userData.draggable=true;
    letterMeshes.forEach((m, i) => {
      mergedMesh.add(m);
    })
    scene.add(txtBox.box);
    draggable.push(mergedMesh);
    if(animConfig!=undefined){
      //anim, action, duration, ease, delay, onComplete
      multiAnimation(txtBox.box, mergedMesh.children, animConfig.anim, animConfig.action, animConfig.duration, animConfig.ease, animConfig.delay, animConfig.callback);
    }
    //TEST
    // let aConfig = animationConfig('SLIDE_RIGHT', 'OUT', 2, 'back.inOut', 0)
    // setTimeout(() => {
    //   multiAnimation(txtBox.box, mergedMesh.children, aConfig.anim, aConfig.action, aConfig.duration, aConfig.ease, aConfig.delay, aConfig.callback);
    // }, "4000");
  });
  
}