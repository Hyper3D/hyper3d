#pragma parameter useNormalMap

#pragma attribute position
#pragma attribute normal
#pragma attribute tangent

uniform mat4 u_viewModelProjectionMatrix;
uniform mat4 u_viewModelMatrix;
attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec3 a_tangent;
varying vec3 v_viewNormal;
#if c_useNormalMap
varying vec3 v_viewTangent;
varying vec3 v_viewBitangent;
#endif
varying vec2 v_screenVelocity;

void computeExtraValues();

void main()
{
	gl_Position = u_viewModelProjectionMatrix * vec4(a_position, 1.);
	
	v_viewNormal = (u_viewModelMatrix * vec4(a_normal, 0.)).xyz;
#if c_useNormalMap
	v_viewTangent = (u_viewModelMatrix * vec4(a_tangent, 0.)).xyz;
	v_viewBitangent = cross(v_viewNormal, v_viewTangent);
#endif
	v_screenVelocity = vec2(0., 0.); // TODO
	
	computeExtraValues();
}
