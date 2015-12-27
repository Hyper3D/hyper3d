#pragma require MatrixDeterminant

mat2 invertMatrix2(mat2 m, float safeMargin)
{
	return mat2(m[1][1], m[0][1], m[1][0], m[0][0]) /
		(determinantOfMatrix2(m) + safeMargin);
}

highp mat2 invertMatrix2Highp(highp mat2 m, highp float safeMargin)
{
	return mat2(m[1][1], m[0][1], m[1][0], m[0][0]) /
		(determinantOfMatrix2Highp(m) + safeMargin);
}

mat3 invertMatrix3(mat3 m, float safeMargin)
{
	return mat3(
		determinantOfMatrix2(mat2(m[1].yz, m[2].yz)),
		determinantOfMatrix2(mat2(m[1].xz, m[2].xz)),
		determinantOfMatrix2(mat2(m[1].xy, m[2].xy)),
		determinantOfMatrix2(mat2(m[0].yz, m[2].yz)),
		determinantOfMatrix2(mat2(m[0].xz, m[2].xz)),
		determinantOfMatrix2(mat2(m[0].xy, m[2].xy)),
		determinantOfMatrix2(mat2(m[0].yz, m[1].yz)),
		determinantOfMatrix2(mat2(m[0].xz, m[1].xz)),
		determinantOfMatrix2(mat2(m[0].xy, m[1].xy))
	) / (determinantOfMatrix3(m) + safeMargin);
}

highp mat3 invertMatrix3Highp(highp mat3 m, highp float safeMargin)
{
	return mat3(
		determinantOfMatrix2Highp(mat2(m[1].yz, m[2].yz)),
		determinantOfMatrix2Highp(mat2(m[1].xz, m[2].xz)),
		determinantOfMatrix2Highp(mat2(m[1].xy, m[2].xy)),
		determinantOfMatrix2Highp(mat2(m[0].yz, m[2].yz)),
		determinantOfMatrix2Highp(mat2(m[0].xz, m[2].xz)),
		determinantOfMatrix2Highp(mat2(m[0].xy, m[2].xy)),
		determinantOfMatrix2Highp(mat2(m[0].yz, m[1].yz)),
		determinantOfMatrix2Highp(mat2(m[0].xz, m[1].xz)),
		determinantOfMatrix2Highp(mat2(m[0].xy, m[1].xy))
	) / (determinantOfMatrix3Highp(m) + safeMargin);
}
