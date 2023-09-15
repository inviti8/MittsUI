import * as THREE from 'three';
import { gsap } from "gsap";
import editor_data from './editor_data.json' assert {type: 'json'};
import * as editor from './js/editor_pane';
import views from './views.json' assert {type: 'json'};

// Initialize Three.js scene with an orthographic camera
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
const cubeSize = 100; // Use a relative size for the cube
const backBtnSize = cubeSize*0.1

// Variables to store the current and target camera positions
const CAM_POS_START = new THREE.Vector3();
const CAM_POS_NOW = new THREE.Vector3();
var CAM_POS_TARGET = new THREE.Vector3();

const CUBE_SCALE_START = new THREE.Vector3(1, 1, 1);
const CUBE_SCALE_NOW = new THREE.Vector3(1, 1, 1);
let CUBE_SCALE_TARGET = new THREE.Vector3(1.8, 1.8, 1.8);

//navigation vars
const GRID = editor_data.navigation.grid;
let { numRows, numCols } = calculateGridSize();
const NAV_SPEED = editor_data.navigation.speed;
const NAV_EASING = editor_data.navigation.easing;
let NAV_EASE = 'none'
let NAV = false;
let LAST_INDEX = -1;

editor.bindNavVars(GRID, NAV_SPEED, NAV_EASING, updateGrid);

//panel vars
const PANEL_PROPS = editor_data.panels.properties;

editor.bindPanelCtrls(PANEL_PROPS, hiliteGridBox, panelContainerMesh);

const viewGrps = {};
const activeView = Object.keys(views)[0];

Object.keys(views).forEach((v, idx) => {
    viewGrps[v] = {'grp':new THREE.Group(), 'cubes':[], 'cubePos':[], 'backBtns':[], 'panels':{}}
});

// Create an array to store cubes
const cubeGrp = new THREE.Group();
scene.add(viewGrps[activeView].grp);

// Initialize the mouse vector
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

let RESET_CUBE_SCALE =  new THREE.Vector3(CUBE_SCALE_START.x+GRID.offsetScale, CUBE_SCALE_START.y+GRID.offsetScale, CUBE_SCALE_START.z);
let TARGET_CUBE_SCALE =  new THREE.Vector3(CUBE_SCALE_TARGET.x+GRID.offsetScale, CUBE_SCALE_TARGET.y+GRID.offsetScale, CUBE_SCALE_TARGET.z);

var ACTIVE_IDX = 0;
var TGL_SCALE = false;


// Function to smoothly interpolate camera position
function panCamera() {
    const groupScale = viewGrps[activeView].grp.scale;
    const newX = CAM_POS_TARGET.x * groupScale.x;
    const newY = CAM_POS_TARGET.y * groupScale.y;
    gsap.to(camera.position, {duration: NAV_SPEED.speed, x: newX, y: newY, ease: NAV_EASE , onComplete: onNavComplete});
}

function scaleContainer() {
    RESET_CUBE_SCALE.set(CUBE_SCALE_START.x+GRID.offsetScale, CUBE_SCALE_START.y+GRID.offsetScale, CUBE_SCALE_START.z);
    TARGET_CUBE_SCALE.set(CUBE_SCALE_TARGET.x+GRID.offsetScale, CUBE_SCALE_TARGET.y+GRID.offsetScale, CUBE_SCALE_TARGET.z);
    
	//initial reset of all but selected containers
	viewGrps[activeView].cubes.forEach((cube, idx) => {
		if (idx != ACTIVE_IDX) {
            gsap.to(cube.scale, {duration: NAV_SPEED.speed, x: RESET_CUBE_SCALE.x, y: RESET_CUBE_SCALE.y, z: RESET_CUBE_SCALE.z, ease: NAV_EASE });
		}
	})

	//switch to scale only the selected container
	if(TGL_SCALE){
        console.log(ACTIVE_IDX)
        gsap.to(viewGrps[activeView].cubes[ACTIVE_IDX].scale, {duration: NAV_SPEED.speed, x: TARGET_CUBE_SCALE.x, y: TARGET_CUBE_SCALE.y, z: TARGET_CUBE_SCALE.z, ease: NAV_EASE });

	}else{

		viewGrps[activeView].cubes.forEach((cube, idx) => {
            gsap.to(cube.scale, {duration: NAV_SPEED.speed, x: RESET_CUBE_SCALE.x, y: RESET_CUBE_SCALE.y, z: RESET_CUBE_SCALE.z, ease: NAV_EASE });
		})
	}
}

function handleNav(){
    if(!NAV)
        return;

    if(NAV_EASING.ease != 'none'){
        NAV_EASE = NAV_EASING.ease+'.'+NAV_EASING.easeType
    }

    panCamera();
    scaleContainer();
}

function onNavComplete(){
    console.log('nav complete')
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
    	TGL_SCALE = true;
        const clickedCube = intersectsContainer[0].object;
        const cubeIndex = viewGrps[activeView].cubes.indexOf(clickedCube);
        if(cubeIndex >= 0){
            ACTIVE_IDX = cubeIndex;
            CAM_POS_TARGET.copy(clickedCube.position);
        }else{
            TGL_SCALE = false;
            CAM_POS_TARGET.copy(CAM_POS_START);
        }
    }else{
    	TGL_SCALE = false;
    	CAM_POS_TARGET.copy(CAM_POS_START);
    }

    handleNav();
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
        CUBE_SCALE_TARGET.set(1.2, 1.2, 1.2);
        return { numRows: 6, numCols: 1 };
    } else if (window.innerWidth < 900) {
        CUBE_SCALE_TARGET.set(1.5, 1.5, 1.5);
        return { numRows: 3, numCols: 2 };
    } else {
        CUBE_SCALE_TARGET.set(1.8, 1.8, 1.8);
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
    1000
);

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

function getSize(elem){
    var bbox = new THREE.Box3();
    bbox.setFromObject( elem );
    var width = bbox.max.x - bbox.min.x;
    var height = bbox.max.y - bbox.min.y;

    return {'width': width, 'height': height}
}

function createCube(sizeX, sizeY){
    const geometry = new THREE.PlaneGeometry(sizeX, sizeY, 1);
    const material = new THREE.MeshBasicMaterial({wireframe: true});
    const cube = new THREE.Mesh(geometry, material);

    return cube
}

// Function to create a cube with dynamic size
function createGridMesh() {
    return createCube(cubeSize, cubeSize);
}

function createMinimizeMesh(parent, pSizeX, pSizeY) {
    const cube = createCube(backBtnSize, backBtnSize);
    parent.add(cube);
    cube.position.set(-((pSizeX / 2) - (backBtnSize / 2)), (pSizeY / 2 ) - (backBtnSize / 2), parent.position.z+0.1);
    return createCube(backBtnSize, backBtnSize);
}

function panelContainerMesh( action, props ){
    if(viewGrps[activeView].cubes[LAST_INDEX] == undefined)
        return;
    const spans = props.span;
    const spanDir = props.spanDirection;
    const parent = viewGrps[activeView].cubes[LAST_INDEX];
    const parentSize = getSize(parent)
    console.log(parent.scale)
    console.log(parentSize)

    switch (action) {
        case 'add':

            if(viewGrps[activeView].panels[LAST_INDEX] == null){
                const panel = createCube(cubeSize*spans.x, cubeSize*spans.y);
                const panelSize = getSize(panel)
                console.log(panel.scale)
                console.log(panelSize)
                panel.material.wireframe = false;
                parent.add(panel);
                panel.position.set(((cubeSize/2)-(panelSize.width/2))*spanDir.x, ((cubeSize/2)-(panelSize.height/2))*spanDir.y, 10);
                viewGrps[activeView].panels[LAST_INDEX] = panel;
            }else{
                alert("Slot is taken, remove to add a new panel container.")
            }

            break;
        case 'remove':

            if(viewGrps[activeView].panels[LAST_INDEX] != null){
                let panel = viewGrps[activeView].panels[LAST_INDEX];
                delete viewGrps[activeView].panels[LAST_INDEX];
                parent.remove(panel);
            }else{
                alert("Nothing to remove.")
            }

            break;
        case 'edit':

            if(viewGrps[activeView].panels[LAST_INDEX] != null){
                panel = viewGrps[activeView].panels[LAST_INDEX];
                panel.width = cubeSize*spans.x;
                panel.height = cubeSize*spans.y; 

            }
            break;

        default:
            console.log("Not used");
    }
}

function hiliteGridBox(index){
    if(index > viewGrps[activeView].cubes.length-1)
        return;

    viewGrps[activeView].cubes.forEach((cube, idx) => {
        cube.material.color.set('white');
    });

    viewGrps[activeView].cubes[index].material.color.set('green');
    LAST_INDEX = index;
}

// Function to create cubes for the grid
function createGrid() {

    Object.keys(views).forEach((v, idx) => {
        var index = 0;
        console.log(v)
        for (let col = 0; col < numCols; col++) {
            for (let row = 0; row < numRows; row++) {
                const cube = createGridMesh();
                const back = createMinimizeMesh(cube, cubeSize, cubeSize)

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
    ACTIVE_IDX += delta;

    // Ensure the index stays within the bounds of the array
    if (ACTIVE_IDX < 0) {
        ACTIVE_IDX = 0;
    } else if (ACTIVE_IDX >= viewGrps[activeView].cubes.length) {
        ACTIVE_IDX = items.length - 1;
    }

    CAM_POS_TARGET.copy(viewGrps[activeView].cubes[ACTIVE_IDX].position);
    TGL_SCALE = true;

    handleNav();
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
    updateGrid();
    
}

function updateGrid(){
    const { numRows, numCols } = calculateGridSize();
    // Reposition the cubes to fit the new grid layout
    let cubeIndex = 0;
    for (let row = 0; row < numRows; row++) {
        
        for (let col = 0; col < numCols; col++) {
            const cube = viewGrps[activeView].cubes[cubeIndex];
            const xOffset = (col - (numCols - 1) / 2) * (cubeSize + GRID.spacing);
            const yOffset = (row - (numRows - 1) / 2) * (cubeSize + GRID.spacing);

            cube.scale.set(cube.scale.x+GRID.offsetScale, cube.scale.y+GRID.offsetScale, cube.scale.z)
            cube.position.set(xOffset, -yOffset, 0);

            cubeIndex++;
        }
    }
}

window.addEventListener('resize', onWindowResize);


// Add this to your existing animate function
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();

document.onkeydown = function(e) {
    //Toggle nav for editing grid
    if(e.key.toLowerCase() == 'x'){
        NAV = !NAV;
    }
}
