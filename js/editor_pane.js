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

// const tab = editor.addTab({
//   pages: [
//     {title: 'Configure'},
//     {title: 'Settings'},
//   ],
// });