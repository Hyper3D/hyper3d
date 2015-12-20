/** G-Buffer index.
 * 0 : G0, 1 : G1, 2 : G2, 3 : G3, 4 : Depth */
#pragma parameter gBufferIndex
#pragma parameter globalSupportsSRGB
#pragma parameter globalUseFullResolutionGBuffer
#pragma require Globals
#pragma require DepthFetch

uniform sampler2D u_mosaic;
uniform highp sampler2D u_depth;
varying highp vec4 v_texCoords;
varying highp vec2 v_texCoord;

uniform highp vec4 u_depthLinearizeCoef;

// FIXME: better method
highp float wrapCoord(highp float coord)
{
    return fract(coord);
}
highp vec2 wrapCoord2(highp vec2 coord)
{
    return fract(coord);
}

void main()
{
    highp float targetDepth = texture2D(u_depth, v_texCoord.xy).x;

#if c_gBufferIndex == 4
    // depth
    targetDepth = targetDepth * 2. - 1.;
    highp float a = dot(u_depthLinearizeCoef.xy, vec2(targetDepth, 1.));
    highp float b = dot(u_depthLinearizeCoef.zw, vec2(targetDepth, 1.));

    gl_FragColor = encodeGDepth(a / b);
#else // c_gBufferIndex == 4

    // see G-Buffer Demosaicing.ai

#if c_globalUseFullResolutionGBuffer

#if c_gBufferIndex == 0
#define NumComparands 1
    highp vec2 coord1 = v_texCoords.xy;
#elif c_gBufferIndex == 1
#define NumComparands 2
    highp vec2 coord1 = v_texCoords.xy;
    highp vec2 coord2 = v_texCoords.zw;
    coord1.x = wrapCoord(coord1.x);
    coord2.x = wrapCoord(coord2.x);
#elif c_gBufferIndex == 2
#define NumComparands 2
    highp vec2 coord1 = v_texCoords.xy;
    highp vec2 coord2 = v_texCoords.zw;
    coord1.y = wrapCoord(coord1.y);
    coord2.y = wrapCoord(coord2.y);
#elif c_gBufferIndex == 3
#define NumComparands 4
    highp vec2 coord1 = v_texCoords.xy;
    highp vec2 coord2 = v_texCoords.zy;
    highp vec2 coord3 = v_texCoords.xw;
    highp vec2 coord4 = v_texCoords.zw;
    coord1 = wrapCoord2(coord1);
    coord2 = wrapCoord2(coord2);
    coord3 = wrapCoord2(coord3);
    coord4 = wrapCoord2(coord4);
#endif // c_gBufferIndex

#else // c_globalUseFullResolutionGBuffer
#define NumComparands 4
    highp vec2 coord = gl_FragCoord.xy * .5 - 0.25;
#if c_gBufferIndex == 1
    coord.x -= 0.5;
#elif c_gBufferIndex == 2
    coord.y -= 0.5;
#elif c_gBufferIndex == 3
    coord.xy -= 0.5;
#endif // c_gBufferIndex
    highp vec2 err = fract(coord);
    coord = floor(coord) + 0.25;
#if c_gBufferIndex == 1
    coord.x += .5;
#elif c_gBufferIndex == 2
    coord.y += .5;
#elif c_gBufferIndex == 3
    coord.xy += .5;
#endif // c_gBufferIndex

    coord *= u_globalDoubleInvRenderSize;
    err *= u_globalQuadInvRenderSize;

    highp vec4 coords = vec4(coord, coord + err);

    coords = fract(coords);

    highp vec2 coord1 = coords.xy;
    highp vec2 coord2 = coords.zy;
    highp vec2 coord3 = coords.xw;
    highp vec2 coord4 = coords.zw;
#endif // c_globalUseFullResolutionGBuffer

    vec4 retValue = texture2D(u_mosaic, coord1);
#if NumComparands > 1
    highp float retDepth = abs(texture2D(u_depth, coord1).x - targetDepth);
#endif // NumComparands > 1

#if NumComparands >= 2
    vec4 value2 = texture2D(u_mosaic, coord2);
    highp float depth2 = abs(texture2D(u_depth, coord2).x - targetDepth);
    if (depth2 < retDepth) {
        retValue = value2;
        retDepth = depth2;
    }
#endif

#if NumComparands >= 3
    vec4 value3 = texture2D(u_mosaic, coord3);
    highp float depth3 = abs(texture2D(u_depth, coord3).x - targetDepth);
    if (depth3 < retDepth) {
        retValue = value3;
        retDepth = depth3;
    }
#endif

#if NumComparands >= 4
    vec4 value4 = texture2D(u_mosaic, coord4);
    highp float depth4 = abs(texture2D(u_depth, coord4).x - targetDepth);
    if (depth4 < retDepth) {
        retValue = value4;
        retDepth = depth4;
    }
#endif
    gl_FragColor = retValue;
#endif // c_gBufferIndex == 4

    // G0 contains color values. We should linearize them now
    // if possible.
#if (c_gBufferIndex == 0) && c_globalSupportsSRGB
    // final G0 is sRGB buffer; we can rely on hardware
    // from this point
    // (if not, we should linearize them in every shader that reads them)
    gl_FragColor.xyz *= gl_FragColor.xyz;
#endif
}
