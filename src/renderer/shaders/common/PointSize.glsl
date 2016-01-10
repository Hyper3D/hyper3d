
float computeProjectedPointSize(float viewSpaceSize, mat4 projMat, vec4 clipPos, vec2 halfScreenSize)
{
	// See point-size.ja.md
	float invW = 1. / clipPos.w;

	// x_g, y_g, x_d, y_d
	vec4 coefs = vec4(halfScreenSize.xy * invW, -clipPos.xy * invW);

	vec3 row1 = vec3(projMat[0][0], projMat[1][0], projMat[2][0]) * coefs.x
		+ vec3(projMat[0][3], projMat[1][3], projMat[2][3]) * coefs.z;
	vec3 row2 = vec3(projMat[0][1], projMat[1][1], projMat[2][1]) * coefs.y
		+ vec3(projMat[0][3], projMat[1][3], projMat[2][3]) * coefs.w;
	float d = dot(row1, row2);
	float det = dot(row1, row1) * dot(row2, row2) - d * d;
	return sqrt(sqrt(det)) * viewSpaceSize;
}
