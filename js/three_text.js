import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

const loader = new FontLoader();

function getGeometrySize(geometry) {
  const bbox = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
  const width = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;
  return { width, height };
}

// Global pool for text geometries
const textGeometryPool = [];

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

export function createLabel(parent, text, letterSpacing = 0, lineSpacing, wordSpacing = 1, padding = 1, size = 1, height = 1, curveSegments = 12, bevelEnabled = false, bevelThickness = 10, bevelSize = 8, bevelOffset = 0, bevelSegments = 5) {
  // Load the font
  loader.load('fonts/Generic_Techno_Regular.json', (font) => {
    let lineWidth = -(parent.geometry.parameters.width / 2) + padding;
    let yPosition = parent.geometry.parameters.height / 2 - padding;

    for (let i = 0; i < text.length; i++) {
      const character = text[i];

      if (character === ' ') {
        // Handle spaces by adjusting the x position
        lineWidth += wordSpacing;
      } else {
        const geometry = createTextGeometry(character, font, size, height, curveSegments, bevelEnabled, bevelThickness, bevelSize, bevelOffset, bevelSegments);

        const material = new THREE.MeshBasicMaterial({ color: 'blue' });
        const letterMesh = new THREE.Mesh(geometry, material);

        // Set the position of the letter
        letterMesh.position.x = lineWidth;
        letterMesh.position.y = yPosition;

        // Calculate the width of the letter geometry
        const { width } = getGeometrySize(geometry);
        let lWidth = width * letterSpacing;

        // Check if the letter is within the bounds of the parent mesh
        if (lineWidth + lWidth <= parent.geometry.parameters.width / 2 - padding) {
          // Add the letter to the text scene
          parent.add(letterMesh);
        }

        // Update lineWidth
        lineWidth += letterSpacing + width + padding;
      }

      // Check if lineWidth exceeds parent width - padding
      if (lineWidth > parent.geometry.parameters.width / 2 - padding) {
        lineWidth = -(parent.geometry.parameters.width / 2) + padding; // Reset x position to the upper-left corner
        yPosition -= lineSpacing; // Move to the next line
      }
    }

  });
}
