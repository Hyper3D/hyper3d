// this shader is abstract; must be imported and main function must be provided
#pragma require VolumeTexture2DFill

uniform mat4 u_invProjectionMatrix;
uniform vec2 u_ditherScale;

varying vec4 v_viewPos;
varying vec2 v_ditherCoord;

void main()
{
	setupVolumeTexture2DFill();

	v_viewPos = u_invProjectionMatrix * vec4(v2dCoord * 2. - 1., 1.);
    v_ditherCoord.xy = u_ditherScale * a_position.xy;
}
