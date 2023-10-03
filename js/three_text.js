import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

const loader = new FontLoader();


function getGeometrySize(geometry) {
  const bbox = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
  const width = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;
  return { width, height };
}

function createTextGeometry(character, font, size, height, curveSegments, bevelEnabled, bevelThickness, bevelSize, bevelOffset, bevelSegments) {

  // Create a new geometry if the pool is empty
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

export function createStaticTextBox(scene, boxWidth, boxHeight, text, fontPath, onCreated, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, curveSegments=12, bevelEnabled=false, bevelThickness=10, bevelSize=8, bevelOffset=0, bevelSegments=5 ) {
  // Load the font
  loader.load(fontPath, (font) => {
    const xPad = boxWidth*padding;
    const yPad = boxHeight*padding;
    const txtBox = textBox(boxWidth, boxHeight, padding, clipped);
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
        const geometry = createTextGeometry(character, font, size, height, curveSegments, bevelEnabled, bevelThickness, bevelSize, bevelOffset, bevelSegments);
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
    const mergedGeometry = BufferGeometryUtils.mergeGeometries(letterGeometries);

    // Create a mesh from the merged geometry
    const mergedMesh = new THREE.Mesh(mergedGeometry, mat);
    const gSize = getGeometrySize(mergedGeometry);
    mergedMesh.userData.initialPosition = txtBox.box.geometry.parameters.height / 2 - gSize.height / 2;
    mergedMesh.userData.maxScroll = gSize.height / 2-txtBox.box.geometry.parameters.height/2;
    mergedMesh.userData.settleThreshold = gSize.height / 50;
    scene.add(txtBox.box);
    txtBox.box.add(mergedMesh);

  });
}

export function createStaticScrollableTextBox(scene, boxWidth, boxHeight, text, fontPath, onCreated, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, curveSegments=12, bevelEnabled=false, bevelThickness=10, bevelSize=8, bevelOffset=0, bevelSegments=5 ) {
  // Load the font
  loader.load(fontPath, (font) => {
    const xPad = boxWidth*padding;
    const yPad = boxHeight*padding;
    const txtBox = textBox(boxWidth, boxHeight, padding, clipped);
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
        const geometry = createTextGeometry(character, font, size, height, curveSegments, bevelEnabled, bevelThickness, bevelSize, bevelOffset, bevelSegments);
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
    const mergedGeometry = BufferGeometryUtils.mergeGeometries(letterGeometries);

    // Create a mesh from the merged geometry
    const mergedMesh = new THREE.Mesh(mergedGeometry, mat);
    const bSize = getGeometrySize(txtBox.box.geometry);
    const gSize = getGeometrySize(mergedGeometry);
    mergedMesh.position.set(0, -padding, 0);
    scene.add(txtBox.box);
    txtBox.box.add(mergedMesh);
    mergedMesh.userData.initialPositionY = bSize.height/2 - gSize.height/2;
    mergedMesh.userData.maxScroll = gSize.height/2 - bSize.height/2;
    mergedMesh.userData.settleThreshold = gSize.height/50;
    
    console.log(txtBox.box)
    onCreated(txtBox.box);
  });
}

export function createMultiTextBox(scene, boxWidth, boxHeight, text, fontPath, onCreated, clipped=true, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, curveSegments=12, bevelEnabled=false, bevelThickness=10, bevelSize=8, bevelOffset=0, bevelSegments=5) {
  // Load the font
  loader.load(fontPath, (font) => {
    const txtBox = textBox(boxWidth, boxHeight, padding, clipped);
    let lineWidth = -(txtBox.box.geometry.parameters.width / 2) - padding;
    let yPosition = txtBox.box.geometry.parameters.height / 2 - padding;
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
        const geometry = createTextGeometry(character, font, size, height, curveSegments, bevelEnabled, bevelThickness, bevelSize, bevelOffset, bevelSegments);

        const letterMesh = new THREE.Mesh(geometry, mat);

        // Set the position of the letter
        letterMesh.position.x = lineWidth;
        letterMesh.position.y = yPosition;
        letterMeshes.push(letterMesh);

        // Calculate the width of the letter geometry
        const { width } = getGeometrySize(geometry);
        width+=letterSpacing;

        // Check if the letter is within the bounds of the txtBox mesh
        if (width <= txtBox.box.geometry.parameters.width / 2 - padding) {
          txtBox.box.add(letterMesh);
          letterGeometries.push(geometry);
        }

        // Update lineWidth
        lineWidth += width;
      }

      // Check if lineWidth exceeds textBox width - padding
      if (lineWidth > txtBox.box.geometry.parameters.width / 2 - padding) {
        lineWidth = -(txtBox.box.geometry.parameters.width / 2) + padding; // Reset x position to the upper-left corner
        yPosition -= lineSpacing; // Move to the next line
      }
    }

    scene.add(txtBox.box)
  });
}
