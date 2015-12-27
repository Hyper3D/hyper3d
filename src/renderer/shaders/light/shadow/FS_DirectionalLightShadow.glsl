#pragma require DepthFetch
#pragma require ShadowTexture

#pragma parameter clipByFarPlane
#pragma parameter clipByNearPlane

#extension GL_OES_standard_derivatives : enable

uniform sampler2D u_linearDepth;

varying highp vec2 v_texCoord;
varying highp vec2 v_viewDir;

uniform highp float u_farPlane;
uniform highp float u_nearPlane;

uniform mat4 u_shadowMapMatrix;
uniform highp sampler2D u_shadowMap;

uniform float u_shadowMapZScale;

// warning: result.x is inverted (1 = occluded)
highp vec2 shadowTexture2DWithDistance(highp sampler2D tex, highp vec3 coord)
{
    highp float value = texture2D(tex, coord.xy).r;
    return vec2(1., coord.z - value) * step(value, coord.z);
}

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

    // search blocker
    // FIXME: this is too slow
    vec3 scale = u_globalRenderSize.xyx * 0.02;
    vec3 offX = dFdx(shadowCoord) * scale;
    vec3 offY = dFdy(shadowCoord) * scale;
    vec2 blockerSum = vec2(1., depth) * 0.0001; // default value
    blockerSum += shadowTexture2DWithDistance(u_shadowMap, shadowCoord);
    blockerSum += shadowTexture2DWithDistance(u_shadowMap, shadowCoord + offX + offY);
    blockerSum += shadowTexture2DWithDistance(u_shadowMap, shadowCoord + offX - offY);
    blockerSum += shadowTexture2DWithDistance(u_shadowMap, shadowCoord - offX + offY);
    blockerSum += shadowTexture2DWithDistance(u_shadowMap, shadowCoord - offX - offY);

    offX *= 2.; offY *= 2.;
    blockerSum += shadowTexture2DWithDistance(u_shadowMap, shadowCoord + offX + offY);
    blockerSum += shadowTexture2DWithDistance(u_shadowMap, shadowCoord + offX - offY);
    blockerSum += shadowTexture2DWithDistance(u_shadowMap, shadowCoord - offX + offY);
    blockerSum += shadowTexture2DWithDistance(u_shadowMap, shadowCoord - offX - offY);
    blockerSum += shadowTexture2DWithDistance(u_shadowMap, shadowCoord + offX);
    blockerSum += shadowTexture2DWithDistance(u_shadowMap, shadowCoord - offX);
    blockerSum += shadowTexture2DWithDistance(u_shadowMap, shadowCoord + offY);
    blockerSum += shadowTexture2DWithDistance(u_shadowMap, shadowCoord - offY);

    float penumbraSize = (blockerSum.y / blockerSum.x) * u_shadowMapZScale / depth * shadowCoordProj.w * 0.1;

    gl_FragColor = vec4(shadowValue, penumbraSize, 0., 1.);
}