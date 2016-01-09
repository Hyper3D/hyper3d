#pragma parameter useNormalMap

#pragma require VS_BaseGeometry
#pragma parameter usePointSize

uniform mat4 u_viewProjectionMatrix;
uniform mat4 u_viewMatrix;
#if c_usePointSize
uniform mat3 u_pointSizeMatrix;
#endif

varying float v_depth;

void main()
{
    evaluateGeometry();

    gl_Position = u_viewProjectionMatrix * vec4(worldPosition, 1.);

    v_depth = -(u_viewMatrix * vec4(worldPosition, 1.)).z;

#if c_usePointSize
	vec3 pointSize = u_pointSizeMatrix * vec3(m_pointSize, -v_depth, 1.);
	gl_PointSize = pointSize.x / pointSize.z;
#endif
}
