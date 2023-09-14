import {Pane} from 'tweakpane';
const pane = new Pane();

const MAX_COLS = 4
const MAX_ROWS = 20
const MAX_SPACING = 20

console.log(pane)

const navCtrls = pane.addFolder({
  title: 'Navigation',
  expanded: true,   // optional
})


export function bindNavVars(grid_vars, speed_vars, ease_vars, callback){

	let needUpdate = ['spacing', 'offsetScale'];

	navCtrls.addBinding(grid_vars, 'rows', {
	  step:1,
	  min: 0,
  	  max: MAX_ROWS,
	});

	navCtrls.addBinding(grid_vars, 'columns', {
	  step:1,
	  min: 0,
  	  max: MAX_COLS,
	});

	navCtrls.addBinding(grid_vars, 'spacing', {
		  step:0.001,
		  min: 0,
	  	  max: MAX_SPACING,
		}).on('change', (ev) => {
		  callback();
		});

	navCtrls.addBinding(grid_vars, 'offsetScale', {
		  step:0.001,
		  min: -0.3,
	  	  max: 0.3,
		}).on('change', (ev) => {
		  callback();
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
};

export function bindNavEase(vars){

	

};


// const tab = editor.addTab({
//   pages: [
//     {title: 'Configure'},
//     {title: 'Settings'},
//   ],
// });