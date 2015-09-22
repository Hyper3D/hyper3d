// this shader is abstract; must be imported and main function must be provided

#pragma attribute position
#pragma attribute normal
#pragma attribute tangent

uniform mat4 u_modelMatrix;
uniform mat4 u_lastModelMatrix;

attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec3 a_tangent;

vec3 worldPosition;
vec3 worldNormal;
vec3 worldTangent;

vec3 lastWorldPosition;

void computeExtraValues();

void evaluateGeometry()
{
	worldPosition = (u_modelMatrix * vec4(a_position, 1.)).xyz;
	worldNormal = (u_modelMatrix * vec4(a_normal, 0.)).xyz;
	worldTangent = (u_modelMatrix * vec4(a_tangent, 0.)).xyz;

	// TODO: skinning

	lastWorldPosition = (u_lastModelMatrix * vec4(a_position, 1.)).xyz;

	computeExtraValues();
}
