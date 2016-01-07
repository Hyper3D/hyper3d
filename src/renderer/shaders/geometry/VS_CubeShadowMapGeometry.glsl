
#pragma require VS_BaseGeometry
#pragma parameter usePointSize

uniform mat4 u_viewProjectionMatrix;
uniform mat4 u_viewMatrix;

varying vec3 v_viewPosition;
uniform float u_viewPositionScale;

void main()
{
    evaluateGeometry();

    gl_Position = u_viewProjectionMatrix * vec4(worldPosition, 1.);

    v_viewPosition = (u_viewMatrix * vec4(worldPosition, 1.)).xyz * u_viewPositionScale;

#if c_usePointSize
	gl_PointSize = 4.;
	// TODO: gl_PointSize
#endif
}

