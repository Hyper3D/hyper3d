#pragma require Globals
#pragma require HdrMosaic
#pragma require LogRGB

uniform sampler2D u_mosaic;
varying highp vec2 v_texCoord1;
varying highp vec2 v_texCoord2;
varying highp vec2 v_texCoord3;

void main()
{
	vec4 mosaic1 = texture2D(u_mosaic, v_texCoord1.xy);
	vec4 mosaic2 = texture2D(u_mosaic, vec2(v_texCoord1.x, v_texCoord2.y));
	vec4 mosaic3 = texture2D(u_mosaic, vec2(v_texCoord1.x, v_texCoord3.y));
	vec4 mosaic4 = texture2D(u_mosaic, vec2(v_texCoord2.x, v_texCoord1.y));
	vec4 mosaic5 = texture2D(u_mosaic, vec2(v_texCoord3.x, v_texCoord1.y));
	vec3 mosaicAvg = (mosaic2 + mosaic3 + mosaic4 + mosaic5).xyz * 0.25;

	float overflowLevel;
	{
		float t1 = max(mosaic1.w, mosaic2.w);
		float t2 = max(mosaic3.w, mosaic4.w);
		float t3 = max(t1, mosaic5.w);
		overflowLevel = max(t2, t3);
	}
	overflowLevel = max(overflowLevel * 10. - 9., 0.);

	float currentPixelMode = hdrMosaicMode(gl_FragCoord.xy);
	float mixamt = mix(1. - overflowLevel, overflowLevel, currentPixelMode);

	float pat1 = hdrMosaicInvPatternForMode(currentPixelMode);
	float pat2 = hdrMosaicInvPatternForMode(1. - currentPixelMode);

	mosaic1.xyz *= pat1;
	mosaicAvg.xyz *= pat2;

	// gl_FragColor.xyz = vec3(overflowLevel); return;

	vec3 demosaicedRGB = mix(mosaic1.xyz, mosaicAvg, mixamt);

	gl_FragColor = encodeLogRGB(demosaicedRGB);
}
