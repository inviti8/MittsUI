import * as THREE from 'three';
import * as editor from './js/editor_pane';
import views from './views.json' assert {type: 'json'};

// Initialize Three.js scene with an orthographic camera
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
const cubeSize = 100; // Use a relative size for the cube
const backBtnSize = cubeSize*0.1
//grid vars
const GRID = {
  rows: 2,
  columns: 3,
};
var { numRows, numCols } = calculateGridSize();
var spacing = 0.1; // Adjust this for spacing between cubes
var totalWidth = numCols * (cubeSize + spacing) - spacing;
var totalHeight = numRows * (cubeSize + spacing) - spacing;

editor.bindGrid(GRID);

const viewGrps = {};
const activeView = Object.keys(views)[0];

Object.keys(views).forEach((v, idx) => {
    viewGrps[v] = {'grp':new THREE.Group(), 'cubes':[], 'cubePos':[], 'backBtns':[]}
});

// Create an array to store cubes
const cubeGrp = new THREE.Group();
scene.add(viewGrps[activeView].grp);

// Initialize the mouse vector
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

// Variables to store the current and target camera positions
const startCameraPosition = new THREE.Vector3();
const currentCameraPosition = new THREE.Vector3();
const targetCameraPosition = new THREE.Vector3();

const startContainerScale = new THREE.Vector3(1, 1, 1);
const currentContainerScale = new THREE.Vector3(1, 1, 1);
var targetContainerScale = new THREE.Vector3(1.8, 1.8, 1.8);

var activeIndex = -1;
const containerOffset = new THREE.Vector3(0, 0, -1);
var doScale = false;


// Function to smoothly interpolate camera position
function lerpCameraPosition(alpha) {
    currentCameraPosition.lerp(targetCameraPosition, alpha);
    const groupScale = viewGrps[activeView].grp.scale;
    camera.position.copy(currentCameraPosition).multiply(groupScale);
    camera.position.z = 100;
}

function lerpContainer(alpha) {
	//initial reset of all but selected containers
	viewGrps[activeView].cubes.forEach((cube, idx) => {
		if (idx != activeIndex) {
			cube.scale.lerp(startContainerScale, alpha);
		}
	})

	//switch to scale only the selected container
	if(doScale){
		viewGrps[activeView].cubes[activeIndex].scale.lerp(targetContainerScale, alpha);

	}else{
		viewGrps[activeView].cubes.forEach((cube, idx) => {
			cube.scale.lerp(startContainerScale, alpha);
		})
	}
}

// Function to handle mouse click events
function onMouseClick(event) {
    // Calculate mouse position in normalized device coordinates (NDC)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting with the ray
    const intersectsContainer = raycaster.intersectObjects(viewGrps[activeView].cubes);
    const intersectsBackBtns = raycaster.intersectObjects(viewGrps[activeView].backBtns);

    if (intersectsContainer.length > 0 && intersectsBackBtns.length == 0) {
    	doScale = true;
        const clickedCube = intersectsContainer[0].object;
        const cubeIndex = viewGrps[activeView].cubes.indexOf(clickedCube);
        activeIndex = cubeIndex;
        //console.log(`Clicked Cube Index: ${cubeIndex}`);
        //console.log(`Cube Position: x: ${clickedCube.position.x}, y: ${clickedCube.position.y}`);
        targetCameraPosition.copy(clickedCube.position);
    }else{
    	doScale = false;
    	targetCameraPosition.copy(startCameraPosition);
    }
}

window.addEventListener('click', onMouseClick, false);

// Function to calculate the aspect ratio
function calculateAspectRatio() {
    return window.innerWidth / window.innerHeight;
}

// Function to determine the number of rows and columns based on window width
function calculateGridSize() {
    console.log(window.innerWidth)
    if (window.innerWidth < 600) {
        targetContainerScale = new THREE.Vector3(1.2, 1.2, 1.2);
        return { numRows: 6, numCols: 1 };
    } else if (window.innerWidth < 900) {
        targetContainerScale = new THREE.Vector3(1.5, 1.5, 1.5);
        return { numRows: 3, numCols: 2 };
    } else {
        targetContainerScale = new THREE.Vector3(1.8, 1.8, 1.8);
        return { numRows: 2, numCols: 3 };
    }
}

// Create the camera with a consistent aspect ratio
const aspectRatio = calculateAspectRatio();
const camera = new THREE.OrthographicCamera(
    (cubeSize * aspectRatio) / -2,
    (cubeSize * aspectRatio) / 2,
    cubeSize / 2,
    cubeSize / -2,
    0.1,
    10000
);

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

function createCube(sizeX, sizeY){
    const geometry = new THREE.BoxGeometry(sizeX, sizeY, 1);
    const material = new THREE.MeshBasicMaterial({ color: Math.random() * 0xffffff , depthTest:true, transparent:true});
    const cube = new THREE.Mesh(geometry, material);

    return cube
}

// Function to create a cube with dynamic size
function createGridCube() {
    return createCube(cubeSize, cubeSize);
}

function createMinimizeCube(parent, pSizeX, pSizeY) {
    const cube = createCube(backBtnSize, backBtnSize);
    parent.add(cube);
    cube.position.set(-((pSizeX / 2) - (backBtnSize / 2)), (pSizeY / 2 ) - (backBtnSize / 2), 0);
    return createCube(backBtnSize, backBtnSize);
}

// Function to create cubes for the grid
function createGrid() {

    Object.keys(views).forEach((v, idx) => {
        var index = 0;
        console.log(v)
        for (let col = 0; col < numCols; col++) {
            for (let row = 0; row < numRows; row++) {
                const cube = createGridCube();
                const back = createMinimizeCube(cube, cubeSize, cubeSize)

                viewGrps[v].cubes.push(cube);
                viewGrps[v].cubePos.push(cube.position)
                viewGrps[v].backBtns.push(back);
                viewGrps[v].grp.add(cube);   
            }
        }
        
    });
}

createGrid(); // Create and add cubes to the scene
onWindowResize();

// Set up camera and render loop
camera.position.z = 100;
camera.aspect = aspectRatio; // Update the camera's aspect ratio
camera.updateProjectionMatrix(); // Update the camera's projection matrix
//set initial scaling on group after populated
Object.keys(views).forEach((v, idx) => {
    viewGrps[v].grp.scale.set(0.5, 0.5, 0.5);
})


function handleMouseWheel(event) {

    // Check the direction of the mouse wheel (up or down)
    const delta = Math.sign(event.deltaY);

    // Increment or decrement the current index based on the wheel direction
    activeIndex += delta;

    // Ensure the index stays within the bounds of the array
    if (activeIndex < 0) {
        activeIndex = 0;
    } else if (activeIndex >= viewGrps[activeView].cubes.length) {
        activeIndex = items.length - 1;
    }

    //console.log(activeIndex)

    targetCameraPosition.copy(viewGrps[activeView].cubes[activeIndex].position);
    doScale = true;

    // Update the content or perform any action with the current item
    //updateContent();
}

document.addEventListener('wheel', handleMouseWheel);


// Function to update the grid layout and cube positions on window resize
function onWindowResize() {
	//console.log(window.innerWidth)
    const newAspectRatio = calculateAspectRatio();
    camera.left = (cubeSize * newAspectRatio) / -2;
    camera.right = (cubeSize * newAspectRatio) / 2;
    camera.top = cubeSize / 2;
    camera.bottom = cubeSize / -2;
    camera.aspect = newAspectRatio;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Calculate the new grid layout
    updateGrid()
    
}

function updateGrid(){
    const { numRows, numCols } = calculateGridSize();
    spacing = 0.1; // Adjust this for spacing between cubes

    //console.log(numCols)

    // Reposition the cubes to fit the new grid layout
    let cubeIndex = 0;
    for (let row = 0; row < numRows; row++) {
        
        for (let col = 0; col < numCols; col++) {
            console.log(col - (numCols - 1) / 2)
            console.log('-------------------')
            console.log(row - (numRows - 1))
            const cube = viewGrps[activeView].cubes[cubeIndex];
            const xOffset = (col - (numCols - 1) / 2) * (cubeSize + spacing);
            const yOffset = (row - (numRows - 1) / 2) * (cubeSize + spacing);

            cube.position.set(xOffset, -yOffset, 0);

            cubeIndex++;
        }
    }
}

window.addEventListener('resize', onWindowResize);

// Function to smoothly update camera position
function updateView() {
    lerpCameraPosition(0.1); // Adjust the interpolation speed (0.1 is a good starting point)
    lerpContainer(0.1);
}

// Add this to your existing animate function
function animate() {
    requestAnimationFrame(animate);
    updateView(); // Call the camera position update function
    renderer.render(scene, camera);
}

animate();
