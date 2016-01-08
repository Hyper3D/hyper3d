
#pragma require VS_BaseGeometry
#pragma parameter usePointSize

uniform mat4 u_viewProjectionMatrix;
uniform mat4 u_viewMatrix;

#if c_usePointSize
uniform mat4 u_pointSizeMatrix;
#endif

void main()
{
    evaluateGeometry();

    gl_Position = u_viewProjectionMatrix * vec4(worldPosition, 1.);
    gl_Position.z += 0.001 * gl_Position.w; // polygonOffset sometimes doesn't work well?

#if c_usePointSize
	gl_PointSize = 4.;
	// TODO: gl_PointSize
#endif
}

