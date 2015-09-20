#pragma require DepthFetch
#pragma require Complex
#pragma require Globals
#pragma require GBuffer

uniform sampler2D u_g2;
uniform sampler2D u_linearDepth;

uniform vec3 u_lightDir;
uniform vec3 u_lightColor;

varying highp vec2 v_texCoord;
varying mediump vec2 v_viewDir;

uniform highp vec2 u_viewDirCoefX;
uniform highp vec2 u_viewDirCoefY;

uniform mediump vec2 u_sampleOffsetScale;

void main()
{
	vec4 g2 = texture2D(u_g2, v_texCoord);

	highp float baseDepth = fetchDepth(u_linearDepth, v_texCoord);
	highp vec3 baseViewPos = vec3(v_viewDir, 1.) * baseDepth;
	vec3 baseNormal = decodeGBufferNormal(g2);

	highp vec2 patternPos = fract(gl_FragCoord.xy * 0.5);
	highp float patternPos2 = fract(dot(floor(gl_FragCoord.xy), vec2(0.25)));

	float depthDecayScale = -16. / baseDepth;

	vec2 sampleOffsetScale = u_sampleOffsetScale;


	float sampleDistance = 1. + patternPos2 * 2.;
	const float sampleRotAngle = 1.0;
	vec2 sampleRot = vec2(sin(sampleRotAngle), cos(sampleRotAngle));

	vec2 sampleDir = vec2(patternPos.x > .5 ? 1. : -1., 0.);
	sampleDir = patternPos.y > .5 ? sampleDir : sampleDir.yx;

	float sampleDecay = 1.;

	float ret = 0.;

	for (int i = 0; i < 12; ++i) {
		vec2 sampleOffset = sampleDir * sampleDistance;
		vec2 sampleCoordOffs = sampleOffset * sampleOffsetScale; // FIXME: this needs to be adjusted
		highp vec2 sampleAt = v_texCoord + sampleCoordOffs;
		highp float depth = fetchDepth(u_linearDepth, sampleAt) + 0.1; // FIXME: this value needs to be tweaked?
		vec3 viewPos = vec3(v_viewDir + u_viewDirCoefX * sampleCoordOffs.x 
			+ u_viewDirCoefY * sampleCoordOffs.y, 1.) * depth;
		vec3 relViewPos = normalize(viewPos - baseViewPos);
		float cosHorizon = -dot(relViewPos, baseNormal);
		float depthDecay = exp2(depthDecayScale * abs(depth - baseDepth));

		ret = mix(ret, max(ret, cosHorizon), sampleDecay * depthDecay);

		sampleDistance += 1. + sampleDistance * .2;
		sampleDir = complexMultiply(sampleDir, sampleRot);
		sampleDecay *= .9;
	}

	gl_FragColor.xyzw = vec4(1. - ret);
}