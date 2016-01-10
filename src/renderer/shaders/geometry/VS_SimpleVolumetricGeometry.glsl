#pragma require VS_BaseGeometry
#pragma parameter useNormalMap
#pragma parameter usePointSize

varying vec4 v_position;
varying float v_depth;

void main()
{
    evaluateGeometry();

    gl_Position = u_viewProjectionMatrix * vec4(worldPosition, 1.);
    v_position = gl_Position;

    v_depth = -(u_viewMatrix * vec4(worldPosition, 1.)).z;

#if c_usePointSize
    gl_PointSize = computeProjectedPointSize(m_pointSize, u_projectionMatrix, gl_Position, u_globalHalfRenderSize);
#endif
}
