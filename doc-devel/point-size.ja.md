ポイントサイズの計算
=================

投影行列 $P$ が与えられた時、ワールドスペースのポイントサイズ$r_w$と中心座標$v_w$から、スクリーンスペースのポイントサイズを計算したい。

手法
----

### 分布の投影

そこで、ワールドスペース上の平均値$\mu_w:=(v_w^T\ 1)^T$、共分散行列$\Sigma_w:=r_w^2E'$とした正規分布$N(\mu_w, \Sigma_w)$を考え、これを画面空間に投影してみる。ただし、

$$
E' = \begin{pmatrix}
1 & 0 & 0 & 0 \\
0 & 1 & 0 & 0 \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 0
\end{pmatrix}
$$

である。まず$N(\mu_w, \Sigma_w)$を投影行列 $P$ で変換すると、

$$\begin{align*}
\mu_c &:=  P \mu_w \\
\Sigma_c &:= P \Sigma_w P^T
\end{align*}$$

Perspective Divisionは、次のように行われる。

$$
\begin{pmatrix}
x_{ndc} \\ y_{ndc} \\ z_{ndc}
\end{pmatrix}
 =
\begin{pmatrix}
x_c/w_c \\ y_c/w_c \\ z_c/w_c
\end{pmatrix}
$$

この変換は非線形であり、変換後の分布を計算するのは簡単そうではない。そこで、$\mu_c$を基準として一次近似を行う。$v_{ndc}$のヤコビアンを計算すると

$$\begin{align*}
\frac{\partial v_{ndc}}{\partial v_c}
	&= \begin{pmatrix}
		\frac{\partial x_{ndc}}{\partial x_c} &
			\frac{\partial x_{ndc}}{\partial y_c} &
			\frac{\partial x_{ndc}}{\partial z_c} &
			\frac{\partial x_{ndc}}{\partial w_c} \\ 
		\frac{\partial y_{ndc}}{\partial x_c} &
			\frac{\partial y_{ndc}}{\partial y_c} &
			\frac{\partial y_{ndc}}{\partial z_c} &
			\frac{\partial y_{ndc}}{\partial w_c} \\ 
		\frac{\partial z_{ndc}}{\partial x_c} &
			\frac{\partial z_{ndc}}{\partial y_c} &
			\frac{\partial z_{ndc}}{\partial z_c} &
			\frac{\partial z_{ndc}}{\partial w_c} \\ 
		\end{pmatrix} \\
	&= \begin{pmatrix}
		1/w_c &
			0 &
			0 &
			-x_c / w_c^2 \\ 
		0 &
			1/w_c &
			0 &
			-y_c / w_c^2 \\ 
		0 &
			0 &
			1/w_c &
			-z_c / w_c^2 \\ 
		\end{pmatrix}
\end{align*}$$

ここで、$v_c=\mu_c$とすると、

$$\begin{align*}
\left.\frac{\partial v_{ndc}}{\partial v_c}\right|_{v_c=\mu_c}
	&= \begin{pmatrix}
		1/w_{\mu_c} &
			0 &
			0 &
			-x_{\mu_c} / w^2_{\mu_c} \\ 
		0 &
			1/w_{\mu_c} &
			0 &
			-y_{\mu_c} / w^2_{\mu_c} \\ 
		0 &
			0 &
			1/w_{\mu_c} &
			-z_{\mu_c} / w^2_{\mu_c} \\ 
		\end{pmatrix} \\
	&:= G
\end{align*}$$

また、$\mu'_{ndc} := \left.v_{ndc}\right|_{v_c=\mu_c}$としておく。これを用いると、次のように$v_{ndc}$を近似できる。

$$
v_{ndc} \approx 
	\mu'_{ndc}
	+ G(v_c - \mu_c)
$$

この近似を用い、NDC上に変換した分布を求めることができる。

$$\begin{align*}
\mu_{ndc} &\approx  \mu'_{ndc} \\
\Sigma_{ndc} &\approx G \Sigma_c G^T
\end{align*}$$

最後に、ビューポート変換を行う。Z成分はここでは不要なので捨てる。

$$\begin{align*}
M &:= \begin{pmatrix}
w/2 & 0 & 0 \\
0 & h/2 & 0
\end{pmatrix}\\
\mu_{v} &:= M \mu_{ndc} \\
\Sigma_{v} &:= M \Sigma_{ndc} M^T
\end{align*}$$

これにより、ワールドスペースの分布$N(\mu_w, \Sigma_w)$が画面上の分布$N(\mu_v, \Sigma_v)$に変換された。

### 分布からポイントサイズに戻す

得られた分布 $N(\mu_v, \Sigma_v)$ の形状は正円ではない。WebGLで描画できる点は必ず正方形でなければならない。そこで、何らかの基準を設け、同等の正円の分布を探す必要がある。ここでは、行列式の等価性を基準とする。

$\Sigma_w$の定義と同じような方法で、スクリーンスペース上のポイントサイズ$r_v$に対応する、形状が正円である正規分布の共分散行列は

$$
\Sigma'_v := \begin{pmatrix}
r_v^2 & 0 \\
0 & r_v^2
\end{pmatrix}
$$

と定義できる。この行列式の値は$\left|\Sigma'_v\right|= r_v^4$である。
等価性の条件より$\left|\Sigma'_v\right| = \left|\Sigma_v\right|$
なので、$r_v = \sqrt[4]{\left|\Sigma_v\right|}$と求まる。

### 実装方法

目的はポイントサイズを計算することであるので、$\mu_v$は不要である。しかし、$G$の計算には$\mu_c$が必要となることに注意する。

1. $\mu_c = Pv_w$を計算する。これは `gl_Position` の計算ですでに求まっているはずである。
2. $MG$ を計算する。$$\begin{align*}
MG &= \begin{pmatrix}
w/2 & 0 & 0 \\
0 & h/2 & 0
\end{pmatrix} \begin{pmatrix}
1/w_{\mu_c} &
	0 &
	0 &
	-x_{\mu_c} / w_c^{\mu_c} \\ 
0 &
	1/w_{\mu_c} &
	0 &
	-y_{\mu_c} / w^2_{\mu_c} \\ 
0 &
	0 &
	1/w_{\mu_c} &
	-z_{\mu_c} / w^2_{\mu_c} \\ 
\end{pmatrix} \\
&= \begin{pmatrix}
(w/2)/w_{\mu_c} &
	0 &
	0 &
	-x_{\mu_c} / w^2_{\mu_c} \\ 
0 &
	(h/2)/w_{\mu_c} &
	0 &
	-y_{\mu_c} / w^2_{\mu_c}
\end{pmatrix}
\end{align*}$$
3. $MGPE'$を計算する。$PE'$は$P$の第4列を0にしたものになる。
4. $(1/r_w^2)\Sigma_v$ を次のようにして計算する。 $$\begin{align*}
\frac{1}{r_w^2}\Sigma_v &= \frac{1}{r_w^2}MGPr^2_wE'P^TG^TM^T \\
&= MGPE'P^TG^TM^T \\
&= MGPE'E'^TP^TG^TM^T \\
&= MGPE'(MGPE')^T \\
\end{align*}$$
5. $r_v = \sqrt[4]{\left|\Sigma_v\right|} = r_w \sqrt[4]{\left|(1/r_w^2)\Sigma_v\right|}$ を計算する。

最適化
=====

$MG$は疎なので、$MGPE'$ をそのまま求めると効率が良くなさそうである。計算過程を再構成して、もっと綺麗な感じにできないだろうか?
試しに$MGPE'$を展開してみよう。なお、$MG$に含まれる要素は式を簡単にするため別の変数に置いておく。

$$\begin{align*}
x_g &= (w/2)/w_{\mu_c} \\
y_g &= (h/2)/w_{\mu_c} \\
x_d &= -x_{\mu_c} / w^2_{\mu_c} \\
y_d &= -y_{\mu_c} / w^2_{\mu_c}
\end{align*}
$$

$$\begin{align*}
MGPE' &= \begin{pmatrix}
x_g &
	0 &
	0 &
	x_d \\ 
0 &
	y_g &
	0 &
	y_d
\end{pmatrix}\begin{pmatrix}
p_{00} & p_{01} & p_{02} & 0 \\
p_{10} & p_{11} & p_{12} & 0 \\
p_{20} & p_{21} & p_{22} & 0 \\
p_{30} & p_{31} & p_{32} & 0 \\
\end{pmatrix} \\
&= \begin{pmatrix}
p_{00}x_g+p_{30}x_d &
	p_{01}x_g+p_{31}x_d &
	p_{02}x_g+p_{32}x_d &
	0 \\ 
p_{10}y_g+p_{30}y_d &
	p_{11}y_g+p_{31}y_d &
	p_{12}y_g+p_{32}y_d &
	0
\end{pmatrix} \\
&:=  \begin{pmatrix}
v_1 \\ 
v_2
\end{pmatrix}
\end{align*}$$

また、2x4行列$N$を考えた時の$\left|NN^T\right|$の値も確認しておこう。

$$\begin{align*}
N &= \begin{pmatrix}
m_{00} & m_{01} & m_{02} & 0 \\
m_{10} & m_{11} & m_{12} & 0 \\
\end{pmatrix} \\
NN^T &= \begin{pmatrix}
m_{00} & m_{01} & m_{02} & 0 \\
m_{10} & m_{11} & m_{12} & 0 \\
\end{pmatrix}\begin{pmatrix}
m_{00} & m_{10} \\
m_{01} & m_{11} \\
m_{02} & m_{12} \\
0 & 0 \\
\end{pmatrix} \\
&= \begin{pmatrix}
m_{00}^2+m_{01}^2+m_{02}^2 & m_{00}m_{10}^2+m_{01}m_{11}+m_{02}m_{12}  \\
m_{00}m_{10}^2+m_{01}m_{11}+m_{02}m_{12}  & m_{10}+m_{11}^2+m_{12}^2  \\
\end{pmatrix} \\
\left|NN^T\right| &= (m_{00}^2+m_{01}^2+m_{02}^2)(m_{10}^2+m_{11}^2+m_{12}^2  ) - (m_{00}m_{10}+m_{01}m_{11}+m_{02}m_{12})^2 \\
&= \left|v_1\right|^2\left|v_2\right|^2-(v_1 \cdot v_2)^2
\end{align*}$$


<!--
ボツ
----

次のプロジェクション行列 $P$ が与えられる。

$$
\left(\begin{matrix}
p_{0,0} & p_{0,1} &p_{0,2} &p_{0,3} \\
p_{1,0} & p_{1,1} &p_{1,2} &p_{1,3} \\
p_{2,0} & p_{2,1} &p_{2,2} &p_{2,3} \\
p_{3,0} & p_{3,1} &p_{3,2} &p_{3,3} \\
\end{matrix}\right)
$$


ポイントサイズは常に正方形であるため、出力に$x, y$の両方は要らないはずである。入力も同様である。そこで、入出力ともに$y$成分を削る。


$$
\left(\begin{matrix}
p_{0,0} & p_{0,2} &p_{0,3} \\
p_{2,0} & p_{2,2} &p_{2,3} \\
p_{3,0} & p_{3,2} &p_{3,3} \\
\end{matrix}\right)
$$

ポイントサイズはNDCではなく、ピクセル数で指定される。したがって、ビューポートサイズを$w_v$とすると、$x_s=w_v / 2$でスケーリングすることが必要である。

$$
\left(\begin{matrix}
x_sp_{0,0} & x_sp_{0,2} & x_sp_{0,3} \\
p_{2,0} & p_{2,2} &p_{2,3} \\
p_{3,0} & p_{3,2} &p_{3,3} \\
\end{matrix}\right)
$$
-->
