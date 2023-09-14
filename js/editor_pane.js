import {Pane} from 'tweakpane';
const pane = new Pane();

const MAX_COLS = 4
const MAX_ROWS = 20

export function bindGrid(grid){

	pane.addBinding(grid, 'rows', {
	  step:1,
	  min: 0,
  	  max: MAX_ROWS,
	});

	pane.addBinding(grid, 'columns', {
	  step:1,
	  min: 0,
  	  max: MAX_COLS,
	});
};

export function bindNavVars(speed_vars, ease_vars){

	pane.addBinding(speed_vars, 'value', {
	  step: 0.01,
	  min: 0.001,
  	  max: 2,
	});

	pane.addBinding(ease_vars, 'ease', {
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

	pane.addBinding(ease_vars, 'easeType', {
	  options: {
	  	in: 'in',
	    inOut: 'inOut',
	    out: 'out'
	  },
	});
};

export function bindNavEase(vars){

	

};


// const tab = editor.addTab({
//   pages: [
//     {title: 'Configure'},
//     {title: 'Settings'},
//   ],
// });