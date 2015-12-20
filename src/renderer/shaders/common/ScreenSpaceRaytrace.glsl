#pragma require DepthFetch

/*
based on http://casual-effects.blogspot.jp/2014/08/screen-space-ray-tracing.html:
    // By Morgan McGuire and Michael Mara at Williams College 2014
    // Released as open source under the BSD 2-Clause License
    // http://opensource.org/licenses/BSD-2-Clause
*/

bool rayTraceScreenSpace(
    sampler2D linearDepth,
    highp vec3 csOrig,
    highp vec3 csDir,
    highp mat4 projMat, // shoudl map to pixel coordinate
    highp vec2 bufferSize,
    highp vec2 invBufferSize,
    float stride,
    float jitter,
    float maxDistance,
    out highp vec2 hitPixel,
    out highp vec3 hitPoint,
    out float hitSteps
)
{
    // clip ray to the near plane
    const highp float nearPlaneZ = 0.01;
    highp float rayLength = (csOrig.z + csDir.z * maxDistance) < nearPlaneZ ?
        (nearPlaneZ - csOrig.z) / csDir.z : maxDistance;
    highp vec3 csEnd = csOrig + csDir * rayLength;

    // project into homogeneous clip space
    highp vec4 h0 = projMat * vec4(csOrig, 1.);
    highp vec4 h1 = projMat * vec4(csEnd, 1.);
    highp float k0 = 1. / h0.w, k1 = 1. / h1.w;

    // intepolated homogeneous version of the camera-space points
    highp vec3 q0 = csOrig * k0;
    highp vec3 q1 = csEnd * k1;

    // screen-space points
    highp vec2 p0 = h0.xy * k0;
    highp vec2 p1 = h1.xy * k1;

    highp vec2 delta = p1 - p0;
    if (dot(delta, delta) < 0.000001) {
        return false;
    }

    // permute xy for vertical line
    bool permute = false;
    if (abs(delta.x) < abs(delta.y)) {
        permute = true;
        delta = delta.yx;
        p0 = p0.yx;
        p1 = p1.yx;
    }

    highp float stepDir = sign(delta.x);
    highp float invdx = abs(1. / delta.x);

    // derivatives of Q and k
    highp vec3 dq = (q1 - q0) * invdx;
    highp float dk = (k1 - k0) * invdx;
    highp vec2 dp = vec2(stepDir, delta.y * invdx);

    // scale derivatives
    dp *= stride; dq *= stride; dk *= stride;
    p0 += dp * jitter; q0 += dq * jitter; k0 += dk * jitter;

    // slice p from p0 to p1, q from q0 to q1, k from k0 to k1
    highp vec3 q = q0;

    // end condition
    highp float end = p1.x * stepDir;

    highp float k = k0, prevZMaxEstimate = csOrig.z;
    highp float rayZMin = prevZMaxEstimate, rayZMax = prevZMaxEstimate;
    highp float sceneZMax = rayZMax + 100000.;
    const highp float zThickness = .1;
    highp vec2 p = p0;
    float stepCount = 0.;
    const int numMaxSteps = 16;
    for (int i = 0; i < numMaxSteps; ++i) {
        if (((p.x * stepDir) > end) ||
            ((rayZMax > sceneZMax) && (rayZMin < sceneZMax + zThickness)) ||
            sceneZMax == 0.) {
            break;
        }

        rayZMin = prevZMaxEstimate;
        rayZMax = (dq.z * 0.5 + q.z) / (dk * 0.5 + k);
        prevZMaxEstimate = rayZMax;

        if (rayZMin > rayZMax) {
            float t = rayZMin; rayZMin = rayZMax; rayZMax = t;
        }

        hitPixel = permute ? p.yx : p;

        sceneZMax = fetchDepth(linearDepth, hitPixel * invBufferSize);

        p += dp; q.z += dq.z; k += dk; stepCount += 1.;
    }

    q.xy += dq.xy * stepCount;
    hitPoint = q * (1. / k);

    hitSteps = (stepCount + jitter) * (1. / float(numMaxSteps + 1));

    return (rayZMax >= sceneZMax) && (rayZMin < sceneZMax + zThickness);
}
