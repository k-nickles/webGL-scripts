/*
Kara Dodd 
Student ID: 1264147
email: kdodd@ucsc.edu
Program 3
 */

/*
 * For this assignment I implemented simple sliders to control the 
 * scaleing, rotation and translation functions. Currently the two sharks 
 * rotate around a global axis rather than a local one. The sharks are also 
 * a single flat color. A FBO is implemented but not used. 
 */


//global level variables
var mSet;
var rMax;
var MAX_HEIGHT;
var topVal;
var xDim;
var yDim;
var MAX_YDIM;
var MAX_XDIM;

//slider variables 
var translate;
var rotate; 
var scale;

//camera sliders 
var zoom; 
var pan; 

var NORMAL_COORD; //will hold all normal coordinates

//DOM
var canvas;

//scale variables
var scaleX;
var scaleY;
var scaleZ;

//shaders and gl
var vShader;
var fShader;
var program;
var gl;

//buffers for first shark 
var vBuffer_S1; //vertex buffer
var nBuffer_S1; //normal buffer
var vPosition_S1;
var vColor;
var vNormal_S1;

//buffer for second shark 
var vBuffer_S2;
var nBuffer_S2; 
var vPosition_S2;
var vNormal_S2;


//frame buffer object
var fbo;
var fboTexture; 
var pixelVal;

/*
 * Shader Function
 */

function initShaders(gl, vShaderName, fShaderName) {
    function getShader(gl, shaderName, type) {
    	//createShader instantiates the wrap used during glsl compilation.
        var shader = gl.createShader(type),
            shaderScript = shaderName;
        if (!shaderScript) {
            alert("Could not find shader source: "+shaderName);
        }
        //gl.shaderSource links a shader source to the already created shader wrapper.
        gl.shaderSource(shader, shaderScript);
        //compile shader will actually compile the provided string glsl block
        gl.compileShader(shader);

		//getShaderParameter in this case is checking the ensure the compilation
		//of the shaders went off without a hitch
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert(gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }
    
    var vertexShader = getShader(gl, vShaderName, gl.VERTEX_SHADER),
        fragmentShader = getShader(gl, fShaderName, gl.FRAGMENT_SHADER),
        //createProgram generates a program object that will store the compiled shader information
        program = gl.createProgram();

	//attach shader attached the compiled gl shader code to its program object container
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    //link program links all of the components including the compiled shader code together.
    gl.linkProgram(program);

	//getProgramParameter in this case is checking to ensure the linking went off properly
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
		throw ("program failed to link:" + gl.getProgramInfoLog(program));
        return null;
    }
    gl.useProgram(program);
	program.vPosition_S1 = gl.getAttribLocation(program, "vPosition_S1");
	program.vNormal_S1 = gl.getAttribLocation(program, "vNormal_S1");
	
	//grab the uniform frame buffer object from the shader
	program.fboUniform = gl.getUniformLocation(program, "uFBO");
	
    return program;
};


/*
 * Transformation Support Functions
 * 
 * This all return arrays that can be used to populate the matrix classes
 * and then perform easy operations prior to setting the gl uniform matrix
 */

 
function makePerspectiveMatrix(fieldOfView, aspect, near, far){
	//fieldOfView is in radians
	var f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfView);
	var rangeInv = 1.0 / (near - far);
	
	return [
	f/aspect, 0, 0, 0, 
	0, f, 0, 0, 
	0, 0,  (near + far) * rangeInv, -1, 
	0, 0, near * far * rangeInv * 2, 0
	];
}

function lookAtMatrix(cameraPosition, target, up){
	var axisZ = [cameraPosition[0] - target[0], cameraPosition[1] - target[1],
		cameraPosition[2] - target[2]]; 
	axisZ = normalize(axisZ);
	var axisX = cross(up, axisZ);
	var axisY = cross(axisZ, axisX)
	
	//return 4x4 matrix
	return[
	axisX[0], axisX[1], axisX[2], 0,
	axisY[0], axisY[1], axisY[2], 0,
	axisZ[0], axisZ[1], axisZ[2], 0,
	cameraPosition[0], cameraPosition[1], cameraPosition[2], 1];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1],
          a[2] * b[0] - a[0] * b[2],
          a[0] * b[1] - a[1] * b[0]];
}

function normalize(v) {
  var length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  // make sure we don't divide by 0.
  if (length > 0.00001) {
    return [v[0] / length, v[1] / length, v[2] / length];
  } else {
    return [0, 0, 0];
  }
}

function makeZToWMatrix(fudgeFactor) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, fudgeFactor,
    0, 0, 0, 1,
  ];
}

function make2DProjection(width, height, depth) {
  // Note: This matrix flips the Y axis so 0 is at the top.
  return [
     2 / width, 0, 0, 0,
     0, -2 / height, 0, 0,
     0, 0, 2 / depth, 0,
    -1, 1, 0, 1,
  ];
}

function makeTranslation2D(deltaX, deltaY) {
	return [
	1.0, 	0.0, 	0.0,
	0.0, 	1.0, 	0.0,
	deltaX, deltaY, 1.0
	];
}

function makeRotation2D(angle) {
	var cos = Math.cos(angle);
	var sin = Math.sin(angle);
	
	return [
		cos,	-1 * sin,	0.0,
		sin,	cos,		0.0,
		0.0,	0.0,		1.0
	];
	
}

function makeScale2D(scaleX, scaleY) {
	return [
		scaleX, 	0.0,	 0.0,
		0.0,		scaleY,  0.0,
		0.0,		0.0	,	 1.0
	];
}

function makeTranslation3D(deltaX, deltaY, deltaZ) {
	return [
		1.0, 	0.0, 	0.0,	0.0,
		0.0, 	1.0, 	0.0,	0.0,
		0.0,	0.0,	1.0,	0.0,
		deltaX,	deltaY,	deltaZ, 1.0
	];
}

function makeRotation3DX(angle) {
	
	var cos = Math.cos(angle);
	var sin = Math.sin(angle);
	
	return [
		1.0,	0.0,	0.0,	0.0,
		0.0,	cos,	sin,	0.0,
		0.0,	-1*sin,	cos,	0.0,
		0.0,	0.0,	0.0,	1.0
	];
}

function makeRotation3DY(angle) {
	var cos = Math.cos(angle);
	var sin = Math.sin(angle);
	
	return [
		cos,	0.0,	-1*sin,		0.0,
		0.0,	1.0,	0.0,		0.0,
		sin,	0.0,	cos,		0.0,
		0.0,	0.0,	0.0,		1.0
	];
}

function makeRotation3DZ(angle) {
	var cos = Math.cos(angle);
	var sin = Math.sin(angle);
	return [
		cos,	sin,	0.0,	0.0,
		-1*sin, cos,	0.0,	0.0,
		0.0,	0.0,	1.0,	0.0,
		0.0,	0.0,	0.0,	1.0
	];
}

function makeScale3D(scaleX, scaleY, scaleZ) {
	return [
		scaleX, 0.0,	0.0,	0.0,
		0.0,	scaleY, 0.0,	0.0,
		0.0,	0.0,	scaleZ,	0.0,
		0.0,	0.0,	0.0,	1.0
	];
}


/*
 * Vector class representing a 3 dimensional vector in space
 * 
 */
function Vector(x, y, z) {
	this.x = x;
	this.y = y;
	this.z = z;
	
	this.add = function(vector) {
		var rtn = new Vector(0.0, 0.0, 0.0);
		rtn.x = this.x + vector.x;
		rtn.y = this.y + vector.y;
		rtn.z = this.z + vector.z;
		
		return rtn;
	}
	
	this.sub = function(vector){
		var rtn = new Vector(0.0, 0.0, 0.0);
		rtn.x = this.x - vector.x;
		rtn.y = this.y - vector.y;
		rtn.z = this.z - vector.z;
		
		return rtn;
	}
	
	this.scale = function(scalar) {
		this.x = this.x * scalar;
		this.y = this.y * scalar;
		this.z = this.z * scalar;
	}
	
	this.scalarMult = function(scalar) {
		var rtn = new Vector(this.x, this.y, this.z);
		rtn.x = rtn.x * scalar;
		rtn.y = rtn.y * scalar;
		rtn.z = rtn.z * scalar;
		
		return rtn;
	}
	
	this.dotProduct = function( vector ) {
		return (this.x * vector.x + this.y * vector.y + this.z * vector.z);
	}
	
	this.copy = function() {
		var rtn = new Vector(this.x, this.y, this.z);
		return rtn;
	}
	
	this.toFloat32Array = function() {
		return new Float32Array([
			this.x,
			this.y,
			this.z
		]);
	}
	
}

/*
 * Vector4D, its like a vector3D but with a fourth dimension.
 * 
 * 
 */
function Vector4D(x, y, z, w) {
	this.x = x;
	this.y = y;
	this.z = z;
	this.w = w;
	
	this.add = function(vector) {
		var rtn = new Vector4D(0.0, 0.0, 0.0, 0.0);
		rtn.x = this.x + vector.x;
		rtn.y = this.y + vector.y;
		rtn.z = this.z + vector.z;
		rtn.w = this.w + vector.w;
		
		return rtn;
	}
	
	this.scale = function(scalar) {
		this.x = this.x * scalar;
		this.y = this.y * scalar;
		this.z = this.z * scalar;
		this.w = this.w * scalar;
	}
	
	this.scalarMult = function(scalar) {
		var rtn = new Vector4D(this.x, this.y, this.z, this.w);
		rtn.x = rtn.x * scalar;
		rtn.y = rtn.y * scalar;
		rtn.z = rtn.z * scalar;
		rtn.w = rtn.w * scalar;
		
		return rtn;
	}
	
	this.dotProduct = function( vector ) {
		return (this.x * vector.x + this.y * vector.y + this.z * vector.z + this.w * vector.w);
	}
	
	this.copy = function() {
		var rtn = new Vector4D(this.x, this.y, this.z, this.w);
		return rtn;
	}
	
	this.toFloat32Array = function() {
		return new Float32Array([
			this.x,
			this.y,
			this.z,
			this.w
		]);
	}
	
}


/*
 * Matrix Classes
 * 
 * this contain support functions for operations on matrices
 */

function Matrix3D() {
	
	this.x = new Vector(0.0, 0.0, 0.0);
	this.y = new Vector(0.0, 0.0, 0.0);
	this.z = new Vector(0.0, 0.0, 0.0);
	
	this.populateFromArray = function( array ) {
		this.x = new Vector(array[0], array[1], array[2]);
		this.y = new Vector(array[3], array[4], array[5]);
		this.z = new Vector(array[6], array[7], array[8]);
	}
	
	this.rowVecMult = function(vector) {
		
		var rtn = new Vector( 0.0, 0.0, 0.0);
		
		rtn.x = ( vector.x * this.x.x + vector.y * this.y.x + vector.z * this.z.x );
		rtn.y = ( vector.x * this.x.y + vector.y * this.y.y + vector.z * this.z.y );
		rtn.z = ( vector.x * this.x.z + vector.y * this.y.z + vector.z * this.z.z );
		
		return rtn;
	}
	
	this.colVecMult = function(vector) {
		
		return new Vector(this.x.dotProduct(vector),
							 this.y.dotProduct(vector),
							 this.z.dotProduct(vector) );		
	}
	
	
	this.transpose = function() {
		var rtn = new Matrix3D();
		
		rtn.x.x = this.x.x;
		rtn.x.y = this.y.x;
		rtn.x.z = this.z.x;
		
		rtn.y.x = this.x.y;
		rtn.y.y = this.y.y;
		rtn.y.z = this.z.y;
		
		rtn.z.x = this.x.z;
		rtn.z.y = this.y.z;
		rtn.z.z = thix.z.z;
		
		return rtn;
		
	}
	
	this.inverse = function() {
		var rtn = new Matrix3D();
		var tmp = [];
		var a00 = this.x[0], a01 = this.x[1], a02 = this.x[2],
				a10 = this.y[0], a11 = this.y[1], a12 = this.y[2],
				a20 = this.z[0], a21 = this.z[1], a22 = this.z[2],
				
				b01 = a22 * a11 - a12 * a21,
				b11 = -a22 * a10 + a12 * a20,
				b21 = a21 * a10 - a11 * a20,
				
				det = a00 * b01 + a01 * b11 + a02 * b21;
				
		if (!det){
			return null;
		}
		det = 1.0/det; 
		
		tmp[0] = b01 * det;
		tmp[1] = (-a22 * a01 + a02 * a21) * det;
		tmp[2] = (a12 * a01 - a02 * a11) * det;
		tmp[3] = b11 * det;
		tmp[4] = (a22 * a00 - a02 * a20) * det; 
		tmp[5] = (-a12 * a00 + a02 * a10) * det;
		tmp[6] = b21 * det; 
		tmp[7] = (-a21 * a00 + a01 * a20) * det;
		tmp[8] = (a11 * a00 - a01 * a10) * det; 
		
		rtn.populateFromArray(tmp);
	}
	
	this.scalarMul = function(scalar) {
		
		this.x.scale(scalar);
		this.y.scale(scalar);
		this.z.scale(scalar);
		
	}
	
	this.matMul = function( matrix ) {
		
		var rtn = new Matrix3D();
		var argument = matrix.transpose();
		
		rtn.x = new Vector( this.x.dotProduct(argument.x), this.x.dotProduct(argument.y), this.x.dotProduct(argument.z) );
		rtn.y = new Vector( this.y.dotProduct(argument.x), this.y.dotProduct(argument.y), this.y.dotProduct(argument.z) );
		rtn.z = new Vector( this.z.dotProduct(argument.x), this.z.dotProduct(argument.y), this.z.dorProduct(argument.z) );
		
		return rtn;
		
	}
	
	this.determinate = function() {
		
		var determinate = 0.0;
		
		determinate += this.x[0] * ( (this.y[1] * this.z[2]) - (this.y[2] * this.z[1]) );
		determinate += this.x[1] * ( (this.y[2] * this.z[0]) - (this.y[0] * this.z[2]) );
		determinate += this.x[2] * ( (this.y[0] * this.z[1]) - (this.y[1] * this.z[0]) );
	}
	
	this.toFloat32Array = function() {
		return new Float32Array([
			this.x.x,	this.x.y,	this.x.z,
			this.y.x,	this.y.y,	this.y.z,
			this.z.x,	this.z.y,	this.z.z
			])
	}
	
	this.crossProduct = function(){
		var i; //identity vector x 
		var j; //identity vector y 
		var k; //identity vector z 
		
		i = ((this.y.z * this.z.y) - (this.y.y * this.z.z));
		j = -1 * ((this.z.y * this.x.z) - (this.x.y * this.z.z));
		k = ((this.x.y * this.y.z) - (this.x.z * this.y.y));
		
		var cross = new Vector(i, j, k); //return the new vector
		return cross; //return the new normal vector
	}
}
/*
 * Matrix4D : 4 dimensional matrix class with support operations
 */

function Matrix4D() {
	this.x = new Vector4D(0.0, 0.0, 0.0, 0.0);
	this.y = new Vector4D(0.0, 0.0, 0.0, 0.0);
	this.z = new Vector4D(0.0, 0.0, 0.0, 0.0);
	this.w = new Vector4D(0.0, 0.0, 0.0, 0.0);
	
	this.populateFromArray = function ( array ) {
		this.x = new Vector4D(array[0], array[1], array[2], array[3]);
		this.y = new Vector4D(array[4], array[5], array[6], array[7]);
		this.z = new Vector4D(array[8], array[9], array[10], array[11]);
		this.w = new Vector4D(array[12], array[13], array[14], array[15]);
	}
	
	this.rowVecMult = function(vector) {
		
		var rtn = new Vector4D( 0.0, 0.0, 0.0, 0.0 );
		
		rtn.x = vector.x * this.x.x + vector.y * this.y.x + vector.z * this.z.x + vector.w * this.w.x;
		rtn.y = vector.x * this.x.y + vector.y * this.y.y + vector.z * this.z.y + vector.w * this.w.y;
		rtn.z = vector.x * this.x.z + vector.y * this.y.z + vector.z * this.z.z + vector.w * this.w.z;
		rtn.w = vector.x * this.x.w + vector.y * this.y.w + vector.z * this.z.w + vector.w * this.w.w;
		
		return rtn;
	}
	
	this.colVecMult = function (vector) {
		return new Vector4D( this.x.dotProduct(vector),
							 this.y.dotProduct(vector),
							 this.z.dotProduct(vector),
							 this.w.dotProduct(vector) );
		
	}
	
	
	this.transpose = function() {
		var rtn = new Matrix3D();
		
		rtn.x = new Vector4D(this.x.x, this.y.x, this.z.x, this.w.x);
		rtn.y = new Vector4D(this.x.y, this.y.y, this.z.y, this.w.y);
		rtn.z = new Vector4D(this.x.z, this.y.z, this.z.z, this.w.z);
		rtn.w = new Vector4D(this.x.w, this.y.w, this.z.w, this.w.w);
		
		return rtn;
		
	}
	
	this.inverse = function() {
		var rtn = new Matrix4D();
		var out = [];
		var a00 = this.x.x, a01 = this.x.y, a02 = this.x.z, a03 = this.x.w,
				a10 = this.y.x, a11 = this.y.y, a12 = this.y.z, a13 = this.y.w,
				a20 = this.z.x, a21 = this.z.y, a22 = this.z.z, a23 = this.z.w,
				a30 = this.w.x, a31 = this.w.y, a32 = this.w.z, a33 = this.w.w,

				
        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32;

        // Calculate the determinant
        var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) { 
        return null; 
    }
		det = 1.0 / det;
		
		out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
		out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
		out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
		out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
		out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
		out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
		out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
		out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
		out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
		out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
		out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
		out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
		out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
		out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
		out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
		out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
		rtn.populateFromArray(out);
		
		return rtn;
	}
	
	this.scalarMul = function(scalar) {
		
		this.x.scale(scalar);
		this.y.scale(scalar);
		this.z.scale(scalar);
		this.w.scale(scalar);
		
	}
	
	this.matMul = function( matrix ) {
		
		var rtn = new Matrix4D();
		var argument = matrix.transpose();
		
		rtn.x = new Vector4D( this.x.dotProduct(argument.x), this.x.dotProduct(argument.y), this.x.dotProduct(argument.z), this.x.dotProduct(argument.w) );
		rtn.y = new Vector4D( this.y.dotProduct(argument.x), this.y.dotProduct(argument.y), this.y.dotProduct(argument.z), this.y.dotProduct(argument.w) );
		rtn.z = new Vector4D( this.z.dotProduct(argument.x), this.z.dotProduct(argument.y), this.z.dotProduct(argument.z), this.z.dotProduct(argument.w) );
		rtn.w = new Vector4D( this.w.dotProduct(argument.x), this.w.dotProduct(argument.y), this.w.dotProduct(argument.z), this.w.dotProduct(argument.w) );
		
		return rtn;
		
	}
	
	this.determinant = function() {
		// Not neccessary for now
		console.log("Error : Unimplemented Matrix4D.determinant called");
		return 1;
	}
	
	this.toFloat32Array = function() {
		return new Float32Array([
				this.x.x,	this.x.y,	this.x.z, 	this.x.w,
				this.y.x,	this.y.y,	this.y.z,	this.y.w,
				this.z.x,	this.z.y,	this.z.z,	this.z.w,
				this.w.x,	this.w.y,	this.w.z,	this.w.w
			])
	}

	
}


/*
 * initBuffers serves to initialize the buffers, but can also be used to flush them in a pinch
 */

function initBuffers() {
	
	vBuffer_S1 = gl.createBuffer(); //vertex buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer_S1);
	gl.bufferData(gl.ARRAY_BUFFER, MAX_POINTS*12, gl.STATIC_DRAW);
	vBuffer_S1.itemSize = 3; //3 components x-y-z
	vBuffer_S1.numSize = 2560; //number of vertices
	
	//normal buffer	
	nBuffer_S1 = gl.createBuffer();  //this will be the normal buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer_S1);
	gl.bufferData(gl.ARRAY_BUFFER, MAX_POINTS*12, gl.STATIC_DRAW);
	
}

//Here we are binding the framebuffer and creating the texture
//to read pixels from
function createFBO(){
	//create the frame buffer (FBO)
	pixelVal = new Uint8Array(800* 800 *4);
	fbo = gl.createFramebuffer();
	fbo.width = 800; //frame covers the entire canvas
	fbo.height = 800;
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	
	//create the texture
	fboTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, fboTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fbo.width, fbo.height, 0,
						gl.RGBA, gl.UNSIGNED_BYTE, null);
						
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	
	//attach the texture to the framebuffer
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTexture, 0);
	gl.readPixels(0,0, 800, 800, gl.RGBA, gl.UNSIGNED_BYTE, pixelVal);
	
	gl.uniform1i(program.fboUniform, 1);
	gl.viewport(0, 0, fbo.width, fbo.height); //render scene to the fbo
	
	//unbind frame and texture buffers
	gl.bindTexture(gl.TEXTURE_2D, null);
	//gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}


// This is for the mouse click events
// With each click we check which shark has been clicked. 
function handleMouseClick(event){
	
	//alert('this is the mouse handler!');
	//bind the frame buffer so that we can read it
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.readPixels(0,0, 800, 800, gl.RGBA, gl.UNSIGNED_BYTE, pixelVal); //reading the pixels from the last frame
	var colorAddress = (800 - event.clientY) * 800 * 4 + event.clientX * 4;
	
	//0.0, 0.0, 1.0, 1.0 -- background color					
	if(pixelVal[colorAddress] == 0 && pixelVal[colorAddress+1] == 0 && pixelVal[colorAddress+2] == 255){
		console.log( "NOT THE SHARK");
	}else if(pixelVal[colorAddress] == 255 && pixelVal[colorAddress+1] == 0 && pixelVal[colorAddress+2] == 0){
		console.log("First Shark");
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		//initBuffers();
		//transform();
		render();
	}else{
		console.log("Second Shark");
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		//initBuffers();
		//transform();
		render();
	}
}

/*
 * Examine the first shark
 */
 
function examine(){ 
	 setInterval(function(){
			theta += Math.PI*2; 
			transform(translate[0], translate[1], translate[2], rotate, scale, zoom, theta);
			render(); } , 100);
} 


/*
 * Update camera transformations
*/
function updateCameraPos(index, value){
	pan[index] = parseFloat(value);
	transformCamera(pan[0], pan[1], pan[2]); 
	render();  // rerender the scene 
}

function updateCameraZoom(value){
	zoom = parseFloat(value);
	transform(translate[0], translate[1], translate[2], rotate, scale, zoom,theta);
	render();  //rerender the scene 
	//console.log(zoom);
}



/* Update values for transformation matrix 
 */

 function updateTranslate(index, value) {
      translate[index] = parseFloat(value);
	  transform(translate[0], translate[1], translate[2], rotate, scale, zoom, theta);
	  render();
	  console.log(translate);
}
  
 function updateRotate(value){
	rotate = parseFloat(value);
	transform(translate[0], translate[1], translate[2],	rotate, scale, zoom, theta);
	render();
	console.log(rotate);
 }
 
 function updateScale(value){
	scale = parseFloat(value);
	transform(translate[0], translate[1], translate[2], rotate, scale, zoom, theta);
	render();
	console.log(scale);
 }
 
/*
*	Function used to create and set projection and other matrix 
*	transformations
*/
var theta = 0; 
function transform(x, y, z, r, s, zoom, theta) {

	/*
	 * Obj -> World Translation
	 */
	
	//translate
	var transformation = makeTranslation3D(( -1* xDim/4.5) + x, (-1 * yDim/3.0) + y, z);
	
	var target = [transformation[12]+theta, transformation[13]+theta, transformation[14]+theta]; //shark pos for lookat
	
	var operand = new Matrix4D();
	var transMatrix = new Matrix4D(); //transformation matrix 
	transMatrix.populateFromArray(transformation); //init transformation
	
	var foV = zoom/100; 
	transformation = makePerspectiveMatrix(foV, 1, -10, 2000); 
	operand.populateFromArray(transformation);
	transMatrix = transMatrix.matMul(operand); 
	
	var up = [0,1,0]; //y axis
	var camPos = [-50.0 +theta , -50.0, 40.0];
	transformation = lookAtMatrix(camPos,target, up); 
	operand.populateFromArray(transformation);
	var viewMatrix = operand.inverse(); //invert lookAt Matrix 
	transMatrix = transMatrix.matMul(viewMatrix); 
	
	
	//scale
	var sX = s / xDim - 1.0;
	var sY = s / yDim - 1.5;
	var sZ = 1.0
	transformation = makeScale3D( sX, sY, sZ );
	var operand = new Matrix4D();
	operand.populateFromArray(transformation);
	transMatrix = transMatrix.matMul(operand);
	
	
	//vertices are now in world coordinates, setting up camera view and scaling to canvas
	//orient for isometric view
	//orient for perspective view
		
	//rotate on Z to swing camers to <1,1,1>
	//transformation = makeRotation3DY(Math.PI/2.5);
	//operand.populateFromArray(transformation);
	//transMatrix = transMatrix.matMul(operand);
	
	
	//rotate on z by 45 degrees  
	                  	
	//transformation = makeRotation3DX(Math.PI/r);  
	//operand.populateFromArray(transformation);      
	//transMatrix = transMatrix.matMul(operand);    
	
	//scale to clip coordinates
	transformation = makeScale3D(3.5/510, 2.5/510, 0.8/255);
	operand.populateFromArray(transformation);
	transMatrix = transMatrix.matMul(operand);
	
	//transformation = makeZToWMatrix(-1.0);//perspective matrix  
	//operand.populateFromArray(transformation);
	//transMatrix = transMatrix.matMul(operand); 
	
	return transMatrix;
	
}

/*
 * generate is a function utilized to capture user entered values from the html side of the application
 */
function generate() {
	
	var formData = document.getElementById("frm1").elements;
	
	if(parseFloat(formData[0].value) > MAX_XDIM || parseFloat(formData[1].value) > MAX_YDIM) {
		alert("Error : Exceeding maximum xDim or yDim");
		return
	}
	
	xDim = parseFloat(formData[0].value);
	yDim = parseFloat(formData[1].value);
	
	populateNormals(); //create the normal matrix 
	initBuffers();
	//createFBO();
	render();

}
	
function populateNormals(){ 
	NORMAL_COORD = new Array(2560);
	//var coord_tmp;
	var k 
	for(var i = 0; i < SHARK_POLY.length; ++i){
		for(var j = 1; j < SHARK_POLY[i].length;){ //work on each triad (3)
			var coord1 = SHARK_POLY[i][j]; //vertex number at that index
			j++;
			var coord2 = SHARK_POLY[i][j];
			j++;
			var coord3 = SHARK_POLY[i][j];
			j++
			
			//off by one error 
			coord1 = coord1 -1; 
			coord2 = coord2 - 1; 
			coord3 = coord3 - 1;
			
			var pointA = new Vector(SHARK_COORD[coord1][0], SHARK_COORD[coord1][1], SHARK_COORD[coord1][2]); //variable # + coordinate
			var pointB = new Vector(SHARK_COORD[coord2][0], SHARK_COORD[coord2][1], SHARK_COORD[coord2][2]);
			var pointC = new Vector(SHARK_COORD[coord3][0], SHARK_COORD[coord3][1], SHARK_COORD[coord3][2]);
			
				
			var A_B  = pointA.sub(pointB); //A - B 
			var A_C = pointA.sub(pointC);
			//cross these two vectors to get the normal
			createCross(i, A_B, A_C); //returns an array x,y,z,1
			
			var A_N = A_C; 
			
			if(SHARK_POLY[i].length == 4){
				break; 
			}else{
				//get the remaining vertices
				for(k = SHARK_POLY[i].length - j; k < SHARK_POLY[i].length; ++k){
					coord = SHARK_POLY[i][k];
					//++k;
					
					//off by one error 
					coord = coord - 1; 
			        var pointD = new Vector(SHARK_COORD[coord][0], SHARK_COORD[coord][1], SHARK_COORD[coord][2]);
					
					var A_D = pointA.sub(pointD);
					//cross these two vectors to get the normal
					createCross(i, A_N, A_D); //returns an array x,y,z,1
				}
			} 
			j += k;
		}
	}
	console.log(NORMAL_COORD.length);
	console.log(SHARK_COORD.length);
}	

/*
* This new function will take two vectors, create an array from them
* create a matrix3D from this info
* take the cross product of this matrix
* return a new vector
*/

function createCross(vnum, vecA, vecB){

	var tempArray = [
	1.0, vecA.x, vecB.x,
	1.0, vecA.y, vecB.y,
	1.0, vecA.z, vecB.z,
	];
	
	var crossMatrix = new Matrix3D(); //create matrix
	crossMatrix.populateFromArray(tempArray); 
	
	var crossVec = crossMatrix.crossProduct();
	var tempVec = crossVec;
	if (crossVec.z < 0){
		crossVec.z = -1*crossVec.z;
	}
	
	//var dist = tempVec.dotProduct(crossVec); // N dot N
	//dist = Math.sqrt(dist);	
	
	//build the new 4D vector
	NORMAL_COORD[vnum] = new Array(4);
	NORMAL_COORD[vnum][0] = crossVec.x;
	NORMAL_COORD[vnum][1] = crossVec.y;
	NORMAL_COORD[vnum][2] = crossVec.z;
	NORMAL_COORD[vnum][3] = 1.0;
	
}


/*
 * render uses the set of mandelbrot coordinates to generate a set of quads.
 * 
 * this could be made more efficient by finding a way to eliminate redunant operations on interior vertices
 */

function render() {
	
	//object transformations
	var objMatrix = transform(translate[0], translate[1], translate[2], rotate, scale, zoom, theta); 		
	var projMat = gl.getUniformLocation(program, "projectionMat");
	gl.uniformMatrix4fv(projMat, false, objMatrix.toFloat32Array());
	
	//shark 1 color 
	var colorLocation = gl.getUniformLocation(program, "vColor");
	
	//render
	gl.clearDepth(0.0);
	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.GREATER);
	gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	
	//enable vertex attributes from shader
	gl.enableVertexAttribArray(program.vPosition_S1);
	gl.enableVertexAttribArray(program.vNormal_S1);
	
	gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer_S1);	
	gl.vertexAttribPointer(program.vPosition_S1, 3, gl.FLOAT, false, 0, 0);

	//vertex normals 
	gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer_S1); //bind buff to normal vector
	gl.vertexAttribPointer(program.vNormal_S1, 3, gl.FLOAT, false, 0,0);
	
	gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer_S1);
	
	var pointCount = 0;
	//global variable SHARK_COORD 
	//for each entry in shark_poly, look at the coord number,
	//iterate through each vertex number 
	//then grab the corresponding vector from shark_coor
	//buffer this data
	//then draw the array
	for(var i = 0; i < SHARK_POLY.length -1; ++i){
		var j;
		for (j = 0; j < SHARK_POLY[i].length - 1; ++j){
			var vNum = SHARK_POLY[i][j+1]; //vertex number at that index
			vNum = vNum -1; //off by one error

			//buffer the vertex positions 
			var point = new Vector(SHARK_COORD[vNum][0], SHARK_COORD[vNum][1], SHARK_COORD[vNum][2]);
			gl.bufferSubData(gl.ARRAY_BUFFER, 12*pointCount, point.toFloat32Array());
			
			//buffer the vertex normals
			var normPoint = new Vector(NORMAL_COORD[vNum][0], NORMAL_COORD[vNum][1], NORMAL_COORD[vNum][2]);
			gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer_S1);
			gl.bufferSubData(gl.ARRAY_BUFFER, 12*pointCount, normPoint.toFloat32Array());
			
			gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer_S1); 
			pointCount++;
			
		}
		//set color to (1.0, 0.0, 0.5, 1.0)
		gl.uniform4f(colorLocation, 255, 0, 0, 1);
		gl.drawArrays(gl.TRIANGLE_FAN, pointCount - j, j);
	}
	
	//set color for second shark
	var color2Location = gl.getUniformLocation(program, "vColor");
	
	//drawing the second shark
	//transform second shark
	var trans2Matrix = transform(translate[0], translate[1], translate[2] +110, rotate, scale, zoom, theta); //needs an offset
	var proj2Mat = gl.getUniformLocation(program, "projectionMat");
	gl.uniformMatrix4fv(proj2Mat, false, trans2Matrix.toFloat32Array());
	
	gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer_S1);
	var point = 0;
	for(var i = 0; i < SHARK_POLY.length-1; ++i){
		var j;
		for (j = 0; j < SHARK_POLY[i].length-1; ++j){
			var vNum = SHARK_POLY[i][j+1]; //vertex number at that index
			vNum = vNum -1; //off by one error

			//buffer the vertex positions 
			var pointA = new Vector(SHARK_COORD[vNum][0], SHARK_COORD[vNum][1], SHARK_COORD[vNum][2]);
			gl.bufferSubData(gl.ARRAY_BUFFER, 12*point, pointA.toFloat32Array());
			
			//gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer_S1);
			point++;
		}
		//set color to (1.0, 0.0, 0.5, 1.0)
		gl.uniform4f(colorLocation, 0, 255, 0, 1);
		gl.drawArrays(gl.TRIANGLE_FAN, point - j, j);
	}
	
}

/*
 * init sets up and compiles the shaders and initializes the GL context
 */

window.onload = function init() {
	rMax = 100;
	MAX_HEIGHT = 255;
	
	//compile gl shaders
		//fragment shader, assign all verts white
	fShader = [
		"precision mediump float;",
		"uniform int uFBO;",
		"uniform vec4 vColor;", //set color for each shark
		
		"varying highp vec4 pos;",
		"varying highp vec4 norm;",

		"const vec3 lightLoc = vec3(1.0, 1.0, 1.0);",
		
		
		"void",
		"main()",
		"{",
			
			//use basic shading
			"vec4 normal = normalize(norm);",
			"vec3 lightWeighting;",
			"vec3 specColor = vec3(0.0, 1.0, 0.0);",
			"vec4 color_tmp = vColor;",
			"gl_FragColor = color_tmp;",
		"}",
		
	].join('\n');
	
	//vertex shader, no longer passthrough
	//this has a uniform 4D matrix that will be applied to vertices processed
	//in this pipeline.
	vShader = [
		"attribute vec4 vPosition_S1;", //vertex position
		"attribute vec4 vNormal_S1;", // normal vector position
		
		"uniform mat4 lookAtM;", //camera matrix 
		"uniform mat4 pMatrix;", //perspective matrix 
		"uniform  mat4 projectionMat;", //projection matrix
		
		"varying highp vec4 pos;", //pos for frag
		"varying highp vec4 norm;", //norm for frag
		
		"void",
		"main()",
		"{",
			"gl_PointSize = 1.0;",
			"pos = projectionMat * vPosition_S1;",
    		"gl_Position = pos;",
			"norm = abs(vNormal_S1);", //transform the normal vectors
		"}",
	].join('\n');
	
	//arbitrary maxes to 
	MAX_XDIM = 160;
	MAX_YDIM = 120;
	MAX_POINTS = 75700;
	
	
	//slider variables 
	translate = [50.0, 50.0, -40.0]; 
	rotate = 8.0;
	scale = 510;
	
	//camera slider values
	pan = [50.0, 50.0, -40.0];
	zoom = 8.0; 
	
	//initialize gl
	canvas = document.getElementById( "gl-canvas" );
	
	gl = WebGLUtils.setupWebGL( canvas );
	if ( !gl ) { alert( "WebGL isn't available" ); }
	
	//adjust the viewport to cover the entirity of the canvas from (0,0) to upper right
	gl.viewport(0, 0, canvas.width, canvas.height);
	//set the clear bit
	gl.clearColor( 0.0, 0.0, 1.0, 1.0 );
	
	//compie shaders
    program = initShaders(gl, vShader, fShader);
    gl.useProgram( program );
	
	//render a blank screen to prepare for generation
	gl.clear( gl.COLOR_BUFFER_BIT);
	
	generate(); //generate the mesh 
	//sending mouse click events
	//canvas.onmousedown = handleMouseClick;
	
	// Bind to x translate slider
    $('#transX').on('input change', function (event) {
      updateTranslate(0, $('#transX').val());
    });

    // Bind to y translate slider
    $('#transY').on('input change', function (event) {
      updateTranslate(1, $('#transY').val());
    });

    // Bind to z translate slider
    $('#transZ').on('input change', function (event) {
      updateTranslate(2, $('#transZ').val());
    });

	   // Bind to x rotation
    $('#rotateX').on('input change', function (event) {
      updateRotate($('#rotateX').val());
    });
	
	// Bind to scaling
    $('#scale').on('input change', function (event) {
      updateScale($('#scale').val());
    });
	
	//camera zoom
	$('#cameraZoom').on('input change', function(event){
		updateCameraZoom($('#cameraZoom').val());
	});
	
	
	//camera translate on y plane 
	//$('#cameraPanY').on('input change', function(event){
	//	updateCameraPos(1, $('#cameraPanY'));
	//});
}
