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

export function quad(sizeX, sizeY, x, y){
  const geometries = [];
  const originX = 0;
  const originY = 0;
  
  const geom0 = new THREE.Geometry();
  const v1 = new THREE.Vector3(originX+x,originY+y,0);
  const v2 = new THREE.Vector3(originX+x+sizeX,originY+y,0);
  const v3 = new THREE.Vector3(originX+x+sizeX,originY+y+sizeY,0);
    
  const geom1 = new THREE.Geometry();
  const v4 = new THREE.Vector3(originX+x,originY+y,0);
  const v5 = new THREE.Vector3(originX+x+sizeX,originY+y+sizeY,0);
  const v6 = new THREE.Vector3(originX+x,originY+y+sizeY,0);

  const triangle0 = new THREE.Triangle( v1, v2, v3 );
  const triangle1 = new THREE.Triangle( v4, v5, v6 );
  const normal0 = triangle0.normal();
  const normal1 = triangle1.normal();
  
  geom0.vertices.push(triangle0.a);
  geom0.vertices.push(triangle0.b);
  geom0.vertices.push(triangle0.c);

  geom1.vertices.push(triangle1.a);
  geom1.vertices.push(triangle1.b);
  geom1.vertices.push(triangle1.c);
  
  geom0.faces.push( new THREE.Face3( 0, 1, 2, normal0 ) );
  geom1.faces.push( new THREE.Face3( 0, 1, 2, normal1 ) );

  geometries.push(geom0);
  geometries.push(geom1);

  const quad = BufferGeometryUtils.mergeGeometries(geometries);

}

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

export function createStaticTextBox(scene, boxWidth, boxHeight, text, fontPath, onCreated, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, meshProps=undefined ) {
  // Load the font
  loader.load(fontPath, (font) => {
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
    const mergedGeometry = BufferGeometryUtils.mergeGeometries(letterGeometries);

    // Create a mesh from the merged geometry
    const mergedMesh = new THREE.Mesh(mergedGeometry, mat);
    const gSize = getGeometrySize(mergedGeometry);
    mergedMesh.userData.initialPosition = txtBox.box.geometry.parameters.height / 2 - gSize.height / 2;
    mergedMesh.userData.maxScroll = gSize.height / 2-txtBox.box.geometry.parameters.height/2;
    mergedMesh.userData.minScroll = mergedMesh.userData.initialPositionY+mergedMesh.userData.maxScroll+padding;
    mergedMesh.userData.padding = padding;
    mergedMesh.userData.settleThreshold = gSize.height / 50;
    scene.add(txtBox.box);
    txtBox.box.add(mergedMesh);

  });
}

export function createStaticScrollableTextBox(scene, boxWidth, boxHeight, text, fontPath, onCreated, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, meshProps=undefined) {
  // Load the font
  loader.load(fontPath, (font) => {
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
    mergedMesh.userData.minScroll = mergedMesh.userData.initialPositionY+mergedMesh.userData.maxScroll+padding;
    mergedMesh.userData.padding = padding;
    mergedMesh.userData.settleThreshold = gSize.height/50;
    
    onCreated(txtBox.box);
  });
}

export function createMultiTextBox(scene, boxWidth, boxHeight, text, fontPath, onCreated, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, meshProps=undefined) {
  // Load the font
  loader.load(fontPath, (font) => {
    const txtBox = textBox(boxWidth, boxHeight, padding, clipped);
    let lineWidth = -(txtBox.box.geometry.parameters.width / 2 - padding);
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

         if(meshProps == undefined){
          meshProps = meshProperties()
        }
        const geometry = createTextGeometry(character, font, size, height, meshProps.curveSegments, meshProps.bevelEnabled, meshProps.bevelThickness, meshProps.bevelSize, meshProps.bevelOffset, meshProps.bevelSegments);
        geometry.translate(lineWidth, yPosition, 0);

        const letterMesh = new THREE.Mesh(geometry, mat);

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
  });
}

export function createMultiScrollableTextBox(scene, boxWidth, boxHeight, text, fontPath, onCreated, clipped=true, letterSpacing=1, lineSpacing=1, wordSpacing=1, padding=1, size=1, height=1, meshProps=undefined) {
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

        geometry.translate(lineWidth, yPosition, 0);
        cube.translate((size/2)+lineWidth, (size/2)+yPosition, 0);

        const letterMesh = new THREE.Mesh(geometry, mat);

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
    const bSize = getGeometrySize(txtBox.box.geometry);
    const gSize = getGeometrySize(mergedGeometry);
    mergedMesh.position.set(0, -padding, 0);
    mergedMesh.userData.initialPositionY = bSize.height/2 - gSize.height/2;
    mergedMesh.userData.maxScroll = gSize.height/2 - bSize.height/2;
    mergedMesh.userData.minScroll = mergedMesh.userData.initialPositionY+mergedMesh.userData.maxScroll+padding;
    mergedMesh.userData.padding = padding;
    mergedMesh.userData.settleThreshold = gSize.height/50;

    letterMeshes.forEach((m, i) => {
      mergedMesh.add(m);
    })

    scene.add(txtBox.box);
    onCreated(txtBox.box);
  });
}
