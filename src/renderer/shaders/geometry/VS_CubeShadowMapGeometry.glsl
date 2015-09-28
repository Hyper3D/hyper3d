
#pragma require VS_BaseGeometry

uniform mat4 u_viewProjectionMatrix;
uniform mat4 u_viewMatrix;

varying vec3 v_viewPosition;
uniform float u_viewPositionScale;

void main()
{
	evaluateGeometry();

	gl_Position = u_viewProjectionMatrix * vec4(worldPosition, 1.);

	v_viewPosition = gl_Position.xyz * u_viewPositionScale;
}

