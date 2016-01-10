Improved Screen-Space Soft Shadows
====

yvt <i@yvt.jp>

ISSSSの実装メモ。


1.背景
----

TODO

* ハードシャドウ
* ソフトシャドウ
  * Percentage-Closer Soft Shadows
  * SSSS
* SSPCSS
* Screen Space Anisotropic Blurred Soft Shadows[^SSABSS]


2.手法
-----

この手法は以下の様な手順で実現される。

1. シャドウマッピングを用い、ハードシャドウをライトバッファに描画する。この際、Percentage-Closer Soft Shadowsと類似した手法により、遮蔽物の探索を行い、半影の大きさの推定値$w_{Penumbra}$も同時に記録する。
2. ライトバッファの各ピクセルに対し、ぼかしカーネルを決定する。
3. ライトバッファに対し、ぼかしを適用する。この際のカーネルは2変数正規分布であるため、後述する方法により、2パスアルゴリズムによりぼかしを掛けることができる。前景の影が背景に漏れ出すようなことを避けるために、ここではCross-Bilateral Filterに似た手法を用いる。
4. 求まったライトバッファを用い、シェーディングを行う。

### ハードシャドウの描画

旧来のシャドウマッピングの手法を用いて、ライトバッファ上で影を描画する。

この際、Percentage-Closer Soft Shadowsに基づいた手法を用いて、半影の大きさを推定し、影値と一緒に記録する。

$$w_{Penumbra} = (d_{Receiver} - d_{Blocker}) \cdot w_{Light} / d_{Blocker}$$

### ぼかしカーネルの推定

ここでの目的は、各ピクセルについて、適用するぼかしカーネルの形状・大きさを決定することである。そのピクセルとその近傍のピクセルも同一の接平面に属する、つまり局所的になめらかな形状であると仮定することにより、局所的に用いることができるぼかしカーネルを簡単に計算することができる。

ぼかし演算は、画像と分布関数(カーネル)を畳み込み演算することによって求められる。しかし、この定義では、画像の箇所によって異なるカーネルを適用することはできない。そこで、この定義を拡張し、各ピクセル毎に異なるカーネルを使用できるものとする。(このぼかしの実装方法は後で述べる。)

さらに、もう一つ定義の修正を行う。元の定義では、カーネルの画素の座標は対象画素に対して相対的なものであったが、絶対的なものに修正する。すなわち、旧来の定義では$N(0, \Sigma)$であったものが、画素座標$x$に対して$N(x, \Sigma)$となるように修正される。

まず、先に求めた半影の大きさ推定値を用い、光源の方向から見た(つまり、$z$方向が光源の方向、$x, y$方向が光源と垂直なベクトル$t_L, t'_L$となる直交座標系上での)ぼかしカーネルを共分散行列を$z$平面に投影したものは、次のように求めることができる。

$$\Sigma_{LS}=\begin{pmatrix}
w_{Penumbra}^2 & 0 \\
0 & w_{Penumbra}^2
\end{pmatrix}$$

これを、今処理しているピクセルの接平面に投影したい。接平面に投影した場合、その法線方向の分散は0になる。つまり、次のような変換

$$
x_{S} = M_S x_{WS} \\
M_S := \begin{pmatrix}
t_L \\
t'_L \\
n
\end{pmatrix}
$$

を考えると、$X_{S}$の共分散行列は次のようになる。

$$\Sigma_{S}=\begin{pmatrix}
w_{Penumbra}^2 & 0 & 0 \\
0 & w_{Penumbra}^2 & 0 \\
0 & 0 & 0
\end{pmatrix}$$

$\Sigma_{S}$を視点座標系に変換するためには、$x_{WS} = M_S^{-1} x_s$ なので、$\Sigma_{WS} = M_S^{-1} \Sigma_S (M_S^{-1})^T$ とすればよい。これにより、ぼかしカーネルの視点座標系上での形状が分かる。

ここでカーネルの平均を定める。前の段階でカーネルをピクセルの接平面に投影しているため、平均値$\mu_{WS}$はそのピクセルの視点座標系上での座標$v_{WS}$となるはずである。したがって、視点座標系上でのカーネルは$N(\mu_{WS}, \Sigma_{WS})$となる。

続いて、これをクリップ座標系に変換する。このためには、4x4の投影行列$P$を用いるが、$\mu_{WS}, \Sigma_{WS}$は3要素のベクトルであるので、最後の列$p_3$のみを取り除いた4x3の投影行列$P'$を用いる。

$$\begin{align*}
\mu_c &= P' \mu_{WS} + p_3 \\
\Sigma_c &= P' \Sigma_{WS} P'^T
\end{align*}$$

続いて、これにPerspective Divisionを行いNDCに変換するが、この変換は次のように非線形である。

$$
v_{ndc} =
\begin{pmatrix}
x_{ndc} \\ y_{ndc} \\ z_{ndc}
\end{pmatrix}
 =
\begin{pmatrix}
x_c/w_c \\ y_c/w_c \\ z_c/w_c
\end{pmatrix} = v_{c}
$$

ここで、[ポイントサイズの計算](point-size.ja.md)で用いた近似を用いる。

$$\begin{align*}
\left.\frac{\partial v_{ndc}}{\partial v_c}\right|_{v_c=\mu_c}
	&= \begin{pmatrix}
		1/w_{\mu_c} &
			0 &
			0 &
			-x_{\mu_c} / w_c^{\mu_c} \\ 
		0 &
			1/w_{\mu_c} &
			0 &
			-y_{\mu_c} / w_c^{\mu_c} \\ 
		0 &
			0 &
			1/w_{\mu_c} &
			-z_{\mu_c} / w_c^{\mu_c} \\ 
		\end{pmatrix} \\
	&:= G
\end{align*}$$

$$
v_{ndc} \approx 
	\mu'_{ndc}
	+ G(v_c - \mu_c)
$$

この近似を用い、NDC上に変換した分布$N(\mu_{ndc}, \Sigma_{ndc})$を求めることができる。

$$\begin{align*}
\mu'_{ndc} &:= \left.v_{ndc}\right|_{v_c=\mu_c} \\
\mu_{ndc} &\approx  \mu'_{ndc} \\
\Sigma_{ndc} &\approx G \Sigma_c G^T
\end{align*}$$

この $\mu'_{ndc}$ は、対象のピクセルの座標系を変換しただけなので、同じ位置にあるはずである。


### ぼかし

SSABSSでは、異方性ガウシアンフィルターを実現するために、楕円形のカーネルの長軸と短軸のそれぞれに対し1次元ガウシアンフィルターを適用する、2パスフィルタリングを行っている。しかしながら、この方法ではカーネルの形状が正円に近い場合にカーネルの方向が不安定となる。実際、SSABSS使用時に法線がカメラの方向に近い場合にアーティファクトが生じることが確認できた。

この問題が発生する原因は、カーネルの形状の変化に対し個別のカーネルの方向が不連続となる点が存在することである。そこで、このような不連続な点が存在しない手法を提案する。この手法はFast Anisotropic Gauss Filtering[^FAGF]の考えに基いているが、導出方法は異なる。

まず、2変数正規分布$N(0, E)$を考える。これを2x2行列$M$で変換した後の分布を$N(0, \Sigma)$とすると、次のような関係式が得られる。

$$
\Sigma = M M^T
$$

ここで、

$$
\Sigma := \begin{pmatrix}
\sigma_x^2 & \sigma_{xy} \\
\sigma_{xy} & \sigma_y^2
\end{pmatrix} \\
M := \begin{pmatrix}
a & b \\
c & d
\end{pmatrix}
$$

とする。この変換で得られる分布は$(a\ c)^T$方向と$(b\ d)^T$方向の1次元ガウシアンフィルターを合成することにより得られるものである(要検証)。しかし、このままでは$a, b, c, d$は一つに定まらないが、$c = 0$とすることにより、解を一つだけ定めることができる。

$$
c = 0, d = \sqrt{\sigma_y^2}, b = \sigma_{xy} / d, a = \sqrt{\sigma_x^2-b^2}
$$

実装
----

$$M_S^{-1} = \begin{pmatrix}
s_{00} & s_{01} & s_{02} \\
s_{10} & s_{11} & s_{12} \\
s_{20} & s_{21} & s_{22} \\
\end{pmatrix}$$

とすると、$(1/w_{Penumbra}^2)M_S\Sigma_SM_S^T$は次のように計算できる。
$$\begin{align*}
\frac{1}{w_{Penumbra}^2}\Sigma_{WS} &= \\
\frac{1}{w_{Penumbra}^2}M_S^{-1}\Sigma_S(M_S^{-1})^T &= \begin{pmatrix}
s_{00} & s_{01} & s_{02} \\
s_{10} & s_{11} & s_{12} \\
s_{20} & s_{21} & s_{22} \\
\end{pmatrix}\begin{pmatrix}
1 & 0 & 0 \\
0 & 1 & 0 \\
0 & 0 & 0
\end{pmatrix}\begin{pmatrix}
s_{00} & s_{10} & s_{20} \\
s_{01} & s_{11} & s_{21} \\
s_{02} & s_{12} & s_{22} \\
\end{pmatrix} \\
&= \begin{pmatrix}
s_{00} & s_{01} & 0 \\
s_{10} & s_{11} & 0 \\
s_{20} & s_{21} & 0 \\
\end{pmatrix}\begin{pmatrix}
s_{00} & s_{10} & s_{20} \\
s_{01} & s_{11} & s_{21} \\
s_{02} & s_{12} & s_{22} \\
\end{pmatrix} \\
&= \begin{pmatrix}
s_{00}^2+s_{01}^2 & s_{00}s_{10}+s_{01}s_{11} & s_{00}s_{20}+s_{01}s_{21} \\
s_{00}s_{10}+s_{01}s_{11} & s_{10}^2+s_{11}^2 & s_{10}s_{20}+s_{11}s_{21} \\
s_{00}s_{20}+s_{01}s_{21} & s_{10}s_{20}+s_{11}s_{21} & s_{20}^2+s_{21}^2 \\
\end{pmatrix}
\end{align*}$$


参考文献
-----

[^SSABSS]: [Efficient Screen Space Anisotropic Blurred Soft Shadows](http://ci.nii.ac.jp/naid/130004679281)
[^FAGF]: [Fast Anisotropic Gauss Filtering](http://www.cat.uab.cat/Public/Publications/2002/GSV2002/GeusebroekIP03.pdf)
