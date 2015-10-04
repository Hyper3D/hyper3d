// this shader is abstract; must be imported and function implementations must be provided
#pragma require GBuffer
#pragma require ShadingModel
#pragma require HdrMosaic
#pragma require DepthFetch
#pragma parameter isBlendPass
#pragma parameter useHdrMosaic

uniform sampler2D u_g0;
uniform sampler2D u_g1;
uniform sampler2D u_g2;
uniform sampler2D u_linearDepth;
uniform sampler2D u_ssao;

varying highp vec2 v_texCoord;
varying mediump vec2 v_viewDir;

uniform samplerCube u_reflection;

uniform mat4 u_reflectionMatrix;

uniform sampler2D u_dither;
varying highp vec2 v_ditherCoord;

// to be provided by derived shader
float evaluateWeight(vec3 viewPos);

void emitIBLOutput(vec3 lit, float weight)
{
	// dither
	vec3 dither = texture2D(u_dither, v_ditherCoord).xyz;

#if c_useHdrMosaic
	vec4 mosaicked = encodeHdrMosaicDithered(lit, dither);
	gl_FragColor = mosaicked;

#if c_isBlendPass
	gl_FragColor.w = weight;
#endif // c_isBlendPass
#else // c_useHdrMosaic
	if (lit != lit) lit *= 0.; // reject denormals
	gl_FragColor = vec4(lit, weight);
#endif // c_useHdrMosaic
}

void main()
{
	vec4 g0 = texture2D(u_g0, v_texCoord);
	vec4 g1 = texture2D(u_g1, v_texCoord);
	vec4 g2 = texture2D(u_g2, v_texCoord);
	vec4 g3 = vec4(0.);

	if (isGBufferEmpty(g0, g1, g2, g3)) {
		discard;
		return;
	}

	GBufferContents g;
	decodeGBuffer(g, g0, g1, g2, g3);

	MaterialInfo mat = getMaterialInfoFromGBuffer(g);

	highp vec3 viewDir = vec3(v_viewDir, 1.);
	highp float depth = fetchDepth(u_linearDepth, v_texCoord);
	highp vec3 viewPos = viewDir * depth;

	float weight = evaluateWeight(viewPos);

	vec3 reflVector = reflect(-(viewDir), g.normal);
	reflVector = (u_reflectionMatrix * vec4(reflVector, 0.)).xyz;

	float ssao = texture2D(u_ssao, v_texCoord).r;
	ssao *= ssao;
	ssao = mix(1., ssao, min(mat.roughness * 4., 1.));

	// sampling from image
	// TODO: lod bias dependent of texture resolution
	// TODO: correct lod bias
	vec3 refl = textureCube(u_reflection, reflVector, mat.roughness * 14.).xyz;
	refl.xyz *= refl.xyz; // linearize

	refl *= evaluateReflection(clamp(dot(g.normal, normalize(viewDir)), 0., 1.), mat).xyz;

	if (isMaterialClearCoat(mat)) {
		// second specular lobe
		vec3 reflcc = textureCube(u_reflection, reflVector, mat.clearCoatRoughness * 14.).xyz;
		reflcc.xyz *= reflcc.xyz; // linearize

		reflcc *= evaluateReflectionForClearCoat(clamp(dot(g.normal, normalize(viewDir)), 0., 1.), mat);

		refl += reflcc;
	}

	// apply SSAO
	refl *= ssao;

	// lighting model

	emitIBLOutput(refl.xyz, weight);
}

