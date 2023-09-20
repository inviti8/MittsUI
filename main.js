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
const NAV_VARS = editor_data.navigation
const GRID = editor_data.navigation.grid;
let { numRows, numCols } = calculateGridSize();
let { idealWidth, idealHeight } = calculatePanelSize();
const NAV_SPEED = editor_data.navigation.speed;
const NAV_EASING = editor_data.navigation.easing;
let NAV_EASE = 'none'
let NAV = false;

//tween vars
let NAV_TWEEN_SCALE = undefined;
let NAV_TWEEN_POS = undefined;
let PANEL_TWEEN_SCALE = undefined;
let PANEL_TWEEN_POS = undefined;


editor.bindNavVars(GRID, NAV_SPEED, NAV_EASING, updateGrid, setDebug);

//panel vars
const PANEL_PROPS = editor_data.panels.properties;

editor.bindPanelCtrls(PANEL_PROPS, hiliteGridBox, panelContainerMesh);

const viewGrps = {};
const activeView = Object.keys(views)[0];

Object.keys(views).forEach((v, idx) => {
    viewGrps[v] = {'grp':new THREE.Group(), 'cubes':[], 'grids':[[],[],[],[]], 'cubePos':[], 'backBtns':[], 'panels':{}}
});

// Create an array to store cubes
const cubeGrp = new THREE.Group();
scene.add(viewGrps[activeView].grp);

// Initialize the mouse vector
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

let RESET_CUBE_SCALE =  new THREE.Vector3(CUBE_SCALE_START.x+GRID.offsetScale, CUBE_SCALE_START.y+GRID.offsetScale, CUBE_SCALE_START.z);
let TARGET_CUBE_SCALE =  new THREE.Vector3(CUBE_SCALE_TARGET.x+GRID.offsetScale, CUBE_SCALE_TARGET.y+GRID.offsetScale, CUBE_SCALE_TARGET.z);

let ACTIVE_IDX = 0;
let LAST_INDEX = 0;
let TGL_SCALE = false;
let ACTIVE_PANEL_POS;
let ACTIVE_PANEL_SCALE;
let MOVE = new THREE.Vector3();//var for moving elements


// Function to smoothly interpolate camera position
function panCamera() {
    const cube = viewGrps[activeView].cubes[ACTIVE_IDX];
    if(!panelCanScale(cube))
        return;
    const groupScale = viewGrps[activeView].grp.scale;
    const newX = CAM_POS_TARGET.x * groupScale.x;
    const newY = CAM_POS_TARGET.y * groupScale.y;
    const activeMesh = viewGrps[activeView].cubes[ACTIVE_IDX];
    gsap.to(camera.position, {duration: NAV_SPEED.speed, x: newX, y: newY, ease: NAV_EASE , onComplete: onNavComplete});
}

function scaleContainer() {

    if( gsap.isTweening( NAV_TWEEN_SCALE ))
        return;

    RESET_CUBE_SCALE.set(CUBE_SCALE_START.x+GRID.offsetScale, CUBE_SCALE_START.y+GRID.offsetScale, CUBE_SCALE_START.z);
    TARGET_CUBE_SCALE.set(CUBE_SCALE_TARGET.x+GRID.offsetScale, CUBE_SCALE_TARGET.y+GRID.offsetScale, CUBE_SCALE_TARGET.z);
    
	//initial reset of all but selected containers
	viewGrps[activeView].cubes.forEach((cube, idx) => {
		if (idx != ACTIVE_IDX) {
            NAV_TWEEN_SCALE = gsap.to(cube.scale, {duration: NAV_SPEED.speed, x: RESET_CUBE_SCALE.x, y: RESET_CUBE_SCALE.y, z: RESET_CUBE_SCALE.z, ease: NAV_EASE, onStart: panelAnimation, onStartParams:['INACTIVE', cube] });
		}
	})

	//switch to scale only the selected container
	if(TGL_SCALE){
        const cube = viewGrps[activeView].cubes[ACTIVE_IDX];
        if(!panelCanScale(cube))
            return;

        gsap.to(cube.scale, {duration: NAV_SPEED.speed, x: TARGET_CUBE_SCALE.x, y: TARGET_CUBE_SCALE.y, z: TARGET_CUBE_SCALE.z, ease: NAV_EASE, onStart: panelAnimation, onStartParams:['ACTIVE', cube] });

	}else{
		viewGrps[activeView].cubes.forEach((cube, idx) => {
            NAV_TWEEN_SCALE = gsap.to(cube.scale, {duration: NAV_SPEED.speed, x: RESET_CUBE_SCALE.x, y: RESET_CUBE_SCALE.y, z: RESET_CUBE_SCALE.z, ease: NAV_EASE, onStart: panelAnimation, onStartParams:['INACTIVE', cube] });
		});
	}
}

function panelCanScale(cube){
    let result = true;
    const child = cube.getObjectByName('Panel');
    if (child != undefined && child.scale.x >= 2 && child.scale.y >= 2)
        result = false;

    return result;
}

function getScaleRatio(elem){
    let result = undefined;

    let scaleX = elem.scale.x;
    let scaleY = elem.scale.y;


    if(scaleX > scaleY){
        result = scaleY / scaleX;
    }else if(scaleY > scaleX){
        result = scaleX / scaleY;
    }

    return result
}

function panelAnimation(state, cube, speedMult=1){

    const child = cube.getObjectByName('Panel');
    const minSize = cubeSize*cube.userData.spans;
    let { idealWidth, idealHeight } = calculatePanelSize();

    if (child == undefined)
        return;

    let scaleX = child.scale.x;
    let scaleY = child.scale.y;
    let ratio = getScaleRatio(child);

    if(scaleX > scaleY){
        scaleX = scaleX*(ratio+idealWidth);
        scaleY = scaleY*(ratio+idealWidth);
    }else if(scaleY > scaleX){
        scaleX = scaleX*(ratio+idealHeight);
        scaleY = scaleY*(ratio+idealHeight);
    }

    if(state == 'ACTIVE' && !child.userData.expanded){
        if( cube.children.length > 1 && !gsap.isTweening( PANEL_TWEEN_POS )&& !gsap.isTweening( PANEL_TWEEN_SCALE )){
            
            child.userData.expanded = true;
            PANEL_TWEEN_POS = gsap.to(child.position, { duration: NAV_SPEED.speed*speedMult, x: 0, y: 0, z: child.userData.cachedPos.z+10, ease: NAV_EASE });
            PANEL_TWEEN_SCALE = gsap.to(child.scale, { duration: NAV_SPEED.speed*speedMult, x: scaleX, y: scaleY, ease: NAV_EASE });
        }
    }
    // if(state == 'RESIZE'){
    //     if( cube.children.length > 1 && !gsap.isTweening( PANEL_TWEEN_POS )){
    //         let size = getSize(child);
    //         if(size <=cubeSize)
    //             return;

    //         PANEL_TWEEN_POS = gsap.to(child.position, { duration: NAV_SPEED.speed*speedMult, x: 0, y: 0, ease: NAV_EASE });
    //         gsap.to(child.scale, { duration: NAV_SPEED.speed*speedMult, x: scaleX, y: scaleY, ease: NAV_EASE });
    //     }
    // }
    else if(state == 'INACTIVE' && child.userData.expanded){

        if(cube.children.length > 1 && !gsap.isTweening( PANEL_TWEEN_POS ) && !gsap.isTweening( PANEL_TWEEN_SCALE )){

            child.userData.expanded = false;
            PANEL_TWEEN_POS = gsap.to(child.position, { duration: NAV_SPEED.speed*speedMult, x: child.userData.cachedPos.x, y: child.userData.cachedPos.y, z: child.userData.cachedPos.z, ease: NAV_EASE });
            PANEL_TWEEN_SCALE = gsap.to(child.scale, { duration: NAV_SPEED.speed*speedMult, x: child.userData.cachedScale.x, y: child.userData.cachedScale.y, ease: NAV_EASE });
        }
    }
}

function handleNav(){
    const cube = viewGrps[activeView].cubes[ACTIVE_IDX];
    const child = cube.getObjectByName('Panel');

    if(!NAV || child == undefined)
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
    const intersectsPanel = raycaster.intersectObjects(Object.values(viewGrps[activeView].panels));
    const intersectsBackBtns = raycaster.intersectObjects(viewGrps[activeView].backBtns);

    if ( (intersectsContainer.length > 0 && intersectsBackBtns.length == 0) || (intersectsPanel.length > 0) ) {
    	TGL_SCALE = true;
        let clickedCube = intersectsContainer[0].object;
        let cubeIndex = viewGrps[activeView].cubes.indexOf(clickedCube);

        if(intersectsPanel.length > 0){
            const panel = intersectsPanel[0].object;
            clickedCube = panel.parent;
            cubeIndex = viewGrps[activeView].cubes.indexOf(clickedCube);
        }

        if(cubeIndex >= 0){
            ACTIVE_IDX = cubeIndex;
            CAM_POS_TARGET.copy(clickedCube.position);
            if (clickedCube.children.length > 0){
                ACTIVE_PANEL_POS = clickedCube.children[0].position;
                ACTIVE_PANEL_SCALE = clickedCube.children[0].scale;
            }
        }else{
            TGL_SCALE = false;
            CAM_POS_TARGET.copy(CAM_POS_START);
        }
    }else{
    	TGL_SCALE = false;
    	CAM_POS_TARGET.copy(CAM_POS_START);
    }

    //console.log(editor_data.navigation.grid.DEBUG)

    if (event.ctrlKey) {
        hiliteGridBox(ACTIVE_IDX);
    };

    handleNav();
}

window.addEventListener('click', onMouseClick, false);

// Function to calculate the aspect ratio
function calculateAspectRatio() {
    return window.innerWidth / window.innerHeight;
}

// Function to determine the number of rows and columns based on window width
function calculateGridSize() {
    //console.log(window.innerWidth)
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

function calculatePanelSize() {
    if (window.innerWidth < 600) {
        return { idealWidth: 0, idealHeight: 0 };
    } else if (window.innerWidth < 900) {
        return { idealWidth: 0.15, idealHeight: 0.025 };
    } else {
        return { idealWidth: 0.3, idealHeight: 0.13 };
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
    cube.name = 'BackBtn';
    parent.add(cube);
    cube.position.set(-((pSizeX / 2) - (backBtnSize / 2)), (pSizeY / 2 ) - (backBtnSize / 2), parent.position.z+0.1);
    cube.userData = { 'size': {'x': backBtnSize, 'y':backBtnSize}, 'cachedPos': cube.position, 'cachedScale': cube.scale};
    return cube;
}

function panelContainerMesh( action, props ){
    if(viewGrps[activeView].cubes[LAST_INDEX] == undefined)
        return;

    const spans = props.span;
    const spanDir = props.spanDirection;
    const maxSpans = props.maxSpans;
    const parent = viewGrps[activeView].cubes[LAST_INDEX];
    const parentSize = getSize(parent);

    switch (action) {
        case 'add':

            if(viewGrps[activeView].panels[LAST_INDEX] == null){
                const panel = createCube(cubeSize, cubeSize);
                panel.material.color.set(Math.random() * 0xff00000 - 0xff00000);
                panel.scale.set(panel.scale.x*spans.x, panel.scale.y*spans.y, 1);
                panel.material.wireframe = false;
                parent.add(panel);
                const offsetPos = edgeAlign(parent, panel);
                var pos = new THREE.Vector3(offsetPos.x*spanDir.x, offsetPos.y*spanDir.y, 10);
                var scale = new THREE.Vector3(panel.scale.x, panel.scale.y, panel.scale.y);
                panel.position.copy(pos);
                panel.userData = {
                    'size': {'x': cubeSize,'y': cubeSize},
                    'expanded': false,
                    'cachedPos':pos, 
                    'cachedScale':scale,
                    'spans':spans,
                    'spanDir': spanDir,
                    'maxSpans': maxSpans
                };
                panel.name = 'Panel';
                let btn = createMinimizeMesh(panel, cubeSize*spans.x, cubeSize*spans.y);
                viewGrps[activeView].panels[LAST_INDEX] = panel;
                viewGrps[activeView].backBtns.push(btn);
                updateCornerButton(panel, btn, spans);
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
            console.log('edit')
            if(viewGrps[activeView].panels[LAST_INDEX] != undefined){

                const panel = viewGrps[activeView].panels[LAST_INDEX];
                let newX = 1*spans.x;
                let newY = 1*spans.y;

                if(newX>maxSpans.x){
                    newX= maxSpans.x;
                }
                if(newY>maxSpans.y){
                    newY= maxSpans.y;
                }
                
                panel.scale.set(newX, newY, 1);
                const offsetPos = edgeAlign(parent, panel)

                panel.position.set(offsetPos.x*spanDir.x, offsetPos.y*spanDir.y, 10);
                const btn = panel.getObjectByName('BackBtn');
                if(btn != undefined){
                    updateCornerButton(panel, btn, spans);
                }
                panel.userData.cachedPos.set(panel.position.x, panel.position.y, panel.position.y);
                panel.userData.cachedScale.set(panel.scale.x, panel.scale.y, panel.scale.y);
                panel.userData.spans=spans;
                panel.userData.spanDir=spanDir;
                panel.userData.maxSpans=maxSpans;

            }
            break;

        default:
            console.log("Not used");
    }
}

function updateCornerButton(parent, btn, spans, dirX=-1, dirY=1){
    let multX = 1/spans.x;
    let multY = 1/spans.y;
    let offsetX = (parent.userData.size.x/2)-((btn.userData.size.x*btn.userData.cachedScale.x)/2);
    let offsetY = (parent.userData.size.y/2)-((btn.userData.size.y*btn.userData.cachedScale.y)/2);
  
    btn.scale.set(multX, multY, 1);
    btn.position.set(offsetX*dirX, offsetY*dirY, btn.userData.cachedPos.z)
}

function edgeAlign(parent, child){
    const parentHalfWidthX = parent.scale.x * parent.geometry.parameters.width * 0.5;
    const childHalfWidthX = child.scale.x * child.geometry.parameters.width * 0.5;
    const parentHalfWidthY = parent.scale.y * parent.geometry.parameters.height * 0.5;
    const childHalfWidthY = child.scale.y * child.geometry.parameters.height * 0.5;
    const x = parentHalfWidthX - childHalfWidthX;
    const y = parentHalfWidthY - childHalfWidthY;

    return {'x': x, 'y': y}
}

function centerAlign(parent, child){
    const parentHalfWidthX = parent.scale.x * parent.geometry.parameters.width;
    const childHalfWidthX = child.scale.x * child.geometry.parameters.width * 0.5;
    const parentHalfWidthY = parent.scale.y * parent.geometry.parameters.height;
    const childHalfWidthY = child.scale.y * child.geometry.parameters.height * 0.5;
    const x = parentHalfWidthX - childHalfWidthX;
    const y = parentHalfWidthY - childHalfWidthY;

    return {'x': x, 'y': y}
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
        //console.log(v)
        for (let col = 0; col < numCols; col++) {
            for (let row = 0; row < numRows; row++) {
                const cube = createGridMesh();
                const back = createMinimizeMesh(cube, cubeSize, cubeSize)

                viewGrps[v].cubes.push(cube);
                viewGrps[v].cubePos.push(cube.position)
                viewGrps[v].backBtns.push(back);
                viewGrps[v].grp.add(cube);
                //create grid for each column configuration
                viewGrps[v].grids.forEach( (arr) => {
                    arr.push(cube);
                });  
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

function updatePanel(cube, numCols){
    console.log('update')
    let { idealWidth, idealHeight } = calculatePanelSize();
    const child = cube.getObjectByName('Panel');
    let ratio = undefined;

    console.log(numCols)

    if (child != undefined){
        if (window.innerWidth < 900) {
            let scaleX = child.userData.cachedScale.x;
            let scaleY = child.userData.cachedScale.y;
            let ratio = getScaleRatio(child);

            if(scaleX > scaleY){
                scaleX = scaleX*(ratio);
                scaleY = scaleY*(ratio);
            }else if(scaleY > scaleX){
                scaleX = scaleX*(ratio);
                scaleY = scaleY*(ratio);
            }

            // console.log(ratio);
            // console.log(scaleX);
            // console.log(scaleY);

            child.scale.set(scaleX*numCols, scaleY*numCols, child.userData.cachedScale.z);


            //console.log(scaleX)
            //console.log(scaleY)

            //panelAnimation('RESIZE', cube, 1.5);
        }
        else
        {
            child.scale.set(child.userData.cachedScale.x, child.userData.cachedScale.y, child.userData.cachedScale.z);
            child.position.set(child.userData.cachedPos.x, child.userData.cachedPos.y, child.userData.cachedPos.z);
        }    
    }
}

function updateGrid(){
    const { numRows, numCols } = calculateGridSize();

    // Reposition the cubes to fit the new grid layout
    let cubeIndex = 0;
    for (let row = 0; row < numRows; row++) {
        
        for (let col = 0; col < numCols; col++) {
            const cube = viewGrps[activeView].grids[numCols][cubeIndex];
            const xOffset = (col - (numCols - 1) / 2) * (cubeSize + GRID.spacing);
            const yOffset = (row - (numRows - 1) / 2) * (cubeSize + GRID.spacing);

            cube.scale.set(cube.scale.x+GRID.offsetScale, cube.scale.y+GRID.offsetScale, cube.scale.z)
            cube.position.set(xOffset, -yOffset, 0);
            //updatePanel(cube, numCols)

            cubeIndex++;
        }
    }
}

function setDebug(val){
    NAV = val;
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
        editor_data.navigation.grid=NAV;
    }
}
