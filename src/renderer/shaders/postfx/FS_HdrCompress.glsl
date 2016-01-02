#pragma require Globals
#pragma require HdrToneMapping
#pragma parameter direction
#pragma parameter operatorType

#define OperatorType_Reinhard 0

uniform sampler2D u_input;
uniform sampler2D u_jitter;
varying highp vec2 v_texCoord;
varying highp vec2 v_jitterCoord;

uniform float u_gain;

void main()
{
    vec4 inp = texture2D(u_input, v_texCoord);

#if !c_direction
	inp.xyz *= u_gain;
#endif

#if c_operatorType == OperatorType_Reinhard
#if c_direction
	inp.xyz = encodeReinhard(inp.xyz);
#else // c_direction
	inp.xyz = decodeReinhard(inp.xyz);
#endif // c_direction
#endif // c_operatorType

#if c_direction
	inp.xyz *= u_gain;
#endif

	inp += inp * ((texture2D(u_jitter, v_jitterCoord).x - 0.5) * (1. / 1024.));

	gl_FragColor = inp;
}
