#pragma require DepthFetch
#pragma require Globals
#pragma require DepthToNormal
#pragma require MatrixInverse
#pragma require MatrixTranspose

#pragma parameter isPositionalLight
#pragma parameter direction
#pragma parameter numSamples

uniform sampler2D u_input;
uniform sampler2D u_linearDepth;

varying highp vec2 v_texCoord;
varying highp vec2 v_viewDir;

uniform highp vec2 u_viewDirCoefX;
uniform highp vec2 u_viewDirCoefY;

uniform float u_maxBlur;

uniform vec3 u_lightU, u_lightV, u_lightDir;

uniform sampler2D u_jitter;
varying highp vec2 v_jitterCoord;

void main()
{
    highp float baseDepth = fetchDepth(u_linearDepth, v_texCoord);
    highp vec3 baseViewPos = baseDepth * vec3(v_viewDir, 1.);
    vec3 normal = computeNormalFromDepthUsingStandardDerivatives(u_linearDepth, v_texCoord, vec3(v_viewDir, 1.));

    // Penumbra matrix + normal row (world space), transposed
    mat3 mW2PT = mat3(u_lightU, u_lightV, normal);
    // Inverse
    mat3 mP2WT = invertMatrix3(mW2PT, 0.01);

    // Covariance matrix on world space = mP2W * SigmaP * mP2WT
    // SigmaP is defined as SigmaP * (x, y, z) = (sigma * x, sigma * y, 0)
    float sigma = 0.01; // FIXME: use the appropriate value
    mat3 sigmaP = mat3(
        sigma, 0., 0.,
        0., sigma, 0.,
        0., 0., 0.);
    mat3 covW = (mP2WT) * sigmaP * transposeMatrix3(mP2WT);

    // Compute the covariance matrix on screen space
    // mW2S = [ 1 / w    0    -x/w^2 ]
    //        [   0    1 / w  -y/w^2 ]
    highp float baseDepthInv = 1. / baseDepth;
    vec2 mW2S1 = vec2(baseDepthInv);
    vec2 mW2S2 = -baseViewPos.xy * baseDepthInv * baseDepthInv;
    vec3 covS = vec3(
        covW[0][0] * (baseDepthInv * baseDepthInv) +
            baseDepthInv * mW2S2.x * (covW[2][0] * covW[0][2]) +
            covW[2][2] * (mW2S2.x * mW2S2.x),   // sigma x ^ 2
        covW[1][1] * (baseDepthInv * baseDepthInv) +
            baseDepthInv * mW2S2.y * (covW[2][1] * covW[1][2]) +
            covW[2][2] * (mW2S2.y * mW2S2.y),   // sigma y ^ 2
        baseDepthInv * baseDepthInv * covW[1][0] +
        baseDepthInv * mW2S2.x * covW[1][2] +
        baseDepthInv * mW2S2.y * covW[2][0] +
        mW2S2.x * mW2S2.y * covW[2][2]  // sigma xy
    );

    vec2 scale = 1. / vec2(u_viewDirCoefX.x, u_viewDirCoefY.y);
    covS *= scale.xyx * scale.xyy;

    // Compute cross convolution axis
    vec2 axis1, axis2;
    axis1.y = 0.;
    axis2.y = sqrt(covS.y);
    axis2.x = covS.z / axis2.y;
    axis1.x = sqrt(max(0., covS.x - axis2.x * axis2.x));

    // Bilateral filtering
    highp float weightScale = 30. / baseDepth;

    vec2 sum = vec2(0.);

    highp vec2 coordOffset = c_direction != 0 ? axis1 : axis2;
    if (length(coordOffset) > u_maxBlur) {
        coordOffset = normalize(coordOffset) * u_maxBlur;
    }
    highp vec2 coord = v_texCoord - coordOffset * 0.5;
    coordOffset *= 1. / float(c_numSamples);

    float shift = -0.5;

#if c_direction
    float jitter = texture2D(u_jitter, v_jitterCoord).x;
#else
    float jitter = texture2D(u_jitter, v_jitterCoord).y;
#endif
    coord += coordOffset * jitter;
    shift += (1. / float(c_numSamples)) * jitter;

    for (int i = 0; i < c_numSamples; ++i) {
        float value = texture2D(u_input, coord).x;
        highp float depth = fetchDepth(u_linearDepth, coord);

        float weight = abs(depth - baseDepth) * weightScale + abs(shift) * 3.;
        weight = exp2(-weight * weight);

        sum += vec2(value, 1.) * weight;

        coord += coordOffset;
        shift += 1. / float(c_numSamples);
    }

    float result = sum.x / sum.y;
    gl_FragColor = vec4(vec3(result), 1.);
}