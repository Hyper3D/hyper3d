#pragma require FS_BaseVolumetricLight
#pragma require Pack
#pragma parameter hasShadowMap

uniform highp vec3 u_lightPos;
uniform highp float u_lightInvInfluenceRadiusSquared;
uniform highp float u_minimumDistance; // squared
uniform highp float u_lightRadius;
uniform highp float u_lightLength;
uniform vec3 u_lightDir; // capsule

#if c_hasShadowMap
uniform samplerCube u_shadowMap;
uniform sampler2D u_jitter;
uniform highp mat4 u_shadowMapMatrix;
uniform vec2 u_jitterAmount;
uniform float u_invDistanceToJitter;
#endif

float shadowTextureCubePack24(samplerCube tex, highp vec3 coord, highp float comparand)
{
    highp float value = unpack24(textureCube(tex, coord.xyz).xyz);
    return step(comparand, value);
}

void makePerpendicularVectors(vec3 source, out vec3 out1, out vec3 out2)
{
    vec3 up = abs(source.z) > sqrt(0.5) ? vec3(1., 0., 0.) : vec3(0., 0., 1.);
    out1 = normalize(cross(source, up));
    out2 = cross(source, out1);
}

void main()
{
	setupVolumetricLight();

#if c_hasShadowMap

    vec3 shadowCoord = (u_shadowMapMatrix * vec4(viewPos, 1.)).xyz;

    float shadowDist = length(shadowCoord);
    shadowCoord = normalize(shadowCoord);

    float shadowValue = 0.;
    vec4 jitter1 = texture2D(u_jitter, v_ditherCoord.xy) - 0.5;
    vec4 jitter2 = texture2D(u_jitter, v_ditherCoord.yx + .5) - 0.5;

    vec2 jamt = u_jitterAmount;
    jamt += u_invDistanceToJitter / shadowDist; // soft shadow near the light

    jitter1 *= jamt.xyxy;
    jitter2 *= jamt.xyxy;

    vec3 jitterVec1, jitterVec2;
    makePerpendicularVectors(shadowCoord, jitterVec1, jitterVec2);

    shadowDist -= 0.001;

    shadowValue += shadowTextureCubePack24(u_shadowMap, shadowCoord + jitter1.x * jitterVec1 + jitter1.y * jitterVec2, shadowDist);
    shadowValue += shadowTextureCubePack24(u_shadowMap, shadowCoord + jitter1.z * jitterVec1 + jitter1.w * jitterVec2, shadowDist);
    shadowValue += shadowTextureCubePack24(u_shadowMap, shadowCoord + jitter2.x * jitterVec1 + jitter2.y * jitterVec2, shadowDist);
    shadowValue += shadowTextureCubePack24(u_shadowMap, shadowCoord + jitter2.z * jitterVec1 + jitter2.w * jitterVec2, shadowDist);

    if (shadowValue < 0.0001) {
        discard;
    }

    shadowValue *= 1. / 4.;

#else // c_hasShadowMap

    float shadowValue = 1.;

#endif // c_hasShadowMap

    highp vec3 lightDir = u_lightPos - viewPos;
    float dist = dot(lightDir, lightDir) * u_lightInvInfluenceRadiusSquared;

    if (dist >= 1.) {
        discard;
    }

    if (u_lightRadius > 0. || u_lightLength > 0.) {
        // TODO: sized point light
    }

    highp float strength = 1. - dist;

    strength *= u_lightStrength / max(u_minimumDistance, dot(lightDir, lightDir));

	emitVolumetricLightOutput(u_lightColor * (strength * shadowValue));
}
