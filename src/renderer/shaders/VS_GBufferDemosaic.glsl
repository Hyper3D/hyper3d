#pragma parameter gBufferIndex
#pragma parameter globalUseFullResolutionGBuffer

attribute vec2 a_position;
varying vec4 v_texCoords; // FIXME: remove dependent texture fetch
uniform vec2 u_globalQuarterInvRenderSize;
uniform vec2 u_globalHalfRenderSize;
uniform vec2 u_globalHalfInvRenderSize;

void main()
{
	gl_Position = vec4(a_position, 0., 1.);

	vec2 normCoord = a_position * 0.5 + 0.5;

	// see G-Buffer Demosaicing.ai
#if c_globalUseFullResolutionGBuffer
	v_texCoords = (normCoord - u_globalQuarterInvRenderSize).xyxy;
#if c_gBufferIndex == 1
	v_texCoords.x += u_globalHalfInvRenderSize.x;
	v_texCoords.z -= u_globalHalfInvRenderSize.x;
#elif c_gBufferIndex == 2
	v_texCoords.y += u_globalHalfInvRenderSize.y;
	v_texCoords.w -= u_globalHalfInvRenderSize.y;
#elif c_gBufferIndex == 3
	v_texCoords.xy += u_globalHalfInvRenderSize;
	v_texCoords.zw -= u_globalHalfInvRenderSize;
#endif // c_gBufferIndex
#else // c_globalUseFullResolutionGBuffer
// FIXME: these are used because of precision problem
	v_texCoords = vec4(normCoord, normCoord * u_globalHalfRenderSize - 0.25);
#if c_gBufferIndex == 1
	v_texCoords.z += 0.5;
#elif c_gBufferIndex == 2
	v_texCoords.w += 0.5;
#elif c_gBufferIndex == 3
	v_texCoords.zw += 0.5;
#endif // c_gBufferIndex
#endif // c_globalUseFullResolutionGBuffer
}
