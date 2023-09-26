import {Pane} from 'tweakpane';
const pane = new Pane();

const pages = [{title: 'home'}, {title: 'settings'}]
let tabs = undefined;

const MAX_COLS = 4
const MAX_ROWS = 20
const MAX_SPACING = 20

const navCtrls = [];
// const navCtrl = pane.addFolder({
//   title: 'Navigation Variables',
//   expanded: true,   // optional
// });

const panelCtrls = [];
// const panelCtrl = pane.addFolder({
//   title: 'Panel Creation',
//   expanded: true,   // optional
// });

const elemCtrls = [];
// const elemCtrl = pane.addFolder({
//   title: 'Elements',
//   expanded: false,   // optional
// });

export function getPages(){
	return pages;
};

export function addPages(onTabChange){

	tabs = pane.addTab({
	  pages: pages,
	}).on('select', (ev) => {
		console.log('tab changed')
		console.log(ev)
		onTabChange(ev.index);
	});

	tabs.pages.forEach((page, idx) => {

		const nCtrl = page.addFolder({
		  title: 'Navigation Variables',
		  expanded: true,   // optional
		});
		navCtrls.push(nCtrl);

		const pCtrl = page.addFolder({
		  title: 'Panel Creation',
		  expanded: true,   // optional
		});
		panelCtrls.push(pCtrl);

	});

};

export function addPage(index, folder){
	tabs.pages[index].addFolder(folder);
};

export function refresh(){
	pane.refresh();
};

export function bindNavVars(grid_vars, speed_vars, ease_vars, updateGrid, setDebug){

	navCtrls.forEach((ctrl, idx) => {
			ctrl.addBinding(grid_vars, 'rows', {
			  step:1,
			  min: 0,
		  	  max: MAX_ROWS,
			}).on('change', (ev) => {
				 updateGrid();
			});

			ctrl.addBinding(grid_vars, 'columns', {
			  step:1,
			  min: 0,
		  	  max: MAX_COLS,
			}).on('change', (ev) => {
				 updateGrid();
			});

			ctrl.addBinding(grid_vars, 'spacing', {
				  step:0.001,
				  min: 0,
			  	  max: MAX_SPACING,
			}).on('change', (ev) => {
				 updateGrid();
			});

			ctrl.addBinding(grid_vars, 'offsetScale', {
				  step:0.001,
				  min: -0.3,
			  	  max: 0.3,
			}).on('change', (ev) => {
				 updateGrid();
			});

			ctrl.addBinding(speed_vars, 'speed', {
			  step: 0.01,
			  min: 0.001,
		  	  max: 2,
			});

			ctrl.addBinding(ease_vars, 'ease', {
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

			ctrl.addBinding(ease_vars, 'easeType', {
			  options: {
			  	in: 'in',
			    inOut: 'inOut',
			    out: 'out'
			  },
			});

			ctrl.addBinding(grid_vars, 'DEBUG').on('change', (ev) => {
				grid_vars.DEBUG = ev.value;
				 setDebug(ev.value);
			});
	});
};

export function bindPanelCtrl(props, onIndexChange, handleContainer){

	panelCtrls.forEach((ctrl, idx) => {
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
		// .on('change', (ev) => {
		// 	console.log(ev.value)
		// 	onIndexChange(ev.value);
		// });

		ctrl.addBinding(span, 'span', {
			x: {step: 1, min: 1, max: 3},
	  		y: {step: 1, min: 1, max: 2},
	  		format: (v) => Math.floor(v),
		}).on('change', (ev) => {
			console.log('span change')
			handleContainer('edit', props);
		});


		props.actions.forEach((action, idx) => {

			ctrl.addButton({
	  			title: action
			}).on('click', () => {
	  			handleContainer(action, props)
			});
	    	
		});
	});
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