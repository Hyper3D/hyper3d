// this shader is abstract; must be imported and main function must be provided

#pragma attribute position
#pragma attribute normal
#pragma attribute tangent

#pragma require Pack

#pragma require VS_BaseSkinning
#pragma require PointSize
#pragma parameter skinningMode
#pragma parameter usePointSize

#pragma attribute skinWeights
#pragma attribute skinIndices
attribute vec4 a_skinWeights;
attribute vec4 a_skinIndices;

uniform mat4 u_projectionMatrix;
uniform mat4 u_viewProjectionMatrix;
uniform mat4 u_viewMatrix;

uniform mat4 u_modelMatrix;
uniform mat4 u_lastModelMatrix;

attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec3 a_tangent;

vec3 worldPosition;
vec3 worldNormal;
vec3 worldTangent;

vec3 lastWorldPosition;

varying highp vec3 v_worldPosition;

float m_pointSize;

void computeExtraValues();
void evaluateVertexShader();

#if c_skinningMode != SkinningModeNone

void doSkinningOne(inout mat4 mat, inout mat4 lastMat, float index, float weight)
{
    if (weight == 0.) {
        return;
    }

    BoneMatrix m = getBoneMatrix(index);

    mat += m.current * weight;
    lastMat += m.last * weight;
}

#endif

void evaluateGeometry()
{
    vec3 position = a_position;
    vec3 lastPosition = a_position;
    vec3 normal = a_normal;
    vec3 tangent = a_tangent;

#if c_skinningMode != SkinningModeNone

    mat4 skinMat = mat4(0.);
    mat4 skinLastMat = mat4(0.);

    doSkinningOne(skinMat, skinLastMat, a_skinIndices.x, a_skinWeights.x);
    doSkinningOne(skinMat, skinLastMat, a_skinIndices.y, a_skinWeights.y);
    doSkinningOne(skinMat, skinLastMat, a_skinIndices.z, a_skinWeights.z);
    doSkinningOne(skinMat, skinLastMat, a_skinIndices.w, a_skinWeights.w);

    skinMat = u_skinInvBindMatrix * skinMat * u_skinBindMatrix;
    skinLastMat = u_skinInvBindMatrix * skinLastMat * u_skinBindMatrix;

    position = (skinMat * vec4(position, 1.)).xyz;
    lastPosition = (skinLastMat * vec4(lastPosition, 1.)).xyz;
    normal = (skinMat * vec4(normal, 0.)).xyz;
    tangent = (skinMat * vec4(tangent, 0.)).xyz;

#endif

    worldPosition = (u_modelMatrix * vec4(position, 1.)).xyz;
    worldNormal = (u_modelMatrix * vec4(normal, 0.)).xyz;
    worldTangent = (u_modelMatrix * vec4(tangent, 0.)).xyz;

    lastWorldPosition = (u_lastModelMatrix * vec4(lastPosition, 1.)).xyz;

    computeExtraValues();

    m_pointSize = 1.;
    evaluateVertexShader();

    v_worldPosition = worldPosition;
}
