import * as THREE from 'three';
function SphereHelper(radius) {
  THREE.Mesh.call(this);
  this.geometry = new THREE.SphereGeometry(radius, 8, 8);
  const color = new THREE.Color(Math.random(), Math.random(), Math.random());
  this.material = new THREE.MeshBasicMaterial({
    color: color.getHex(),
    wireframe: true
  });
}
SphereHelper.prototype = Object.create(THREE.Mesh.prototype);
SphereHelper.prototype.constructor = SphereHelper;
SphereHelper.prototype.update = function (radius) {
  this.geometry.dispose();
  this.geometry = new THREE.SphereGeometry(radius, 8, 8);
};
export default SphereHelper;