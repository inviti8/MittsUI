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

// Global pool for text geometries
const textGeometryPool = [];
let mergeGeom = new THREE.BufferGeometry();

function createTextGeometry(character, font, size, height, curveSegments, bevelEnabled, bevelThickness, bevelSize, bevelOffset, bevelSegments) {
  // Check if there's a geometry in the pool
  if (textGeometryPool.length > 0) {
    const geometry = textGeometryPool.pop();
    geometry.parameters.text = character; // Reset text content
    return geometry;
  }

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
  mat.color = 0xE91E63;
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

export function textBox(width, height){

  const box = new THREE.Mesh(new THREE.BoxGeometry(width, height, 1), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
  const clipTop = new THREE.Plane( new THREE.Vector3( 0, -1, 0 ), height/2 );
  const clipBottom = new THREE.Plane( new THREE.Vector3( 0, 1, 0 ), height/2 );
  const clipRight = new THREE.Plane( new THREE.Vector3( -1, 0, 0 ), width/2 );
  const clipLeft = new THREE.Plane( new THREE.Vector3( 1, 0, 0 ), width/2 );

  return { 'box': box, 'clipTop': clipTop, 'clipBottom': clipBottom, 'clipLeft': clipLeft, 'clipRight': clipRight }

};

//Generates a single static mesh 
export function createStaticText(scene, textBox, text, mat, letterSpacing = 0, lineSpacing =1, wordSpacing = 1, padding = 1, size = 1, height = 1, curveSegments = 12, bevelEnabled = false, bevelThickness = 10, bevelSize = 8, bevelOffset = 0, bevelSegments = 5) {
  // Load the font
  loader.load('fonts/Generic_Techno_Regular.json', (font) => {
    let lineWidth = -(textBox.geometry.parameters.width / 2) + padding;
    let yPosition = textBox.geometry.parameters.height / 2 - padding;
    let merge = new THREE.BufferGeometry();
    const letterGeometries = [];
    const letterMeshes = [];
    //const letter_mat = new THREE.MeshBasicMaterial({ color: 'blue'});
    let mergeGeom = new THREE.BufferGeometry();
    
    for (let i = 0; i < text.length; i++) {
      const character = text[i];

      if (character === ' ') {
        // Handle spaces by adjusting the x position
        lineWidth += wordSpacing;
      } else {
        const geometry = createTextGeometry(character, font, size, height, curveSegments, bevelEnabled, bevelThickness, bevelSize, bevelOffset, bevelSegments);

        const letterMesh = new THREE.Mesh(geometry);

        // Set the position of the letter
        letterMesh.position.x = lineWidth;
        letterMesh.position.y = yPosition;
        letterMeshes.push(letterMesh);

        // Calculate the width of the letter geometry
        const { width } = getGeometrySize(geometry);
        let lWidth = width * letterSpacing;

        // Check if the letter is within the bounds of the textBox mesh
        if (lineWidth + lWidth <= textBox.geometry.parameters.width / 2 - padding) {
          // Add the letter to the text scene
          //textBox.add(letterMesh);
          letterGeometries.push(geometry);
        }

        // Update lineWidth
        lineWidth += letterSpacing + width + padding;
      }

      // Check if lineWidth exceeds textBox width - padding
      if (lineWidth > textBox.geometry.parameters.width / 2 - padding) {
        lineWidth = -(textBox.geometry.parameters.width / 2) + padding; // Reset x position to the upper-left corner
        yPosition -= lineSpacing; // Move to the next line
      }
    }

    for(let I = 0; I < letterGeometries.length; I++){
        letterGeometries[I].translate(letterMeshes[I].position.x, letterMeshes[I].position.y, letterMeshes[I].position.z);
    }

    for(let I = 0; I < letterMeshes.length; I++){
        letterMeshes[I].geometry.dispose();
        letterMeshes[I].material.dispose();
    }

    // Merge the individual letter geometries into a single buffer geometry
    const mergedGeometry = BufferGeometryUtils.mergeGeometries(letterGeometries);

    // Create a mesh from the merged geometry
    const mergedMesh = new THREE.Mesh(mergedGeometry, mat);

    // Add the merged mesh to the textBox
    scene.add(mergedMesh);

  });
}

//generates a mesh for each individual letter in text
export function createMultiText(scene, textBox, text, mat, letterSpacing = 0, lineSpacing = 1, wordSpacing = 1, padding = 1, size = 1, height = 1, curveSegments = 12, bevelEnabled = false, bevelThickness = 10, bevelSize = 8, bevelOffset = 0, bevelSegments = 5) {
  // Load the font
  loader.load('fonts/Generic_Techno_Regular.json', (font) => {
    let lineWidth = -(textBox.geometry.parameters.width / 2) + padding;
    let yPosition = textBox.geometry.parameters.height / 2 - padding;
    let merge = new THREE.BufferGeometry();
    const letterGeometries = [];
    const letterMeshes = [];
    
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
        let lWidth = width * letterSpacing;

        // Check if the letter is within the bounds of the textBox mesh
        if (lineWidth + lWidth <= textBox.geometry.parameters.width / 2 - padding) {
          // Add the letter to the text scene
          textBox.add(letterMesh);
          letterGeometries.push(geometry);
        }

        // Update lineWidth
        lineWidth += letterSpacing + width + padding;
      }

      // Check if lineWidth exceeds textBox width - padding
      if (lineWidth > textBox.geometry.parameters.width / 2 - padding) {
        lineWidth = -(textBox.geometry.parameters.width / 2) + padding; // Reset x position to the upper-left corner
        yPosition -= lineSpacing; // Move to the next line
      }
    }

  });
}

export function createStaticTextBox(scene, boxWidth, boxHeight, text, letterSpacing = 0, lineSpacing, wordSpacing = 1, padding = 1, size = 1, height = 1, curveSegments = 12, bevelEnabled = false, bevelThickness = 10, bevelSize = 8, bevelOffset = 0, bevelSegments = 5) {
  // Load the font
  loader.load('fonts/Generic_Techno_Regular.json', (font) => {
    const txtBox = textBox(boxWidth, boxHeight);
    let lineWidth = -(txtBox.box.geometry.parameters.width / 2) + padding;
    let yPosition = txtBox.box.geometry.parameters.height / 2 - padding;
    let merge = new THREE.BufferGeometry();
    const letterGeometries = [];
    const letterMeshes = [];
    const mat = clipMaterial([txtBox.clipTop, txtBox.clipBottom, txtBox.clipLeft, txtBox.clipRight])
    
    for (let i = 0; i < text.length; i++) {
      const character = text[i];

      if (character === ' ') {
        // Handle spaces by adjusting the x position
        lineWidth += wordSpacing;
      } else {
        const geometry = createTextGeometry(character, font, size, height, curveSegments, bevelEnabled, bevelThickness, bevelSize, bevelOffset, bevelSegments);

        const letterMesh = new THREE.Mesh(geometry);

        // Set the position of the letter
        letterMesh.position.x = lineWidth;
        letterMesh.position.y = yPosition;
        letterMeshes.push(letterMesh);

        // Calculate the width of the letter geometry
        const { width } = getGeometrySize(geometry);
        let lWidth = width * letterSpacing;

        // Check if the letter is within the bounds of the txtBox mesh
        if (lineWidth + lWidth <= txtBox.box.geometry.parameters.width / 2 - padding) {
          letterGeometries.push(geometry);
        }

        // Update lineWidth
        lineWidth += letterSpacing + width + padding;
      }

      // Check if lineWidth exceeds txtBox width - padding
      if (lineWidth > txtBox.box.geometry.parameters.width / 2 - padding) {
        lineWidth = -(txtBox.box.geometry.parameters.width / 2) + padding; // Reset x position to the upper-left corner
        yPosition -= lineSpacing; // Move to the next line
      }
    }

    for(let I = 0; I < letterGeometries.length; I++){
        letterGeometries[I].translate(letterMeshes[I].position.x, letterMeshes[I].position.y, letterMeshes[I].position.z);
    }

    for(let I = 0; I < letterMeshes.length; I++){
        letterMeshes[I].geometry.dispose();
        letterMeshes[I].material.dispose();
    }

    // Merge the individual letter geometries into a single buffer geometry
    const mergedGeometry = BufferGeometryUtils.mergeGeometries(letterGeometries);

    // Create a mesh from the merged geometry
    const mergedMesh = new THREE.Mesh(mergedGeometry, mat);

    // Add the merged mesh to the textBox
    scene.add(mergedMesh);

  });
}

export function createMultiTextBox(scene, boxWidth, boxHeight, text, letterSpacing = 0, lineSpacing, wordSpacing = 1, padding = 1, size = 1, height = 1, curveSegments = 12, bevelEnabled = false, bevelThickness = 10, bevelSize = 8, bevelOffset = 0, bevelSegments = 5) {
  // Load the font
  loader.load('fonts/Generic_Techno_Regular.json', (font) => {
    const txtBox = textBox(boxWidth, boxHeight);
    let lineWidth = -(txtBox.box.geometry.parameters.width / 2) + padding;
    let yPosition = txtBox.box.geometry.parameters.height / 2 - padding;
    let merge = new THREE.BufferGeometry();
    const letterGeometries = [];
    const letterMeshes = [];
    const mat = clipMaterial([txtBox.clipTop, txtBox.clipBottom, txtBox.clipLeft, txtBox.clipRight])
    
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
        let lWidth = width * letterSpacing;

        // Check if the letter is within the bounds of the textBox mesh
        if (lineWidth + lWidth <= txtBox.box.geometry.parameters.width / 2 - padding) {
          // Add the letter to the text scene
          txtBox.box.add(letterMesh);
          letterGeometries.push(geometry);
        }

        // Update lineWidth
        lineWidth += letterSpacing + width + padding;
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
