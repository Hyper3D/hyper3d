#pragma require DepthFetch
#pragma require Globals
#pragma require DepthToNormal

#pragma parameter isPositionalLight
#pragma parameter direction
#pragma parameter numSamples

uniform sampler2D u_input;
uniform sampler2D u_linearDepth;

varying highp vec2 v_texCoord;
varying mediump vec2 v_viewDir;

uniform highp vec2 u_viewDirCoefX;
uniform highp vec2 u_viewDirCoefY;

uniform mediump vec2 u_texCoordOffset;

void main()
{
    highp float baseDepth = fetchDepth(u_linearDepth, v_texCoord);
    vec3 normal = computeNormalFromDepthUsingStandardDerivatives(u_linearDepth, v_texCoord, vec3(v_viewDir, 1.));

    // Zhongxiang Zheng, Suguru Saito, "Screen Space Anisotropic Blurred Soft Shadows."
    vec2 axisMinor = normalize(normal.xy);
    vec2 axisMajor = axisMinor.yx * vec2(1., -1.);
    float radMinor = abs(normal.z);

    // Bilateral filtering
    highp float weightScale = 30. / baseDepth;

    vec2 sum = vec2(0.);

    highp vec2 coordOffset = u_texCoordOffset * (c_direction != 0 ? axisMinor * radMinor : axisMajor);
    highp vec2 coord = v_texCoord - coordOffset * 0.5;
    coordOffset *= 1. / float(c_numSamples - 1);

    float shift = -0.5;

    for (int i = 0; i < c_numSamples; ++i) {
        float value = texture2D(u_input, coord).x;
        highp float depth = fetchDepth(u_linearDepth, coord);

        float weight = abs(depth - baseDepth) * weightScale + abs(shift) * 3.;
        weight = exp2(-weight * weight);

        sum += vec2(value, 1.) * weight;

        coord += coordOffset;
        shift += 1. / float(c_numSamples - 1);
    }

    float result = sum.x / sum.y;
    gl_FragColor = vec4(vec3(result), 1.);
}