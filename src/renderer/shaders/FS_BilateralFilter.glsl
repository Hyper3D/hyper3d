#pragma require DepthFetch
#pragma require Globals

uniform sampler2D u_input;
uniform sampler2D u_linearDepth;

varying highp vec2 v_texCoord;

varying highp vec2 v_texCoord1;
varying highp vec2 v_texCoord2;
varying highp vec2 v_texCoord3;
varying highp vec2 v_texCoord4;
varying highp vec2 v_texCoord5;
varying highp vec2 v_texCoord6;

highp float baseDepth;
highp float weightScale;

vec2 bilateralSample(highp vec2 at)
{
	float color = texture2D(u_input, at).r;
	highp float depth = fetchDepth(u_linearDepth, at);
	float weight = abs(depth - baseDepth) * weightScale;
	weight = exp2(-weight * weight);
	return vec2(color * weight, weight);
}


void main()
{
	vec2 sum = vec2(texture2D(u_input, v_texCoord).r, 1.);
	baseDepth = fetchDepth(u_linearDepth, v_texCoord);

	weightScale = 100. / baseDepth;

	sum += bilateralSample(v_texCoord1);
	sum += bilateralSample(v_texCoord2);
	sum += bilateralSample(v_texCoord3);
	sum += bilateralSample(v_texCoord4);
	sum += bilateralSample(v_texCoord5);
	sum += bilateralSample(v_texCoord6);

	float result = sum.x / sum.y;
	gl_FragColor = vec4(result);
}
