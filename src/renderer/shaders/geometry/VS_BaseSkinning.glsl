// this shader is abstract; must be imported and main function must be provided

#pragma parameter skinningMode
#define SkinningModeNone 0
#define SkinningModeUniform 1
#define SkinningModeTexture 2
#define SkinningModeFloatTexture 3

// #pragma parameter numBones

#if c_skinningMode != SkinningModeNone

struct BoneMatrix
{
	mat4 current, last;
};

uniform mat4 u_skinBindMatrix;
uniform mat4 u_skinInvBindMatrix;

#if c_skinningMode == SkinningModeUniform

uniform mat4 u_bones[c_numBones];
uniform mat4 u_lastBones[c_numBones];
BoneMatrix getBoneMatrix(float index)
{
	int intIndex = int(index);
	return BoneMatrix(u_bones[intIndex], u_lastBones[intIndex]);
}

#elif c_skinningMode == SkinningModeTexture

uniform sampler2D u_skinTexture;
uniform sampler2D u_lastSkinTexture;
uniform vec2 u_skinTexSize;		// "bone" indexing
uniform vec2 u_skinInvTexSize;
uniform vec4 u_skinInvTexSize2; // matrix element indexing [ 1/w, 1/h, 0.5/w, 0.5/h ]
BoneMatrix getBoneMatrix(float index)
{
	float row = floor(index / u_skinTexSize.x);
	float col = index - row * u_skinTexSize.x;
	vec2 boneCoord = vec2(col, row) * u_skinInvTexSize + u_skinInvTexSize2.zw;
	vec4 elemCoord1 = vec4(boneCoord, boneCoord + u_skinInvTexSize2.xy);
	vec4 elemCoord2; 
	elemCoord2.xy = elemCoord1.zw + u_skinInvTexSize2.xy;
	elemCoord2.zw = elemCoord2.xy + u_skinInvTexSize2.xy;

	// left half
	vec4 coordTL = elemCoord1;
	vec4 coordBL = vec4(elemCoord1.x, elemCoord2.y, elemCoord1.z, elemCoord2.w);
	vec4 col1 = vec4(
		unpack32f(texture2D(u_skinTexture, coordTL.xy)),
		unpack32f(texture2D(u_skinTexture, coordTL.xw)),
		unpack32f(texture2D(u_skinTexture, coordBL.xy)),
		unpack32f(texture2D(u_skinTexture, coordBL.xw))
	);
	vec4 col2 = vec4(
		unpack32f(texture2D(u_skinTexture, coordTL.zy)),
		unpack32f(texture2D(u_skinTexture, coordTL.zw)),
		unpack32f(texture2D(u_skinTexture, coordBL.zy)),
		unpack32f(texture2D(u_skinTexture, coordBL.zw))
	);
	vec4 lcol1 = vec4(
		unpack32f(texture2D(u_lastSkinTexture, coordTL.xy)),
		unpack32f(texture2D(u_lastSkinTexture, coordTL.xw)),
		unpack32f(texture2D(u_lastSkinTexture, coordBL.xy)),
		unpack32f(texture2D(u_lastSkinTexture, coordBL.xw))
	);
	vec4 lcol2 = vec4(
		unpack32f(texture2D(u_lastSkinTexture, coordTL.zy)),
		unpack32f(texture2D(u_lastSkinTexture, coordTL.zw)),
		unpack32f(texture2D(u_lastSkinTexture, coordBL.zy)),
		unpack32f(texture2D(u_lastSkinTexture, coordBL.zw))
	);
	
	// right half
	vec4 coordTR = vec4(elemCoord2.x, elemCoord1.y, elemCoord2.z, elemCoord1.w);
	vec4 coordBR = elemCoord2;
	vec4 col3 = vec4(
		unpack32f(texture2D(u_skinTexture, coordTR.xy)),
		unpack32f(texture2D(u_skinTexture, coordTR.xw)),
		unpack32f(texture2D(u_skinTexture, coordBR.xy)),
		unpack32f(texture2D(u_skinTexture, coordBR.xw))
	);
	vec4 col4 = vec4(
		unpack32f(texture2D(u_skinTexture, coordTR.zy)),
		unpack32f(texture2D(u_skinTexture, coordTR.zw)),
		unpack32f(texture2D(u_skinTexture, coordBR.zy)),
		unpack32f(texture2D(u_skinTexture, coordBR.zw))
	);
	vec4 lcol3 = vec4(
		unpack32f(texture2D(u_lastSkinTexture, coordTR.xy)),
		unpack32f(texture2D(u_lastSkinTexture, coordTR.xw)),
		unpack32f(texture2D(u_lastSkinTexture, coordBR.xy)),
		unpack32f(texture2D(u_lastSkinTexture, coordBR.xw))
	);
	vec4 lcol4 = vec4(
		unpack32f(texture2D(u_lastSkinTexture, coordTR.zy)),
		unpack32f(texture2D(u_lastSkinTexture, coordTR.zw)),
		unpack32f(texture2D(u_lastSkinTexture, coordBR.zy)),
		unpack32f(texture2D(u_lastSkinTexture, coordBR.zw))
	);
	
	return BoneMatrix(
		mat4(col1, col2, col3, col4),
		mat4(lcol1, lcol2, lcol3, lcol4)
	);
}

#elif c_skinningMode == SkinningModeFloatTexture

uniform sampler2D u_skinTexture;
uniform sampler2D u_lastSkinTexture;
uniform vec2 u_skinTexSize;		// "bone" indexing
uniform vec2 u_skinInvTexSize;
uniform vec4 u_skinInvTexSize2; // matrix column indexing [ 1/w, 1/h, 0.5/w, 0.5/h ]
BoneMatrix getBoneMatrix(float index)
{
	float row = floor(index / u_skinTexSize.x);
	float col = index - row * u_skinTexSize.x;
	vec2 boneCoord = vec2(col, row) * u_skinInvTexSize + u_skinInvTexSize2.zw;
	vec4 colCoord = vec4(boneCoord, boneCoord + u_skinInvTexSize2.xy);
	
	return BoneMatrix(
		mat4(
			texture2D(u_skinTexture, colCoord.xy),
			texture2D(u_skinTexture, colCoord.zy),
			texture2D(u_skinTexture, colCoord.xw),
			texture2D(u_skinTexture, colCoord.zw)
		),
		mat4(
			texture2D(u_lastSkinTexture, colCoord.xy),
			texture2D(u_lastSkinTexture, colCoord.zy),
			texture2D(u_lastSkinTexture, colCoord.xw),
			texture2D(u_lastSkinTexture, colCoord.zw)
		)
	);
}

#endif // c_skinningMode

#endif // c_skinningMode != SkinningModeNone

