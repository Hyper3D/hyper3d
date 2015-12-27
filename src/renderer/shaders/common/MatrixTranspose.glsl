
mat2 transposeMatrix2(mat2 m)
{
	return mat2(m[0][0], m[1][0], m[0][1], m[1][1]);
}
highp mat2 transposeMatrix2Highp (highp mat2 m)
{
	return mat2(m[0][0], m[1][0], m[0][1], m[1][1]);
}

mat3 transposeMatrix3(mat3 m)
{
	return mat3(
		m[0][0], m[1][0], m[2][0],
		m[0][1], m[1][1], m[2][1],
		m[0][2], m[1][2], m[2][2]);
}

highp mat3 transposeMatrix3Highp(highp mat3 m)
{
	return mat3(
		m[0][0], m[1][0], m[2][0],
		m[0][1], m[1][1], m[2][1],
		m[0][2], m[1][2], m[2][2]);
}
