import * as THREE from 'three';

THREE.Object3D.prototype.getObjectByUserDataProperty = function ( name, value ) {

	if ( this.userData[ name ] === value ) return this;
	
	for ( var i = 0, l = this.children.length; i < l; i ++ ) {

		var child = this.children[ i ];
		var object = child.getObjectByUserDataProperty( name, value );

		if ( object !== undefined ) {

			return object;

		}

	}
	
	return undefined;

}