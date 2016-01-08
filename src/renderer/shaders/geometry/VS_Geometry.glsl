#pragma parameter useNormalMap

#pragma require VS_BaseGeometry
#pragma parameter usePointSize

uniform mat4 u_viewProjectionMatrix;
uniform mat4 u_viewMatrix;
varying vec3 v_viewNormal;
#if c_useNormalMap
varying vec3 v_viewTangent;
varying vec3 v_viewBitangent;
#endif
#if c_usePointSize
uniform mat3 u_pointSizeMatrix;
#endif

varying vec4 v_screenPosition;
varying vec3 v_lastScreenPosition;

uniform mat4 u_lastViewProjectionMatrix;
uniform vec2 u_screenVelOffset;

void main()
{
    evaluateGeometry();

    gl_Position = u_viewProjectionMatrix * vec4(worldPosition, 1.);

    v_screenPosition.xyz = gl_Position.xyw;
    v_lastScreenPosition = (u_lastViewProjectionMatrix * vec4(lastWorldPosition, 1.)).xyw;
    v_screenPosition.xy += u_screenVelOffset * v_screenPosition.z;

    v_screenPosition.w = -(u_viewMatrix * vec4(worldPosition, 1.)).z; // depth

    v_viewNormal = (u_viewMatrix * vec4(worldNormal, 0.)).xyz;
#if c_useNormalMap
    v_viewTangent = (u_viewMatrix * vec4(worldTangent, 0.)).xyz;
    v_viewBitangent = cross(v_viewNormal, v_viewTangent);
#endif

#if c_usePointSize
	vec3 pointSize = u_pointSizeMatrix * vec3(m_pointSize, -v_screenPosition.w, 1.);
	gl_PointSize = pointSize.x / pointSize.z;

	v_viewNormal = vec3(0., 0., 1.);
#if c_useNormalMap
    v_viewTangent = vec3(1., 0., 0.);
    v_viewBitangent = vec3(0., -1., 0.);
#endif
#endif
}
