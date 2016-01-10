
#pragma require VS_BaseGeometry
#pragma parameter usePointSize

varying vec3 v_viewPosition;
uniform float u_viewPositionScale;

uniform vec2 u_halfRenderSize;

void main()
{
    evaluateGeometry();

    gl_Position = u_viewProjectionMatrix * vec4(worldPosition, 1.);

    v_viewPosition = (u_viewMatrix * vec4(worldPosition, 1.)).xyz * u_viewPositionScale;

#if c_usePointSize
    gl_PointSize = computeProjectedPointSize(m_pointSize, u_projectionMatrix, gl_Position, u_halfRenderSize);
#endif
}

