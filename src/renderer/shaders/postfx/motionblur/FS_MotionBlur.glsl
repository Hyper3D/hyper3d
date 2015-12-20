#pragma require GBuffer
#pragma require DepthFetch
#pragma require LogRGB

#pragma parameter numSamples

#pragma parameter useLogRGB

varying highp vec2 v_texCoord;
varying highp vec2 v_jitterCoord;

uniform sampler2D u_g0;
uniform sampler2D u_g1;
uniform sampler2D u_velTile;
uniform sampler2D u_color;
uniform sampler2D u_linearDepth;
uniform sampler2D u_jitter;

uniform vec2 u_velocityScale;
uniform vec2 u_velocityInvScale;
uniform float u_amount;

uniform float u_minimumVelocitySquared;
uniform float u_minimumVelocity;

float cone(float dist, float vel)
{
    return clamp(1. - dist / vel, 0., 1.);
}

float cylinder(float dist, float vel)
{
    float ln = vel;
    return 1. - smoothstep(ln * 0.95, ln * 1.05, dist);
}

float softDepthCompare(highp float a, highp float b)
{
    const float extent = 0.01;
    return clamp(1. - (a - b) * (1. / extent), 0., 1.);
}

vec2 velocityAt(highp vec2 coord)
{
    vec4 g0 = texture2D(u_g0, coord);
    vec4 g1 = texture2D(u_g1, coord);
    vec4 g2 = vec4(0.), g3 = vec4(0.);

    GBufferContents g;
    decodeGBuffer(g, g0, g1, g2, g3);

    return g.velocity * u_velocityScale * u_amount;
}

void main()
{

    // velocity in the neighborhood
    vec2 vn = texture2D(u_velTile, v_texCoord).xy - 0.5;
    float fnLenSq = dot(vn, vn);
    if (fnLenSq < u_minimumVelocitySquared * 8.) {
        // no blur
        gl_FragColor = texture2D(u_color, v_texCoord);
        return;
    }

    vec2 localVel = velocityAt(v_texCoord);
    highp float localDepth = fetchDepth(u_linearDepth, v_texCoord);
    float localVelLn = max(length(localVel), u_minimumVelocity);

    // sample initial point
    vec4 sum = vec4(
#if c_useLogRGB
        decodeLogRGB(texture2D(u_color, v_texCoord)),
#else
        texture2D(u_color, v_texCoord).xyz,
#endif
        1.);
    sum *= .25 * u_minimumVelocity / localVelLn;

    // start sampling neighbor points
    highp vec2 coord = v_texCoord;

    float edgeFade = max(u_globalQuadInvRenderSize.x, u_globalQuadInvRenderSize.y);
    float jitter = texture2D(u_jitter, v_jitterCoord).x;

    vn *= u_velocityInvScale;
    coord -= vn * 0.5; // make blur "double-sided" (actually this is wrong but artifact is subtle)
    vn *= (1. / float(c_numSamples));
    coord += vn * jitter;

    float fpos = -1.;

    for (int i = 1; i < c_numSamples; ++i) {
        coord += vn;
        fpos += 2. / float(c_numSamples);

        highp float depth = fetchDepth(u_linearDepth, coord);
#if c_useLogRGB
        vec3 color = decodeLogRGB(texture2D(u_color, coord));
#else
        vec3 color = texture2D(u_color, coord).xyz;
#endif
        vec2 vel = velocityAt(coord);

        float b = softDepthCompare(localDepth, depth);
        float f = softDepthCompare(depth, localDepth);

        float distln = distance(coord * u_velocityScale, v_texCoord * u_velocityScale); // FIXME: optimize
        float velln = max(length(vel), u_minimumVelocity);

        float weight = f * cone(distln, velln) + b * cone(distln, localVelLn) +
            cylinder(distln + u_minimumVelocity * 2., velln) * cylinder(distln + u_minimumVelocity * 2., localVelLn) * 2.;

        // fade the border artifact
        weight *= clamp((min(min(coord.x, coord.y), 1. - max(coord.x, coord.y)) - edgeFade) * 100., 0., 1.);

        // fade the endpoint of blur
        weight *= 1. - fpos * fpos;

        sum += vec4(color, 1.) * weight;
    }

    vec3 result = sum.xyz / sum.w;
#if c_useLogRGB
    gl_FragColor = encodeLogRGB(result);
#else
    gl_FragColor.xyz = result;
    gl_FragColor.w = 1.;
#endif
}