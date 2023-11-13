import * as THREE from 'three';
import { gsap } from "gsap";
import * as extensions from './js/three_extensions';
import editor_data from './editor_data.json' assert {type: 'json'};
import * as editor from './js/editor_pane';
import * as three_text from './js/three_text';

let INITIALIZED = false;
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
const MAX_COLS = 3;
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

editor.setCallbacks(onTabChange, onTabCreation);
let PAGES = editor.getPages();
const PANEL_CREATE_PROPS = editor_data.panels.creation;
const PANEL_PROPS = editor_data.panels.properties;
const PANEL_CONST = editor_data.panels.constants;
const ELEM_PROPS = editor_data.elements;
const ELEM_CREATE_PROPS = ELEM_PROPS.creation;
const ELEM_CONST = editor_data.elements.constants;
let STYLE_PROPS = editor_data.style;
editor.bindNavVars(GRID, NAV_SPEED, NAV_EASING, updateGrid, setDebug);
editor.bindStyleVars(STYLE_PROPS, updateStyle);

let viewGrps = {};
let activeView = 'home';

// Initialize the mouse vector
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let isDragging = false;
let lastDragged = undefined;
let previousMouseY = 0;
let moveDir = 1;
let dragDistY = 0;
let lastClick = 0;
let mouseOver = [];

const draggable = three_text.getDraggable();
const mouseOverable = three_text.getMouseOverable();
const inputPrompts = three_text.getInputPrompts();
const inputText = three_text.getInputText();

let RESET_CUBE_SCALE =  new THREE.Vector3(CUBE_SCALE_START.x+GRID.offsetScale, CUBE_SCALE_START.y+GRID.offsetScale, CUBE_SCALE_START.z);
let TARGET_CUBE_SCALE =  new THREE.Vector3(CUBE_SCALE_TARGET.x+GRID.offsetScale, CUBE_SCALE_TARGET.y+GRID.offsetScale, CUBE_SCALE_TARGET.z);

let ACTIVE_IDX = 0;
let LAST_INDEX = 0;
let TGL_SCALE = false;
let ACTIVE_PANEL_POS;
let ACTIVE_PANEL_SCALE;
let MOVE = new THREE.Vector3();//var for moving elements
const TOP_PAD = 2;//spacing buffer for top of browser window

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
renderer.sortObjects = true;
document.body.appendChild(renderer.domElement);

// Set up camera and render loop
camera.position.z = 100;
camera.aspect = aspectRatio; // Update the camera's aspect ratio
camera.updateProjectionMatrix(); // Update the camera's projection matrix

three_text.setSceneCameraAndRenderer(scene, camera, renderer)//Set scene, camera, and renderer for Three_text

// Function to smoothly interpolate camera position
function resetCamera(idx=0) {
    MOVE.set(0, viewGrps[activeView].cubes[idx].position.y-(cubeSize/2-TOP_PAD), camera.position.z);
    CAM_POS_TARGET.copy(MOVE);
    const groupScale = viewGrps[activeView].grp.scale;
    const newX = CAM_POS_TARGET.x * groupScale.x;
    const newY = CAM_POS_TARGET.y * groupScale.y;

    gsap.to(camera.position, {duration: NAV_SPEED.speed*0.5, x: newX, y: newY, onComplete: onNavComplete});
}

function resetContainerScale(){
    const cube = viewGrps[activeView].cubes[ACTIVE_IDX];
    if(!panelCanScale(cube))
        return;
    viewGrps[activeView].cubes.forEach((cube, idx) => {
        if (idx != ACTIVE_IDX) {
            NAV_TWEEN_SCALE = gsap.to(cube.scale, {duration: NAV_SPEED.speed*0.5, x: RESET_CUBE_SCALE.x, y: RESET_CUBE_SCALE.y, z: RESET_CUBE_SCALE.z, ease: NAV_EASE, onStart: panelAnimation, onStartParams:['INACTIVE', cube] });
        }
    });
    NAV_TWEEN_SCALE = gsap.to(cube.scale, {duration: NAV_SPEED.speed*0.5, x: RESET_CUBE_SCALE.x, y: RESET_CUBE_SCALE.y, z: RESET_CUBE_SCALE.z, ease: NAV_EASE, onStart: panelAnimation, onStartParams:['INACTIVE', cube] });
}

// Function to smoothly interpolate camera position
function panCamera() {
    const cube = viewGrps[activeView].cubes[ACTIVE_IDX];
    if(!panelCanScale(cube))
        return;
    const groupScale = viewGrps[activeView].grp.scale;
    const newX = CAM_POS_TARGET.x * groupScale.x;
    const newY = CAM_POS_TARGET.y * groupScale.y;

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
    const child = cube.getObjectByUserDataProperty('type', 'PANEL');
    if (child != undefined && child.scale.x > 2 && child.scale.y > 2)
        result = false;

    return result;
}

function getScaleRatio(elem, cached=false){
    let result = undefined;

    let scaleX = elem.scale.x;
    let scaleY = elem.scale.y;

    if(cached && elem.userData.cachedScale != undefined){
        scaleX = elem.userData.cachedScale.x;
        scaleY = elem.userData.cachedScale.y;
    }  

    if(scaleX > scaleY){
        result = scaleY / scaleX;
    }else if(scaleY > scaleX){
        result = scaleX / scaleY;
    }else{
        result = 1;
    }

    return result
}

function panelAnimation(state, cube, speedMult=1){

    const child = cube.getObjectByUserDataProperty('type', 'PANEL');
    const minSize = cubeSize*cube.userData.spans;
    const { numRows, numCols } = calculateGridSize();
    let { idealWidth, idealHeight } = calculatePanelSize();

    if (child == undefined)
        return;

    let scaleX = child.scale.x;
    let scaleY = child.scale.y;
    let resetScaleX = child.userData.cachedScale.x;
    let resetScaleY = child.userData.cachedScale.y;
    let resetPosX = child.userData.cachedPos.x;
    let resetPosY = child.userData.cachedPos.y;
    let ratio = child.userData.ratio;
    let scaleMult = 1;

    if(scaleX > scaleY){
        scaleX = scaleX*(ratio)*idealWidth;
        scaleY = scaleY*(ratio)*idealWidth;
    }else if(scaleY > scaleX){
        scaleX = scaleX*(ratio)*idealHeight;
        scaleY = scaleY*(ratio)*idealHeight;
    }

    if(scaleX>=2 && scaleY>=2){
        scaleMult = 0.5;
    }

    if (window.innerWidth < 900) {
        resetScaleX = child.userData.scaleOffset.x;
        resetScaleY = child.userData.scaleOffset.y;
        resetPosX=child.userData.posOffset.x;
        resetPosY=child.userData.posOffset.y;

        if(child.userData.spans.x > 2){
            scaleMult = 1.6;
        }

        if(child.userData.spans.x > 1 && child.userData.spans.y > 1){
            scaleMult = 1;
        }
    }

    if(state == 'ACTIVE' && !child.userData.expanded){
        if( cube.children.length > 1 && !gsap.isTweening( PANEL_TWEEN_POS )&& !gsap.isTweening( PANEL_TWEEN_SCALE )){
            
            child.userData.expanded = true;
            PANEL_TWEEN_POS = gsap.to(child.position, { duration: NAV_SPEED.speed*speedMult, x: 0, y: 0, z: child.userData.cachedPos.z+50, ease: NAV_EASE });
            PANEL_TWEEN_SCALE = gsap.to(child.scale, { duration: NAV_SPEED.speed*speedMult, x: scaleX*scaleMult, y: scaleY*scaleMult, z: child.userData.cachedScale.z, ease: NAV_EASE });
        }
    }
    else if(state == 'INACTIVE' && child.userData.expanded){

        if(cube.children.length > 1 && !gsap.isTweening( PANEL_TWEEN_POS ) && !gsap.isTweening( PANEL_TWEEN_SCALE )){

            child.userData.expanded = false;
            PANEL_TWEEN_POS = gsap.to(child.position, { duration: NAV_SPEED.speed*speedMult, x: resetPosX, y: resetPosY, z: child.userData.cachedPos.z, ease: NAV_EASE });
            PANEL_TWEEN_SCALE = gsap.to(child.scale, { duration: NAV_SPEED.speed*speedMult, x: resetScaleX, y: resetScaleY, z: child.userData.cachedScale.z, ease: NAV_EASE });
        }
    }
}

function handleNav(){
    const cube = viewGrps[activeView].cubes[ACTIVE_IDX];
    const child = cube.getObjectByUserDataProperty('type', 'PANEL');

    if(!NAV || child == undefined)
        return;

    if(NAV_EASING.ease != 'none'){
        NAV_EASE = NAV_EASING.ease+'.'+NAV_EASING.easeType
    }

    panCamera();
    scaleContainer();
}

function onNavComplete(){
    //console.log('nav complete')
}

// Function to handle mouse click events
function onMouseClick(event) {
    if(viewGrps[activeView] == undefined)
        return;
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
            if (event.ctrlKey && event.altKey) {
                panelHandler('remove', PANEL_CREATE_PROPS);
            }
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
            resetCamera();
        }
    }else{
    	TGL_SCALE = false;
    	CAM_POS_TARGET.copy(CAM_POS_START);
        resetCamera();
    }

    if (event.ctrlKey && event.shiftKey) {
       hiliteGridBox(ACTIVE_IDX);
    }

    if (event.ctrlKey && !event.altKey&& !event.shiftKey) {
        panelHandler('add', PANEL_CREATE_PROPS);
    }
    handleNav();
}

window.addEventListener('click', onMouseClick, false);

function onDoubleClick() {
    // Calculate mouse position in normalized device coordinates (NDC)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    const intersectsInputPrompt = raycaster.intersectObjects(inputPrompts);

    if(intersectsInputPrompt.length > 0){
      
      let clicked = intersectsInputPrompt[0].object;
      let userData = clicked.userData;
      const inputProps = clicked.userData.inputProps;

      // Initialize variables for typing
      let currentText = '';
      let parent = inputProps.txtBox.box;
      let pos = new THREE.Vector3().copy(clicked.position);
      const textGeometry = three_text.createTextGeometry(currentText, inputProps.font, inputProps.size, inputProps.height, inputProps.meshProps.curveSegments, inputProps.meshProps.bevelEnabled, inputProps.meshProps.bevelThickness, inputProps.meshProps.bevelSize, inputProps.meshProps.bevelOffset, inputProps.meshProps.bevelSegments);
      let mat = clicked.material;

      const typingTextMesh = new THREE.Mesh(textGeometry, mat);
      typingTextMesh.userData = userData;
      typingTextMesh.userData.inputProps = inputProps;
      typingTextMesh.position.copy(pos); // Adjust position in the scene
      parent.add(typingTextMesh);
      inputProps.txtBox.box.userData.inputText = typingTextMesh;
      inputPrompts.push(typingTextMesh);
      mouseOverable.push(typingTextMesh);

      // Listen for keyboard input
      window.addEventListener('keydown', (event) => {
        if(clicked!=undefined){
          clicked.geometry.dispose();
          parent.remove(clicked);
          clicked=undefined;
        }
          if (event.key === 'Enter') {
              // Handle the entered text (e.g., send it to a server)
              console.log('Entered text:', currentText);

              // Clear the typing text
              parent.remove(typingTextMesh);

          } else if (event.key === 'Backspace') {
              // Handle backspace
              currentText = currentText.slice(0, -1);
          } else if (event.key === 'Shift') {
              
          } else {
            if(event.shiftKey){
              currentText += event.key.toUpperCase();
            }else{
              currentText += event.key;
            }
          }

          // Update the text in the typingTextMesh
          typingTextMesh.geometry.dispose(); // Clear the previous text
          typingTextMesh.geometry = three_text.createTextGeometry(currentText, inputProps.font, inputProps.size, inputProps.height, inputProps.meshProps.curveSegments, inputProps.meshProps.bevelEnabled, inputProps.meshProps.bevelThickness, inputProps.meshProps.bevelSize, inputProps.meshProps.bevelOffset, inputProps.meshProps.bevelSegments);
      });
    }
}

window.addEventListener('click', (e) => {
  const thisClick = Date.now();
  if (thisClick - lastClick < 500) {
    onDoubleClick();
    lastClick = thisClick;
    return;
  }
  lastClick = thisClick;
});

function onMouseMove(event) {
  if (lastDragged != undefined && lastDragged.userData.draggable && mouseDown && isDragging) {
    const deltaY = event.clientY - previousMouseY;
    const dragPosition = lastDragged.position.clone();
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
  }

  // Calculate mouse position in normalized device coordinates (NDC)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Update the picking ray with the camera and mouse position
  raycaster.setFromCamera(mouse, camera);

  const intersectsMouseOverable = raycaster.intersectObjects(mouseOverable);
  const intersectsselectorElems = raycaster.intersectObjects(selectorElems);
  let canMouseOver = true;

  //console.log(selectorElems)

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

document.addEventListener('mousemove', onMouseMove);

// Function to calculate the aspect ratio
function calculateAspectRatio() {
    return window.innerWidth / window.innerHeight;
}

// Function to determine the number of rows and columns based on window width
function calculateGridSize() {
    //console.log(window.innerWidth)
    if (window.innerWidth < 600) {
        CUBE_SCALE_TARGET.set(1.2, 1.2, 1.2);
        return { numRows: 9, numCols: 1 };
    } else if (window.innerWidth < 900) {
        CUBE_SCALE_TARGET.set(1.5, 1.5, 1.5);
        return { numRows: 6, numCols: 2 };
    } else {
        CUBE_SCALE_TARGET.set(1.8, 1.8, 1.8);
        return { numRows: 3, numCols: 3 };
    }
}

function calculatePanelSize() {
    const { numRows, numCols } = calculateGridSize();
    if (window.innerWidth < 600) {
        return { idealWidth: 1.8, idealHeight: 2.3 };
    } else if (window.innerWidth < 900) {
        return { idealWidth: 0.55, idealHeight: 0.6 };
    } else {
        return { idealWidth: 1.5, idealHeight:1.05 };
    }
}

function getSize(elem){
    var bbox = new THREE.Box3();
    bbox.setFromObject( elem );
    var width = bbox.max.x - bbox.min.x;
    var height = bbox.max.y - bbox.min.y;

    return {'width': width, 'height': height}
}

function setUserData(elem, type, sizeX, sizeY, expanded, cachedPos, cachedScale, spans, maxSpans, column, row, attachedTo=[]){
    elem.userData = {
                    'type': type,
                    'size': {'x': sizeX,'y': sizeY},
                    'expanded': expanded,
                    'cachedPos': cachedPos, 
                    'cachedScale': cachedScale,
                    'spans': new THREE.Vector2(spans.x, spans.y),
                    'maxSpans': maxSpans,
                    'column': column,
                    'row': row,
                    'ratio': getScaleRatio(elem),
                    'posOffset': new THREE.Vector3(0, 0, 0),
                    'scaleOffset': new THREE.Vector3(1, 1, 1),
                    'attachedTo': attachedTo
                };
}

function createCube(sizeX, sizeY){
    const geometry = new THREE.PlaneGeometry(sizeX, sizeY, 1);
    const material = new THREE.MeshBasicMaterial({wireframe: true, transparent: true, depthWrite: true, opacity: 1, alphaTest: 0.5});
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
    var pos = new THREE.Vector3(-((pSizeX / 2) - (backBtnSize / 2)), (pSizeY / 2 ) - (backBtnSize / 2), parent.position.z+0.1);
    var scale = new THREE.Vector3(cube.scale.x, cube.scale.y, cube.scale.y);
    cube.position.copy(pos);
    setUserData(cube, 'BACK_BUTTON', backBtnSize, backBtnSize, false, pos, scale, {"x": 1, "y": 1}, 1);

    return cube;
}

function updateStyle(props){
    STYLE_PROPS = props;
}

function panelHandler( action, props ){
    if(viewGrps[activeView].cubes[LAST_INDEX] == undefined)
        return;
    const name = props.name;
    const spans = props.span;
    const maxSpans = PANEL_CONST.maxSpans;
    const parent = viewGrps[activeView].cubes[LAST_INDEX];
    let limitX = LAST_INDEX;

    if(LAST_INDEX>=MAX_COLS){
        limitX=Math.abs(MAX_COLS-LAST_INDEX);
    }
    //cap spans
    spans.x = spans.x-limitX;
    if(spans.x<1){
        spans.x=1;
    }

    switch (action) {
        case 'add':

            if(viewGrps[activeView].panels[LAST_INDEX] == null){
                const panel = createCube(cubeSize, cubeSize);
                panel.material.color.set(Math.random() * 0xff00000 - 0xff00000);
                panel.scale.set(panel.scale.x*spans.x, panel.scale.y*spans.y, 1);
                panel.material.wireframe = false;
                parent.add(panel);
                const offsetPos = edgeAlign(parent, panel);
                var pos = new THREE.Vector3(offsetPos.x*-1, offsetPos.y*1, 10);
                var scale = new THREE.Vector3(panel.scale.x, panel.scale.y, panel.scale.y);
                panel.position.copy(pos);
                setUserData(panel, 'PANEL', cubeSize, cubeSize, false, pos, scale, spans, maxSpans);
                panel.name = name;
                if(panel.name == 'Panel'){
                    panel.name = name+'-'+panel.id;
                }
                let btn = createMinimizeMesh(panel, cubeSize*spans.x, cubeSize*spans.y);
                viewGrps[activeView].panels[LAST_INDEX] = panel;
                viewGrps[activeView].elements[panel.id] = [];
                viewGrps[activeView].backBtns.push(btn);
                updateCornerButton(panel, btn, spans);
                let index = Object.keys(viewGrps).indexOf(activeView);
                editor.addPanelUI(panel, ELEM_CREATE_PROPS, index, elementHandler);
            }else{
                alert("Slot is taken, remove to add a new panel container.")
            }

            break;
        case 'remove':

            if(viewGrps[activeView].panels[LAST_INDEX] != null){
                let panel = viewGrps[activeView].panels[LAST_INDEX];
                delete viewGrps[activeView].panels[LAST_INDEX];
                delete viewGrps[activeView].elements[panel.id];
                editor.removePanelUI(panel);
                parent.remove(panel);
            }else{
                alert("Nothing to remove.")
            }

            break;
        case 'edit':
            //console.log('edit')
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

                panel.name = name;
                if(panel.name == 'Panel'){
                    panel.name = name+'-'+panel.id;
                }
                panel.scale.set(newX, newY, 1);
                const offsetPos = edgeAlign(parent, panel)

                panel.position.set(offsetPos.x*-1, offsetPos.y*1, 10);
                const btn = panel.getObjectByUserDataProperty('type', 'BACK_BUTTON');

                if(btn != undefined){
                    updateCornerButton(panel, btn, spans);
                }
                panel.userData.cachedPos.set(panel.position.x, panel.position.y, panel.position.y);
                panel.userData.cachedScale.set(panel.scale.x, panel.scale.y, panel.scale.y);
                panel.userData.spans.set(spans.x, spans.y);
                panel.userData.maxSpans=maxSpans;
                panel.userData.ratio=getScaleRatio(panel);
                let index = Object.keys(viewGrps).indexOf(activeView);
                editor.addPanelUI(panel, ELEM_CREATE_PROPS, index, elementHandler);

            }
            break;

        default:
            //console.log("Not used");
    }
}

function elementHandler( action, props ){
    if(viewGrps[activeView] == undefined)
        return;

     switch (action) {
        case 'add':
            console.log(props);
            console.log(ELEM_PROPS[props.create.element])
            console.log('Should add element: '+props.create.element);
            console.log(STYLE_PROPS)
            const panel = viewGrps[activeView].panels[LAST_INDEX];
            const font = STYLE_PROPS.selected_font.font;
            let name = props.element_name.name;
            let meshProps = three_text.meshProperties(12, false, 0.1, 0.1, 0, 3);
            //anim, action, duration, ease, delay, onComplete
            let aConfig = three_text.animationConfig('SCALE', 'IN', 1, 'elastic.out', 0.01)
            three_text.createMultiTextBox(panel, 50, 10, name, 'text', font, true, 1, 5, 1, 4, 5, 0.5, meshProps, aConfig, onElemCreated);
        break;
        case 'remove':

        break;
        case 'edit':

        break;

        default:
            //console.log("Not used");
        }

}

function onElemCreated(elem){
    viewGrps[activeView].elements[elem.parent.id] = elem;
    let index = Object.keys(viewGrps).indexOf(activeView);
    editor.addElementUI(elem, ELEM_PROPS, index, elemUpdateHandler);
}

function elemUpdateHandler(action, props){
    switch (action) {
        case 'add':
            console.log(props);
            console.log(ELEM_PROPS[props.create.element])
            console.log('Should add element: '+props.create.element);
            console.log(STYLE_PROPS)
            const panel = viewGrps[activeView].panels[LAST_INDEX];
            const font = STYLE_PROPS.selected_font.font;
            let name = props.element_name.name;
            let meshProps = three_text.meshProperties(12, false, 0.1, 0.1, 0, 3);
            //anim, action, duration, ease, delay, onComplete
            let aConfig = three_text.animationConfig('SCALE', 'IN', 1, 'elastic.out', 0.01)
            three_text.createMultiTextBox(panel, 50, 10, name, 'text', font, true, 1, 5, 1, 4, 5, 0.5, meshProps, aConfig, onElemCreated);
        break;
        case 'remove':

        break;
        case 'edit':

        break;

        default:
            //console.log("Not used");
        }
}

function updateCornerButton(parent, btn, spans, dirX=-1, dirY=1){
    let multX = 1/spans.x;
    let multY = 1/spans.y;
    let offsetX = (parent.userData.size.x/2)-((btn.userData.size.x/2*btn.userData.cachedScale.x*multX));
    let offsetY = (parent.userData.size.y/2)-((btn.userData.size.y/2*btn.userData.cachedScale.y*multY));
  
    btn.position.set(offsetX*dirX, offsetY*dirY, btn.userData.cachedPos.z);
    btn.scale.set(multX, multY, 1);
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

function updatePanelName(name){
    if(index > viewGrps[activeView].cubes.length-1)
        return;
    const cube = viewGrps[activeView].cubes[ACTIVE_IDX];
    const child = cube.getObjectByUserDataProperty('type', 'PANEL');
    child.name = name;
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

function onTabChange(index){
    resetContainerScale();
    resetCamera();
    scene.remove(viewGrps[activeView].grp);
    activeView = PAGES[index].title;
    scene.add(viewGrps[activeView].grp);
    updateGrid();
}

function onTabCreation(){
    PAGES = editor.getPages();

    if(!INITIALIZED){
        editor.bindPanelCtrl(PANEL_PROPS, PANEL_CREATE_PROPS, hiliteGridBox, panelHandler);
    }
    
    if(viewGrps[activeView] != undefined && viewGrps[activeView].grp != undefined){
        scene.remove(viewGrps[activeView].grp);
    }
    activeView = PAGES[0].title;
    PAGES.forEach((page, idx) => {
        viewGrps[page.title] = {'grp':new THREE.Group(), 'cubes':[], 'grids':[[],[],[],[]], 'cubePos':[], 'backBtns':[], 'panels':{}, 'elements':{}};
        viewGrps[page.title].grp.scale.set(0.5, 0.5, 0.5);
    });

    scene.add(viewGrps[activeView].grp);
    renderer.setSize(window.innerWidth, window.innerHeight);
    createGrids();
    onWindowResize();
    resetCamera();
}

// Function to create cubes for the grid
function createGrids() {
    PAGES.forEach((page, idx) => {
        var index = 0;
        //console.log(v)
        for (let col = 0; col < numCols; col++) {
            for (let row = 0; row < numRows; row++) {
                if(Object.keys(viewGrps[page.title].panels).length == 0){
                    const cube = createGridMesh();
                    const back = createMinimizeMesh(cube, cubeSize, cubeSize)

                    viewGrps[page.title].cubes.push(cube);
                    viewGrps[page.title].cubePos.push(cube.position)
                    viewGrps[page.title].backBtns.push(back);
                    viewGrps[page.title].grp.add(cube);
                    setUserData(cube, 'GRID', cubeSize, cubeSize, false, cube.position, cube.scale, {"x": 1, "y": 1}, 1, col, row);
                    //create grid for each column configuration
                    viewGrps[page.title].grids.forEach( (arr) => {
                        arr.push(cube);
                    });  
                }
            }
        }
        
    });
}

function updateGrid(){
    if(viewGrps[activeView] == undefined)
        return;
    const { numRows, numCols } = calculateGridSize();
    let rowOffset = 1;
    if( Object.keys(viewGrps[activeView].panels).length>0){
        viewGrps[activeView].grids[0] = [];//col 1
        viewGrps[activeView].grids[1] = [];//col 2
        //Setup grids for other screen sizes
        for (const [idx, panel] of Object.entries(viewGrps[activeView].panels)) {
            let active = viewGrps[activeView].cubes.indexOf(panel.parent);

            viewGrps[activeView].grids[0].push(panel.parent);

            var max = active+(panel.userData.spans.x*panel.userData.spans.y+rowOffset);

            for (let i = active; i < max; i++) {
                var elem = viewGrps[activeView].cubes[i];
                viewGrps[activeView].grids[1].push(elem);
            }

        }
        rowOffset += 1;
    }
    
    // Reposition the cubes to fit the new grid layout
    let cubeIndex = 0;
    for (let row = 0; row < numRows; row++) {
        
        for (let col = 0; col < numCols; col++) {
            const cube = viewGrps[activeView].grids[numCols-1][cubeIndex];
            const xOffset = (col - (numCols - 1) / 2) * (cubeSize + GRID.spacing);
            const yOffset = (row - (numRows - 1) / 2) * (cubeSize + GRID.spacing);
            if(cube != undefined){
                cube.scale.set(cube.scale.x+GRID.offsetScale, cube.scale.y+GRID.offsetScale, cube.scale.z)
                cube.position.set(xOffset, -yOffset, 0);
                updatePanel(cube, numCols)
                cubeIndex++;
            }

        }
    }
    resetContainerScale();
    resetCamera();
}

function handleMouseWheel(event) {

    // Check the direction of the mouse wheel (up or down)
    const delta = Math.sign(event.deltaY);

    // Increment or decrement the current index based on the wheel direction
    ACTIVE_IDX += delta;

    // Ensure the index stays within the bounds of the array
    if (ACTIVE_IDX < 0) {
        ACTIVE_IDX = 0;
    } else if (ACTIVE_IDX >= viewGrps[activeView].cubes.length) {
        ACTIVE_IDX = viewGrps[activeView].cubes.length - 1;
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

    let { idealWidth, idealHeight } = calculatePanelSize();
    const child = cube.getObjectByUserDataProperty('type', 'PANEL');
    let ratio = undefined;

    if (child != undefined){
        if (window.innerWidth < 900) {
            let scaleX = child.userData.cachedScale.x;
            let scaleY = child.userData.cachedScale.y;
            let ratio = getScaleRatio(child)*numCols;

            if(child.userData.spans.x > 1 && child.userData.spans.y > 1){
                scaleX*=0.5;
                scaleY*=0.5;
            }

            if(scaleX > scaleY){
                scaleX = scaleX*(ratio);
                scaleY = scaleY*(ratio);

            }else if(scaleY > scaleX){
                scaleX = scaleX*(ratio);
                scaleY = scaleY*(ratio);
            }

            child.userData.ratio = ratio;
            child.scale.set(scaleX, scaleY, child.userData.cachedScale.z);
            const offsetPos = edgeAlign(cube, child);
            MOVE.set(offsetPos.x*-1, offsetPos.y*1, 10);
            if (window.innerWidth < 600) {
                MOVE.set(0, 0, 10);
            }

            child.position.copy(MOVE);
            child.userData.scaleOffset.copy(child.scale);
            child.userData.posOffset.copy(MOVE);
        }
        else
        {
            child.scale.set(child.userData.cachedScale.x, child.userData.cachedScale.y, child.userData.cachedScale.z);
            child.position.set(child.userData.cachedPos.x, child.userData.cachedPos.y, child.userData.cachedPos.z);
            child.userData.ratio = getScaleRatio(child, true);
            child.userData.scaleOffset.copy(child.scale);
            child.userData.posOffset.set(0, 0, 0);
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
    }
}
