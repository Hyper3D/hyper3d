#pragma require LogRGB
#pragma parameter kernelSize

varying highp vec2 v_texCoord;

uniform sampler2D u_input;

uniform highp vec2 u_texCoordIncr;

// In WebGL 1.0, array of uniforms is not allowed in fragment shader
uniform float u_weight1;
#if c_kernelSize >= 2
uniform float u_weight2;
#endif
#if c_kernelSize >= 3
uniform float u_weight3;
#endif
#if c_kernelSize >= 4
uniform float u_weight4;
#endif
#if c_kernelSize >= 5
uniform float u_weight5;
#endif
#if c_kernelSize >= 6
uniform float u_weight6;
#endif
#if c_kernelSize >= 7
uniform float u_weight7;
#endif
#if c_kernelSize >= 8
uniform float u_weight8;
#endif
#if c_kernelSize >= 9
uniform float u_weight9;
#endif
#if c_kernelSize >= 10
uniform float u_weight10;
#endif
#if c_kernelSize >= 11
uniform float u_weight11;
#endif

vec4 outp = vec4(0.);
highp vec2 coord = v_texCoord;

void addOne(float weight)
{
	outp += weight * texture2D(u_input, coord);
	coord += u_texCoordIncr;
}

void main()
{
#if c_kernelSize >= 1
	addOne(u_weight1);
#endif
#if c_kernelSize >= 2
	addOne(u_weight2);
#endif
#if c_kernelSize >= 3
	addOne(u_weight3);
#endif
#if c_kernelSize >= 4
	addOne(u_weight4);
#endif
#if c_kernelSize >= 5
	addOne(u_weight5);
#endif
#if c_kernelSize >= 6
	addOne(u_weight6);
#endif
#if c_kernelSize >= 7
	addOne(u_weight7);
#endif
#if c_kernelSize >= 8
	addOne(u_weight8);
#endif
#if c_kernelSize >= 9
	addOne(u_weight9);
#endif
#if c_kernelSize >= 10
	addOne(u_weight10);
#endif
#if c_kernelSize >= 11
	addOne(u_weight11);
#endif
	gl_FragColor = outp;
}
