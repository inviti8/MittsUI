import {Pane} from 'tweakpane';
const pane = new Pane();

const MAX_COLS = 4
const MAX_ROWS = 20
const MAX_SPACING = 20


const navCtrls = pane.addFolder({
  title: 'Navigation',
  expanded: true,   // optional
});

const panelCtrls = pane.addFolder({
  title: 'Panels',
  expanded: true,   // optional
});

const elemCtrls = pane.addFolder({
  title: 'Elements',
  expanded: false,   // optional
});


export function refresh(){
	pane.refresh();
}

export function bindNavVars(grid_vars, speed_vars, ease_vars, updateGrid, setDebug){

	let needUpdate = ['spacing', 'offsetScale'];

	navCtrls.addBinding(grid_vars, 'rows', {
	  step:1,
	  min: 0,
  	  max: MAX_ROWS,
	}).on('change', (ev) => {
		 updateGrid();
	});

	navCtrls.addBinding(grid_vars, 'columns', {
	  step:1,
	  min: 0,
  	  max: MAX_COLS,
	}).on('change', (ev) => {
		 updateGrid();
	});

	navCtrls.addBinding(grid_vars, 'spacing', {
		  step:0.001,
		  min: 0,
	  	  max: MAX_SPACING,
	}).on('change', (ev) => {
		 updateGrid();
	});

	navCtrls.addBinding(grid_vars, 'offsetScale', {
		  step:0.001,
		  min: -0.3,
	  	  max: 0.3,
	}).on('change', (ev) => {
		 updateGrid();
	});

	navCtrls.addBinding(speed_vars, 'speed', {
	  step: 0.01,
	  min: 0.001,
  	  max: 2,
	});

	navCtrls.addBinding(ease_vars, 'ease', {
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

	navCtrls.addBinding(ease_vars, 'easeType', {
	  options: {
	  	in: 'in',
	    inOut: 'inOut',
	    out: 'out'
	  },
	});

	navCtrls.addBinding(grid_vars, 'DEBUG').on('change', (ev) => {
		grid_vars.DEBUG = ev.value;
		 setDebug(ev.value);
	});
};

export function bindPanelCtrls(props, onIndexChange, handleContainer){

	// const index = {
	// 	index: props.index,
	// }

	const name = {
		name:props.name,
	}

	const span = {
		span: props.span,
	}

	panelCtrls.addBinding(name, 'name')
	.on('change', (ev) => {
		console.log(ev.value)
		onIndexChange(ev.value);
	});

	panelCtrls.addBinding(span, 'span', {
		x: {step: 1, min: 1, max: 3},
  		y: {step: 1, min: 1, max: 2},
  		format: (v) => Math.floor(v),
	}).on('change', (ev) => {
		console.log('span change')
		handleContainer('edit', props);
	});


	props.actions.forEach((action, idx) => {

		panelCtrls.addButton({
  			title: action
		}).on('click', () => {
  			handleContainer(action, props)
		});
    	
	});


};

export function bindElemCtrls(props, onIndexChange){

	elemCtrls.addBinding(props.creation, 'element', {
	    options: {
	  	button: 'button',
	    input: 'input',
	    toggle: 'toggle'
	  },
	});

	elemCtrls.addBinding(props.creation, 'alignment', {
	    options: {
	  	center: 'center',
	    left: 'left',
	    right: 'right',
	    top:'top',
	    bottom:'bottom'
	  },
	});

	// props.actions.forEach((action, idx) => {

	// 	panelCtrls.addButton({
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