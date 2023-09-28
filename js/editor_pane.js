import {Pane} from 'tweakpane';
const pane = new Pane();

let pages = []
let tabs = undefined;

const MAX_COLS = 4
const MAX_ROWS = 20
const MAX_SPACING = 20

const creationCtrls = [];
const panelCtrls = [];
let panels = {};
const elemCtrls = [];
let elements = {};
//callbacks for tab actions
let _onTabChange = undefined;
let _onTabCreation = undefined;

const initCtrl = pane.addFolder({
	title: 'Initialization',
	expanded: true,   // optional
});

initCtrl.addBlade({
  view: 'separator',
});
initCtrl.addBlade({
  view: 'separator',
});

const tabName = {
  pages: 'Home, Feed, Settings',
};

initCtrl.addBinding(tabName, 'pages');

const btnAdd = initCtrl.addButton({
	title: 'Create Pages'
}).on('click', (ev) => {
	const create = confirm('Create Pages from:\n'+tabName.pages);
	if(!create || _onTabChange == undefined || _onTabCreation == undefined)
		return;
	let arr = tabName.pages.split(',');

	arr.forEach((page, idx) => {
		let title = page.replace(' ', '');
		let tab = {title: title};
		pages.push(tab);
	});

	addPages();
	_onTabCreation();
	initCtrl.disabled = true;
});

initCtrl.addBlade({
  view: 'separator',
});

export function setCallbacks(onTabChange, onTabCreation){
	if(_onTabChange == undefined){
		_onTabChange = onTabChange;
	}
	if(_onTabCreation == undefined){
		_onTabCreation = onTabCreation;
	}
}

export function getPages(){
	return pages;
};

export function createPage(page){

	// const nCtrl = page.addFolder({
	// 	 title: 'Navigation Variables',
	// 	 expanded: false,   // optional
	// });
	// navCtrls.push(nCtrl);

	const cCtrl = page.addFolder({
		 title: 'Panel Creation',
		 expanded: false,   // optional
	});
	creationCtrls.push(cCtrl);

	const pCtrl = page.addFolder({
		 title: 'Panels',
		 expanded: true,   // optional
	});
	panelCtrls.push(pCtrl);
};

export function addTabs(){
	tabs = pane.addTab({
	  pages: pages,
	}).on('select', (ev) => {
		_onTabChange(ev.index);
	});

	return tabs
};

export function addPages(){
	tabs = addTabs();

	tabs.pages.forEach((page, idx) => {
		createPage(page);
	});
};

export function refresh(){
	pane.refresh();
};

export function bindStyleVars(props, handler){

	const folder = pane.addFolder({
		title: 'Style',
		expanded: false,   // optional
	});

	let txtFolder = folder.addFolder({
		title: 'Text',
		expanded: false,   // optional
	});

	let options = {};

	props.fonts.forEach((path, idx) => {
		let k = path.split('/')[1];
		k = k.split('.')[0];
		k = k.split('_')[0];
		options[k] = path;
	});

	txtFolder.addBinding(props.selected_font, 'font', {
	  options: options,
	}).on('change', (ev) => {
		props.selected_font = ev.value;
		handler( props );
	});

	Object.keys(props.text).forEach((txt, idx) => {
		let f = txtFolder.addFolder({
			title: txt,
			expanded: false,   // optional
		});

		Object.keys(props.text[txt]).forEach((p, idx) => {
			let k = `${p}`
			let val = props.text[txt][p];
			let prop = {};
			prop[k]=val;

			f.addBinding(prop, p).on('change', (ev) => {
				props.text[txt][k] = ev.value;
				handler( props );
			});
		});

	});

};

export function bindNavVars(grid_vars, speed_vars, ease_vars, updateGrid, setDebug){
	const navCtrl = pane.addFolder({
		title: 'Navigation Variables',
		expanded: false,   // optional
	});

	navCtrl.addBinding(grid_vars, 'rows', {
		step:1,
		min: 0,
		max: MAX_ROWS,
	}).on('change', (ev) => {
		updateGrid();
	});

	navCtrl.addBinding(grid_vars, 'columns', {
		step:1,
		min: 0,
		max: MAX_COLS,
	}).on('change', (ev) => {
		updateGrid();
	});

	navCtrl.addBinding(grid_vars, 'spacing', {
		step:0.001,
		min: 0,
		max: MAX_SPACING,
	}).on('change', (ev) => {
		updateGrid();
	});

	navCtrl.addBinding(grid_vars, 'offsetScale', {
		step:0.001,
		min: -0.3,
		max: 0.3,
	}).on('change', (ev) => {
		updateGrid();
	});

	navCtrl.addBinding(speed_vars, 'speed', {
		step: 0.01,
		min: 0.001,
		max: 2,
	});

	navCtrl.addBinding(ease_vars, 'ease', {
		options: {
			none: 'none',
			expo: 'expo',
			sine: 'sine',
			bounce: 'bounce',
			elastic:'elastic',
			back: 'back',
			power1: 'power1',
			power2: 'power2',
			power3: 'power3',
			power4: 'power4',
			slow: 'slow',
			rough: 'rough'
		},
	});

	navCtrl.addBinding(ease_vars, 'easeType', {
			options: {
				in: 'in',
				 inOut: 'inOut',
				 out: 'out'
			},
	});

	navCtrl.addBinding(grid_vars, 'DEBUG').on('change', (ev) => {
		grid_vars.DEBUG = ev.value;
			setDebug(ev.value);
	});

};

export function bindPanelCtrl(props, ctrls, onIndexChange, handler){

	creationCtrls.forEach((ctrl, idx) => {
		// const index = {
		// 	index: props.index,
		// }

		const name = {
			name:props.name,
		}

		const span = {
			span: props.span,
		}

		ctrl.addBinding(name, 'name')
		.on('change', (ev) => {
			console.log('name change')
			console.log(ev)
			props.name = ev.value;
			handler('edit', props);
		});

		ctrl.addBinding(span, 'span', {
			x: {step: 1, min: 1, max: 3},
	  		y: {step: 1, min: 1, max: 2},
	  		format: (v) => Math.floor(v),
		}).on('change', (ev) => {
			handler('edit', props);
		});

		ctrls.actions.forEach((action, idx) => {

			ctrl.addButton({
	  			title: action
			}).on('click', () => {
	  			handler(action, props);
			});
	    	
		});
	});

};

export function addPanelUI(obj, props, index, handler){
	if(panels[obj.id] != null){
		removePanelUI(obj);
	}

	let folder = panelCtrls[index].addFolder({
		 title: obj.name,
		 expanded: false,   // optional
	});
	let createFolder = folder.addFolder({
		 title: 'Element Creation',
		 expanded: false,   // optional
	});
	let elemFolder = folder.addFolder({
		 title: 'Elements',
		 expanded: true,   // optional
	});
	panels[obj.id] = folder;
	let options = {};

	props.elements.forEach((elem, idx) => {
		options[elem] = elem;
	});

	createFolder.addBinding(props.create, 'element', {
	  options: options,
	}).on('change', (ev) => {
		handler('edit', props);
	});
	
	props.actions.forEach((action, idx) => {

		createFolder.addButton({
	  		title: action
		}).on('click', () => {
	  		handler(action, props);
		});
	    	
	});
};

export function removePanelUI(obj){
	
	panels[obj.id].dispose();
	delete panels[obj.id];
};

export function bindElemCtrl(props, onIndexChange){

	elemCtrl.addBinding(props.creation, 'element', {
	    options: {
	  	button: 'button',
	    input: 'input',
	    toggle: 'toggle'
	  },
	});

	elemCtrl.addBinding(props.creation, 'alignment', {
	    options: {
	  	center: 'center',
	    left: 'left',
	    right: 'right',
	    top:'top',
	    bottom:'bottom'
	  },
	});

	// props.actions.forEach((action, idx) => {

	// 	panelCtrl.addButton({
  	// 		title: action
	// 	}).on('click', (e) => {
  	// 		console.log(e);
	// 	});;
    	
	// });


};


// const tab = editor.addTab({
//   pages: [
//     {title: 'Configure'},
//     {title: 'Settings'},
//   ],
// });