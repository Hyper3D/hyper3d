
#pragma require VS_BaseGeometry
#pragma parameter usePointSize

uniform vec2 u_halfRenderSize;

void main()
{
    evaluateGeometry();

    gl_Position = u_viewProjectionMatrix * vec4(worldPosition, 1.);
    gl_Position.z += 0.001 * gl_Position.w; // polygonOffset sometimes doesn't work well?

#if c_usePointSize
    gl_PointSize = computeProjectedPointSize(m_pointSize, u_projectionMatrix, gl_Position, u_halfRenderSize);
#endif
}

