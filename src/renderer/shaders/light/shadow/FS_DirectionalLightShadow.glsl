#pragma require DepthFetch
#pragma require ShadowTexture

#pragma parameter clipByFarPlane
#pragma parameter clipByNearPlane

uniform sampler2D u_linearDepth;

varying highp vec2 v_texCoord;
varying highp vec2 v_viewDir;

uniform highp float u_farPlane;
uniform highp float u_nearPlane;

uniform mat4 u_shadowMapMatrix;
uniform highp sampler2D u_shadowMap;

void main()
{
	highp float depth = fetchDepth(u_linearDepth, v_texCoord);

#if c_clipByFarPlane
	if (depth > u_farPlane) {
		discard;
	}
#endif
#if c_clipByNearPlane
	if (depth < u_nearPlane) {
		discard;
	}
#endif

	highp vec3 viewDir = vec3(v_viewDir, 1.);
    highp vec3 viewPos = viewDir * -depth;

    vec4 shadowCoordProj = u_shadowMapMatrix * vec4(viewPos, 1.);
    vec3 shadowCoord = shadowCoordProj.xyz / shadowCoordProj.w;

    float shadowValue = shadowTexture2D(u_shadowMap, shadowCoord);
    gl_FragColor = vec4(vec3(shadowValue), 1.);
}